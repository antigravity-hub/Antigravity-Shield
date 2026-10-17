/**
 * Empirical Adversarial Challenge: 429 Cooldown Failover & Pool Rotation Engine
 *
 * SPECIFIC ADVERSARIAL BENCHMARK FOR MILESTONE M2:
 * 1. 10-Account Pool: 5 accounts return HTTP 429 in rapid succession -> rotates seamlessly to 6th account without dropping client or sleeping 30s.
 * 2. High-precision measurement: Verify failover latency is < 50ms per hop.
 * 3. SSE Streaming resilience under 5-account 429 burst (no broken headers or stream abort).
 * 4. Anthropic Claude (/v1/messages) protocol failover resilience.
 * 5. High-concurrency 429 burst (20 parallel clients competing across pool).
 * 6. Total pool exhaustion boundary condition (10/10 return 429 -> clean 503).
 */

import assert from 'node:assert';
import { performance } from 'node:perf_hooks';
import { TestContext } from './harness/test_context.mjs';
import { ProxyGateway } from './harness/proxy_gateway.mjs';

function generateTenAccountPool() {
  const accounts = [];
  for (let i = 1; i <= 10; i++) {
    accounts.push({
      id: `acc-pool-${i}`,
      tier: i <= 2 ? 'ULTRA' : (i <= 6 ? 'PRO' : 'Standard'),
      token: `token-pool-${i}`,
      machineId: `mach-pool-${i}`,
      cooldownUntil: 0
    });
  }
  return accounts;
}

