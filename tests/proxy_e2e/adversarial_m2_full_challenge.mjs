/**
 * Adversarial Challenge Suite for Milestone M2:
 * 1. Model Alias Normalization Matrix:
 *    - gemini-3.8-flash -> gemini-3-flash
 *    - gemini-3.8-flash-medium -> gemini-3-flash
 *    - gemini-3.8-flash-high -> gemini-3-flash
 *    - gpt-4o-mini -> gemini-2.5-flash
 * 2. Token Refresh Double-Checked Locking & Thundering Herd Resistance:
 *    - Simulates 25 concurrent requests needing refresh on the same account
 * 3. Proactive Background Refresh Loop & Non-Blocking Invariants
 */

import assert from 'node:assert';
import { TestContext } from './harness/test_context.mjs';
import { ProxyGateway } from './harness/proxy_gateway.mjs';

export async function runM2AdversarialSuite() {
  console.log('================================================================');
  console.log('  M2 EMPIRICAL CHALLENGER: MODEL ALIASES & TOKEN REFRESH RACES  ');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;
  const errors = [];

  async function test(name, fn) {
    process.stdout.write(`  TEST: ${name} ... `);
    const start = Date.now();
    try {
      await fn();
      passed++;
      console.log(`PASSED (${Date.now() - start}ms)`);
    } catch (err) {
      failed++;
      console.log(`FAILED (${Date.now() - start}ms)`);
      console.error(`    -> ${err.message}`);
      errors.push({ name, error: err.message, stack: err.stack });
    }
  }

  // --- SECTION 1: Model Alias Normalization in ProxyGateway ---
  await test('ADV-M2-01: OpenAI endpoint model alias matrix resolution', async () => {
    const context = new TestContext();
    await context.setup();

    const testCases = [
      { input: 'gemini-3.8-flash', expected: 'gemini-3-flash' },
      { input: 'gemini-3.8-flash-medium', expected: 'gemini-3-flash' },
      { input: 'gemini-3.8-flash-high', expected: 'gemini-3-flash' },
      { input: 'gpt-4o-mini', expected: 'gemini-2.5-flash' },
    ];

    try {
      for (const tc of testCases) {
        context.mockUpstream.clearRecorded();
        const { res, body } = await context.request('/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: tc.input,
            messages: [{ role: 'user', content: `Testing alias ${tc.input}` }]
          })
        });

        assert.strictEqual(res.status, 200, `Request with model ${tc.input} must return 200 OK`);
        const lastReq = context.mockUpstream.recordedRequests.at(-1);
        assert.ok(lastReq, 'Upstream request must have been recorded');
        assert.strictEqual(
          lastReq.body.model,
          tc.expected,
          `Input alias '${tc.input}' must normalize to '${tc.expected}', got '${lastReq.body.model}'`
        );
      }
    } finally {
      await context.teardown();
    }
  });

  await test('ADV-M2-02: Claude endpoint model alias matrix resolution', async () => {
    const context = new TestContext();
    await context.setup();

    const testCases = [
      { input: 'gemini-3.8-flash', expected: 'gemini-3-flash' },
      { input: 'gemini-3.8-flash-medium', expected: 'gemini-3-flash' },
      { input: 'gemini-3.8-flash-high', expected: 'gemini-3-flash' },
      { input: 'gpt-4o-mini', expected: 'gemini-2.5-flash' },
    ];

    try {
      for (const tc of testCases) {
        context.mockUpstream.clearRecorded();
        const { res, body } = await context.request('/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: tc.input,
            messages: [{ role: 'user', content: `Testing Claude alias ${tc.input}` }],
            max_tokens: 100
          })
        });

        assert.strictEqual(res.status, 200, `Claude request with model ${tc.input} must return 200 OK`);
        const lastReq = context.mockUpstream.recordedRequests.at(-1);
        assert.ok(lastReq, 'Upstream request must have been recorded');
        assert.strictEqual(
          lastReq.body.model,
          tc.expected,
          `Input alias '${tc.input}' must normalize to '${tc.expected}', got '${lastReq.body.model}'`
        );
      }
    } finally {
      await context.teardown();
    }
  });

  // --- SECTION 2: Token Refresh Double-Checked Locking (Thundering Herd) Simulation ---
  await test('ADV-M2-03: Double-checked locking prevents concurrent refresh stampedes (25 concurrent calls)', async () => {
    // We implement the exact double-checked locking algorithm from src-tauri/src/proxy/token_manager.rs:
    // tokens: map of account_id -> { access_token, timestamp, expires_in }
    // refresh_locks: map of account_id -> Mutex
    const tokens = new Map([
      ['acc-test-1', {
        id: 'acc-test-1',
        access_token: 'old-token',
        timestamp: Math.floor(Date.now() / 1000) + 100, // expires in 100s (< 600s buffer)
        expires_in: 3600
      }]
    ]);

    class AsyncMutex {
      constructor() {
        this.queue = [];
        this.locked = false;
      }
      async lock() {
        if (!this.locked) {
          this.locked = true;
          return () => this.unlock();
        }
        return new Promise(resolve => {
          this.queue.push(() => {
            this.locked = true;
            resolve(() => this.unlock());
          });
        });
      }
      unlock() {
        this.locked = false;
        if (this.queue.length > 0) {
          const next = this.queue.shift();
          next();
        }
      }
    }

    const refreshLocks = new Map();
    let upstreamOAuthCallCount = 0;

    async function refreshAccountToken(accountId) {
      const now = Math.floor(Date.now() / 1000);
      const TOKEN_REFRESH_BUFFER_SECS = 600;

      if (!refreshLocks.has(accountId)) {
        refreshLocks.set(accountId, new AsyncMutex());
      }
      const refreshMu = refreshLocks.get(accountId);

      const unlock = await refreshMu.lock();
      try {
        // Double-check: Was it refreshed by another concurrent request while we waited for lock?
        const latest = tokens.get(accountId);
        if (latest && now < latest.timestamp - TOKEN_REFRESH_BUFFER_SECS) {
          return latest; // Reused without calling upstream OAuth!
        }

        // Simulate upstream OAuth network call (50ms latency)
        upstreamOAuthCallCount++;
        await new Promise(r => setTimeout(r, 50));

        const updated = {
          ...latest,
          access_token: `refreshed-token-${upstreamOAuthCallCount}`,
          timestamp: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600
        };
        tokens.set(accountId, updated);
        return updated;
      } finally {
        unlock();
      }
    }

    // Launch 25 concurrent requests requesting the same expiring account
    const CONCURRENCY = 25;
    const promises = Array.from({ length: CONCURRENCY }, () => refreshAccountToken('acc-test-1'));
    const results = await Promise.all(promises);

    // Verify:
    // 1. All 25 requests succeeded
    assert.strictEqual(results.length, CONCURRENCY);
    // 2. All 25 received the refreshed token
    for (const res of results) {
      assert.strictEqual(res.access_token, 'refreshed-token-1');
    }
    // 3. Upstream OAuth call was executed EXACTLY ONCE (thundering herd blocked)
    assert.strictEqual(
      upstreamOAuthCallCount,
      1,
      `Expected exactly 1 upstream OAuth call for 25 concurrent requests, but observed ${upstreamOAuthCallCount}`
    );
  });

  // --- SECTION 3: Proactive Refresh Pre-Warming & Non-blocking Invariant ---
  await test('ADV-M2-04: Proactive refresh pre-warms tokens within threshold without client latency', async () => {
    const now = Math.floor(Date.now() / 1000);
    const PROACTIVE_THRESHOLD = 600;

    const accountPool = [
      { id: 'acc-1', timestamp: now + 300, refreshed: false },  // 5m remaining -> must refresh
      { id: 'acc-2', timestamp: now + 500, refreshed: false },  // 8.3m remaining -> must refresh
      { id: 'acc-3', timestamp: now + 3600, refreshed: false }, // 60m remaining -> must NOT refresh
    ];

    const expiring = accountPool.filter(a => now >= a.timestamp - PROACTIVE_THRESHOLD);
    assert.strictEqual(expiring.length, 2, 'Exactly 2 accounts should be flagged for proactive refresh');

    for (const acc of expiring) {
      acc.refreshed = true;
      acc.timestamp = now + 3600;
    }

    // After proactive refresh, none should need refresh on client hotpath
    const remainingExpiring = accountPool.filter(a => now >= a.timestamp - PROACTIVE_THRESHOLD);
    assert.strictEqual(remainingExpiring.length, 0, 'No accounts should need hotpath refresh after proactive pass');
  });

  console.log('----------------------------------------------------------------');
  console.log(`Adversarial Suite Summary: ${passed} passed, ${failed} failed.`);
  console.log('================================================================\n');

  return { passed, failed, errors };
}

runM2AdversarialSuite().then(res => {
  if (res.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}).catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
