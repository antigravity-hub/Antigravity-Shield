/**
 * Adversarial Stress & Edge-Case Verification Harness for M1 Quota Balancer & Rotation
 *
 * EMPIRICAL CHALLENGER TEST SUITE (Tier 5 Adversarial)
 * 1. Zero-token / 0-quota accounts & empty pool edge cases
 * 2. Missing model quotas in model_quotas dictionary & alias resolution
 * 3. Total account exhaustion & cascading 429 cooldowns
 * 4. High-concurrency race condition stress (50+ parallel requests)
 * 5. Malformed model names, boundary payloads, and panic-freedom
 */

import assert from 'node:assert';
import { TestContext } from './harness/test_context.mjs';
import { ProxyGateway } from './harness/proxy_gateway.mjs';
import { assertErrorResponse } from './harness/assertions.mjs';

async function runAdversarialBalancerSuite() {
  console.log('================================================================');
  console.log('  ANTIGRAVITY SHIELD API PROXY: ADVERSARIAL BALANCER STRESS TEST');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;
  const errors = [];

  async function test(name, fn) {
    process.stdout.write(`  TEST: ${name} ... `);
    try {
      await fn();
      passed++;
      console.log('PASSED');
    } catch (err) {
      failed++;
      console.log('FAILED');
      console.error(`    -> ${err.message}`);
      errors.push({ name, error: err.message, stack: err.stack });
    }
  }

  // --- SUITE 1: Zero Accounts & Empty Pool ---
  await test('ADV-01: Zero accounts in pool returns clean 503 (no crash/hang)', async () => {
    const emptyGateway = new ProxyGateway({
      accounts: [] // Zero accounts configured
    });
    const gwUrl = await emptyGateway.start();

    try {
      const res = await fetch(`${gwUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'Hello empty pool' }]
        })
      });

      assert.strictEqual(res.status, 503, 'Empty pool must return 503');
      const data = await res.json();
      assert.ok(data.error, 'Response must include error object');
      assert.strictEqual(data.error.code, 'all_accounts_exhausted');
    } finally {
      await new Promise(r => emptyGateway.server.close(r));
    }
  });

  // --- SUITE 2: Missing Model in Quota Table & Dynamic Alias ---
  await test('ADV-02: Missing model alias avoids false-positive 503 and routes cleanly', async () => {
    const context = new TestContext({
      customAliases: {
        'gemini-3.8-flash': 'gemini-3-flash',
        'gemini-future-preview': 'gemini-3.1-pro-preview'
      }
    });
    await context.setup();

    try {
      // 1. Test gemini-3.8-flash alias resolution
      const { res: res1, body: body1 } = await context.request('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-3.8-flash',
          messages: [{ role: 'user', content: 'Testing alias resolution' }]
        })
      });

      assert.strictEqual(res1.status, 200, 'Model alias gemini-3.8-flash must succeed with 200');
      assert.strictEqual(body1.model, 'gemini-3-flash', 'Model must be normalized to standard ID');

      // 2. Test unknown/unlisted model (graceful fallback)
      const { res: res2, body: body2 } = await context.request('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'unlisted-experimental-model-v99',
          messages: [{ role: 'user', content: 'Testing unlisted model fallback' }]
        })
      });

      assert.strictEqual(res2.status, 200, 'Unlisted model must NOT be rejected with 503 if healthy accounts exist');
      assert.strictEqual(body2.model, 'unlisted-experimental-model-v99');
    } finally {
      await context.teardown();
    }
  });

  // --- SUITE 3: Cascading 429 RateLimit Failover to Exhaustion ---
  await test('ADV-03: Cascading 429 rotates through ALL accounts and returns clean 503 when exhausted', async () => {
    const context = new TestContext({
      accounts: [
        { id: 'acc-1', tier: 'PRO', token: 'token-1', machineId: 'm-1', cooldownUntil: 0 },
        { id: 'acc-2', tier: 'PRO', token: 'token-2', machineId: 'm-2', cooldownUntil: 0 },
        { id: 'acc-3', tier: 'Standard', token: 'token-3', machineId: 'm-3', cooldownUntil: 0 },
      ]
    });
    await context.setup();

    try {
      // Configure mock upstream: ALL accounts return 429
      context.mockUpstream.registerHandler((req, res, record) => {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: {
            code: 429,
            message: 'Resource exhausted across all accounts',
            status: 'RESOURCE_EXHAUSTED'
          }
        }));
        return true;
      });

      const { res, body } = await context.request('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'Exhaust all accounts' }]
        })
      });

      assert.strictEqual(res.status, 503, 'Total exhaustion must return HTTP 503');
      assert.strictEqual(body.error.code, 'all_accounts_exhausted');

      // Verify all 3 accounts were placed into cooldown
      const now = Date.now();
      const inCooldown = context.proxyGateway.accounts.filter(a => a.cooldownUntil > now);
      assert.strictEqual(inCooldown.length, 3, 'All 3 accounts must be placed into cooldown pool');
      assert.ok(context.proxyGateway.stats.failovers >= 3, 'Failover counter must increment for each 429');
    } finally {
      await context.teardown();
    }
  });

  // --- SUITE 4: High Concurrency Load (50 parallel requests) ---
  await test('ADV-04: High concurrency stress (50 parallel requests with partial failover)', async () => {
    const context = new TestContext();
    await context.setup();

    try {
      let callCount = 0;
      context.mockUpstream.registerHandler((req, res, record) => {
        callCount++;
        // Trigger 429 on first 2 calls to test concurrent rotation
        if (callCount <= 2) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { code: 429, message: 'Rate limit hit' } }));
          return true;
        }
        return false;
      });

      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          context.request('/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'gemini-2.5-flash',
              messages: [{ role: 'user', content: `Concurrent prompt ${i}` }]
            })
          })
        );
      }

      const results = await Promise.all(promises);

      // Verify all 50 completed
      assert.strictEqual(results.length, 50);
      const successful = results.filter(r => r.res.status === 200);
      assert.ok(successful.length >= 48, `Expected at least 48/50 successes, got ${successful.length}`);

      // Verify health check remains responsive
      const health = await context.request('/health');
      assert.strictEqual(health.res.status, 200);
    } finally {
      await context.teardown();
    }
  });

  // --- SUITE 5: Malformed & Boundary Model Identifiers ---
  await test('ADV-05: Adversarial / boundary model inputs do not panic gateway', async () => {
    const context = new TestContext();
    await context.setup();

    try {
      const boundaryModels = [
        'gemini-3.8-flash\x00corrupt', // null byte in string
        '🔥-gemini-emoji-model',        // Unicode emoji model name
        'a'.repeat(2048),              // 2KB model identifier
        'gpt-4o-mini',                 // standard alias
      ];

      for (const modelName of boundaryModels) {
        const { res, body } = await context.request('/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelName,
            messages: [{ role: 'user', content: 'Test boundary model' }]
          })
        });

        // Gateway must not crash, must return 200 or clean client error
        assert.ok(
          res.status === 200 || res.status === 400 || res.status === 404,
          `Boundary model '${modelName.slice(0, 20)}...' should return 200, 400, or 404, got ${res.status}`
        );
      }
    } finally {
      await context.teardown();
    }
  });

  console.log('----------------------------------------------------------------');
  console.log(`Adversarial Suite Finished: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    throw new Error(`${failed} adversarial tests failed!`);
  }
}

runAdversarialBalancerSuite().catch(err => {
  console.error('\nFatal test runner failure:', err);
  process.exit(1);
});