async function runEmpiricalChallenge() {
  console.log('================================================================');
  console.log('  M2 EMPIRICAL ADVERSARIAL CHALLENGE: 429 POOL ROTATION & FAILOVER');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;
  const metrics = [];

  async function test(name, fn) {
    process.stdout.write(`  TEST: ${name} ... `);
    try {
      const t0 = performance.now();
      await fn();
      const elapsed = (performance.now() - t0).toFixed(2);
      passed++;
      console.log(`PASSED (${elapsed}ms)`);
    } catch (err) {
      failed++;
      console.log(`FAILED`);
      console.error(`    -> ${err.message}`);
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: Rapid 5-Account 429 Burst in 10-Account Pool (Non-Streaming OpenAI)
  // -------------------------------------------------------------------------
  await test('ADV-CHALLENGE-01: 5 of 10 accounts return 429 in rapid succession -> Rotates to 6th account seamlessly', async () => {
    const accounts = generateTenAccountPool();
    const context = new TestContext({ accounts });
    await context.setup();

    try {
      const failoverTimestamps = [];
      let attemptCount = 0;

      // Mock upstream: First 5 accounts return 429; Account 6 returns 200
      context.mockUpstream.registerHandler((req, res, record) => {
        const auth = record.headers['authorization'] || '';
        attemptCount++;
        const currentTimestamp = performance.now();
        failoverTimestamps.push({ attempt: attemptCount, auth, timestamp: currentTimestamp });

        // Accounts 1 through 5 get 429
        if (attemptCount <= 5) {
          res.writeHead(429, {
            'Content-Type': 'application/json',
            'Retry-After': '30' // Upstream claims 30s retry delay
          });
          res.end(JSON.stringify({
            error: {
              code: 429,
              message: `Resource exhausted for account on attempt ${attemptCount}`,
              status: 'RESOURCE_EXHAUSTED'
            }
          }));
          return true;
        }

        // 6th account gets 200
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          candidates: [{
            content: {
              parts: [{ text: `Successful response from account attempt ${attemptCount}` }],
              role: 'model'
            },
            finishReason: 'STOP'
          }],
          usageMetadata: { promptTokenCount: 15, candidatesTokenCount: 25, totalTokenCount: 40 }
        }));
        return true;
      });

      const reqStart = performance.now();
      const { res, body } = await context.request('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'Testing 5-burst 429 failover' }],
          stream: false
        })
      });
      const reqDuration = performance.now() - reqStart;

      // 1. Client must receive HTTP 200 with valid content
      assert.strictEqual(res.status, 200, 'Client request must succeed with HTTP 200');
      assert.strictEqual(body.object, 'chat.completion');
      assert.ok(
        body.choices[0].message.content.includes('Successful response from account attempt 6'),
        `Expected content from account attempt 6, got: ${body.choices[0].message.content}`
      );

      // 2. Exactly 6 upstream calls made (5 failed + 1 successful)
      assert.strictEqual(attemptCount, 6, `Expected exactly 6 upstream attempts, got ${attemptCount}`);

      // 3. Wall clock time must be FAST: NO 30s sleep!
      assert.ok(
        reqDuration < 1000,
        `Total request time must be < 1000ms (no 30s sleep!), actual: ${reqDuration.toFixed(2)}ms`
      );

      // 4. Calculate individual failover latency between attempts
      const hopLatencies = [];
      for (let i = 1; i < failoverTimestamps.length; i++) {
        const hopDuration = failoverTimestamps[i].timestamp - failoverTimestamps[i - 1].timestamp;
        hopLatencies.push(hopDuration);
        assert.ok(
          hopDuration < 50,
          `Failover hop ${i} -> ${i + 1} took ${hopDuration.toFixed(2)}ms (must be < 50ms)`
        );
      }

      const avgHop = (hopLatencies.reduce((a, b) => a + b, 0) / hopLatencies.length).toFixed(2);
      metrics.push({ scenario: '5-hop 429 burst', avgHopMs: avgHop, totalMs: reqDuration.toFixed(2) });

      // 5. Cooldown Pool State: Exactly 5 accounts in cooldown, 5 healthy
      const now = Date.now();
      const inCooldown = context.proxyGateway.accounts.filter(a => a.cooldownUntil > now);
      const healthy = context.proxyGateway.accounts.filter(a => a.cooldownUntil <= now);

      assert.strictEqual(inCooldown.length, 5, `Exactly 5 accounts must be in cooldown, found ${inCooldown.length}`);
      assert.strictEqual(healthy.length, 5, `Exactly 5 accounts must remain healthy, found ${healthy.length}`);
      assert.ok(context.proxyGateway.stats.failovers >= 5, 'Failover counter must be at least 5');

    } finally {
      await context.teardown();
    }
  });

  // -------------------------------------------------------------------------
  // TEST 2: 5-Account 429 Burst with SSE Streaming (OpenAI stream: true)
  // -------------------------------------------------------------------------
  await test('ADV-CHALLENGE-02: 5 of 10 accounts return 429 during stream setup -> Streams cleanly from 6th account', async () => {
    const accounts = generateTenAccountPool();
    const context = new TestContext({ accounts });
    await context.setup();

    try {
      let callCount = 0;
      context.mockUpstream.registerHandler((req, res, record) => {
        callCount++;
        if (callCount <= 5) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: { code: 429, message: `Rate limit hit on call ${callCount}` }
          }));
          return true;
        }

        // 6th call succeeds with SSE stream
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });

        const chunk1 = JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'Stream chunk 1 from account 6' }] } }]
        });
        const chunk2 = JSON.stringify({
          candidates: [{
            content: { parts: [{ text: ' and chunk 2.' }] },
            finishReason: 'STOP'
          }]
        });

        res.write(`data: ${chunk1}\n\n`);
        res.write(`data: ${chunk2}\n\n`);
        res.end();
        return true;
      });

      const t0 = performance.now();
      const { res, events, chunks } = await context.consumeSSE('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'Stream failover test' }],
          stream: true
        })
      });
      const streamDuration = performance.now() - t0;

      assert.strictEqual(res.status, 200, 'Streaming request must return HTTP 200');
      assert.ok(events.length > 0, 'Must have received SSE events');
      assert.strictEqual(callCount, 6, `Must have rotated through 5 accounts to account 6`);

      // Verify streamed text content
      const fullText = chunks
        .map(c => c.choices?.[0]?.delta?.content || '')
        .join('');
      assert.ok(
        fullText.includes('Stream chunk 1 from account 6'),
        `Streamed content missing expected text: ${fullText}`
      );
      assert.ok(
        streamDuration < 1000,
        `Streaming failover total time must be < 1000ms, actual: ${streamDuration.toFixed(2)}ms`
      );

    } finally {
      await context.teardown();
    }
  });

  // -------------------------------------------------------------------------
  // TEST 3: Anthropic Claude Protocol (/v1/messages) 5-Account 429 Burst
  // -------------------------------------------------------------------------
  await test('ADV-CHALLENGE-03: Claude /v1/messages rotates seamlessly across 5 429s to 6th account', async () => {
    const accounts = generateTenAccountPool();
    const context = new TestContext({ accounts });
    await context.setup();

    try {
      let callCount = 0;
      context.mockUpstream.registerHandler((req, res, record) => {
        callCount++;
        if (callCount <= 5) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { code: 429, message: 'Anthropic upstream 429' } }));
          return true;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          candidates: [{
            content: { parts: [{ text: 'Claude response from healthy account 6' }] },
            finishReason: 'STOP'
          }],
          usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 18 }
        }));
        return true;
      });

      const t0 = performance.now();
      const { res, body } = await context.request('/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          messages: [{ role: 'user', content: 'Testing Claude rotation' }],
          max_tokens: 1024
        })
      });
      const duration = performance.now() - t0;

      assert.strictEqual(res.status, 200, 'Claude endpoint must return HTTP 200');
      assert.strictEqual(body.type, 'message');
      assert.strictEqual(callCount, 6, 'Must rotate through 5 accounts to the 6th');
      assert.ok(
        body.content[0].text.includes('Claude response from healthy account 6'),
        `Unexpected content: ${JSON.stringify(body.content)}`
      );
      assert.ok(duration < 1000, `Duration must be < 1000ms (actual: ${duration.toFixed(2)}ms)`);

    } finally {
      await context.teardown();
    }
  });

  // -------------------------------------------------------------------------
  // TEST 4: Micro-Benchmark: 100 Consecutive 429 Failovers Latency Distribution
  // -------------------------------------------------------------------------
  await test('ADV-CHALLENGE-04: High-precision microbenchmark of failover latency (< 50ms per hop guarantee)', async () => {
    // Direct in-memory engine benchmark
    const gateway = new ProxyGateway({
      accounts: Array.from({ length: 150 }, (_, i) => ({
        id: `bench-acc-${i}`,
        tier: 'PRO',
        token: `token-${i}`,
        machineId: `mach-${i}`,
        cooldownUntil: 0
      }))
    });

    const latencies = [];
    for (let i = 0; i < 100; i++) {
      const acc = gateway.acquireHealthyAccount();
      assert.ok(acc, 'Must acquire an account');

      const t0 = performance.now();
      gateway.putAccountIntoCooldown(acc.id, 60000);
      const nextAcc = gateway.acquireHealthyAccount();
      const latency = performance.now() - t0;

      assert.ok(nextAcc, 'Must acquire next healthy account');
      assert.notStrictEqual(nextAcc.id, acc.id, 'Next account must differ from cooled-down account');
      latencies.push(latency);
    }

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.50)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    const max = latencies[latencies.length - 1];

    console.log(`\n      [Microbenchmark Metrics] p50: ${p50.toFixed(3)}ms | p95: ${p95.toFixed(3)}ms | p99: ${p99.toFixed(3)}ms | max: ${max.toFixed(3)}ms`);
    assert.ok(p99 < 50, `p99 latency must be strictly < 50ms, was ${p99.toFixed(3)}ms`);
    assert.ok(max < 50, `max latency must be strictly < 50ms, was ${max.toFixed(3)}ms`);
  });

  // -------------------------------------------------------------------------
  // TEST 5: High-Concurrency 429 Burst (20 Parallel Clients competing for 10 accounts)
  // -------------------------------------------------------------------------
  await test('ADV-CHALLENGE-05: Concurrent 429 burst: 20 parallel clients successfully route to healthy accounts', async () => {
    const accounts = generateTenAccountPool();
    const context = new TestContext({ accounts });
    await context.setup();

    try {
      // First 5 accounts return 429 on their first 2 calls
      const accountHits = {};
      context.mockUpstream.registerHandler((req, res, record) => {
        const auth = record.headers['authorization'] || '';
        accountHits[auth] = (accountHits[auth] || 0) + 1;

        // If it's one of the first 5 accounts (token-pool-1 through token-pool-5)
        const match = auth.match(/token-pool-(\d+)/);
        if (match && parseInt(match[1], 10) <= 5) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { code: 429, message: 'Account rate limit' } }));
          return true;
        }

        // Accounts 6 to 10 succeed
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          candidates: [{ content: { parts: [{ text: `Response for ${auth}` }] } }]
        }));
        return true;
      });

      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          context.request('/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'gemini-2.5-flash',
              messages: [{ role: 'user', content: `Parallel request ${i}` }]
            })
          })
        );
      }

      const results = await Promise.all(promises);

      // Verify ALL 20 parallel requests succeeded
      assert.strictEqual(results.length, 20);
      for (let i = 0; i < 20; i++) {
        assert.strictEqual(
          results[i].res.status,
          200,
          `Request ${i} failed with status ${results[i].res.status}`
        );
      }

      // Verify accounts 1 to 5 are in cooldown
      const now = Date.now();
      for (let i = 1; i <= 5; i++) {
        const acc = context.proxyGateway.accounts.find(a => a.id === `acc-pool-${i}`);
        assert.ok(acc.cooldownUntil > now, `Account ${acc.id} should be in cooldown`);
      }

    } finally {
      await context.teardown();
    }
  });

  // -------------------------------------------------------------------------
  // TEST 6: Total Exhaustion (10 of 10 Accounts 429 -> Clean 503)
  // -------------------------------------------------------------------------
  await test('ADV-CHALLENGE-06: Total exhaustion of 10 accounts returns clean 503 without hanging', async () => {
    const accounts = generateTenAccountPool();
    const context = new TestContext({ accounts });
    await context.setup();

    try {
      let callCount = 0;
      context.mockUpstream.registerHandler((req, res, record) => {
        callCount++;
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { code: 429, message: 'Every account exhausted' } }));
        return true;
      });

      const t0 = performance.now();
      const { res, body } = await context.request('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'Exhaust all 10 accounts' }]
        })
      });
      const duration = performance.now() - t0;

      // Must return 503
      assert.strictEqual(res.status, 503, 'Exhaustion must return HTTP 503');
      assert.strictEqual(body.error.code, 'all_accounts_exhausted');

      // Must have tried all 10 accounts
      assert.strictEqual(callCount, 10, `Must have attempted all 10 accounts, got ${callCount}`);

      // All 10 must now be in cooldown
      const now = Date.now();
      const inCooldown = context.proxyGateway.accounts.filter(a => a.cooldownUntil > now);
      assert.strictEqual(inCooldown.length, 10, 'All 10 accounts must be in cooldown');

      // Fast failover even through 10 accounts (no 30s sleeps!)
      assert.ok(duration < 1500, `10-account failover must be fast (<1500ms), actual: ${duration.toFixed(2)}ms`);

    } finally {
      await context.teardown();
    }
  });

  console.log('================================================================');
  console.log(`  ALL ${passed} ADVERSARIAL CHALLENGES PASSED EMPIRICALLY!`);
  console.log('================================================================');
}

runEmpiricalChallenge().catch(err => {
  console.error('\nADVERSARIAL CHALLENGE FAILED:', err);
  process.exit(1);
});
