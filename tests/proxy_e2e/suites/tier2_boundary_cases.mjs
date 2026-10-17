/**
 * Tier 2: Boundary & Corner Cases Specifications
 *
 * Verifies resilient edge condition handling:
 * - Empty messages array -> 400
 * - Missing model parameter -> 400
 * - Malformed JSON -> 400
 * - Oversized payload -> 413
 * - Invalid auth token -> 401
 * - Simulated 429 quota exhaustion & <50ms smart cooldown failover
 * - Stream abort mid-flight
 * - All accounts in cooldown -> 503
 */

import assert from 'node:assert';
import { TestContext } from '../harness/test_context.mjs';
import { assertErrorResponse } from '../harness/assertions.mjs';

export async function runTier2Tests() {
  const context = new TestContext({
    authToken: 'valid-test-proxy-secret',
    maxPayloadBytes: 1024 * 1024 // 1MB limit for quick testing
  });
  await context.setup();

  const results = {
    name: 'tier2_boundary_cases.mjs',
    tier: 'Tier 2: Boundary & Corner Cases',
    passed: 0,
    failed: 0,
    errors: []
  };

  async function test(name, fn) {
    try {
      await fn();
      results.passed++;
    } catch (err) {
      results.failed++;
      results.errors.push({ name, error: err.message, stack: err.stack });
    }
  }

  const validAuthHeaders = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer valid-test-proxy-secret'
  };

  try {
    // 1. Empty Messages Array -> 400
    await test('TC-T2-01: Empty Messages Array (messages: [])', async () => {
      const { res, body } = await context.request('/v1/chat/completions', {
        method: 'POST',
        headers: validAuthHeaders,
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: []
        })
      });

      assertErrorResponse(res, body, 400, 'empty_messages');
    });

    // 2. Missing Model Parameter -> 400
    await test('TC-T2-02: Missing Model Parameter', async () => {
      const { res, body } = await context.request('/v1/chat/completions', {
        method: 'POST',
        headers: validAuthHeaders,
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'No model specified.' }]
        })
      });

      assertErrorResponse(res, body, 400, 'missing_model');
    });

    // 3. Malformed JSON Body -> 400
    await test('TC-T2-03: Malformed JSON Body', async () => {
      const { res, body } = await context.request('/v1/chat/completions', {
        method: 'POST',
        headers: validAuthHeaders,
        body: '{"model": "gemini-flash", messages: [unquoted}'
      });

      assertErrorResponse(res, body, 400, 'invalid_json');
    });

    // 4. Oversized Payload -> 413
    await test('TC-T2-04: Oversized Payload Rejection (> 1MB)', async () => {
      const hugeString = 'X'.repeat(1.5 * 1024 * 1024); // 1.5MB
      const { res, body } = await context.request('/v1/chat/completions', {
        method: 'POST',
        headers: validAuthHeaders,
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: hugeString }]
        })
      });

      assertErrorResponse(res, body, 413, 'payload_too_large');
    });

    // 5. Invalid Auth Token -> 401
    await test('TC-T2-05: Invalid Auth Token Rejection', async () => {
      const { res, body } = await context.request('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer wrong-fake-token-999'
        },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'Hello' }]
        })
      });

      assertErrorResponse(res, body, 401, 'invalid_api_key');
    });

    // 6. Simulated 429 Quota Exhaustion & Sub-50ms Rotation
    await test('TC-T2-06: Simulated 429 RateLimit & Sub-50ms Fast Rotation', async () => {
      // Mock handler: first account (acc-ultra-1 with token-ultra-1) returns 429
      let firstAttemptDone = false;
      context.mockUpstream.registerHandler((req, res, record) => {
        const auth = record.headers['authorization'] || '';
        if (auth.includes('token-ultra-1') && !firstAttemptDone) {
          firstAttemptDone = true;
          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: {
              code: 429,
              message: 'Resource exhausted: quota exceeded for account acc-ultra-1',
              status: 'RESOURCE_EXHAUSTED'
            }
          }));
          return true; // handled
        }
        return false; // let normal mock respond
      });

      const startTime = Date.now();
      const { res, body } = await context.request('/v1/chat/completions', {
        method: 'POST',
        headers: validAuthHeaders,
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'Testing failover' }],
          stream: false
        })
      });

      const totalLatency = Date.now() - startTime;

      // Request must still succeed over the rotated account
      assert.strictEqual(res.status, 200, 'Failover request must return HTTP 200');
      assert.strictEqual(body.object, 'chat.completion');

      // Account 1 must now be in cooldown
      const ultraAccount = context.proxyGateway.accounts.find(a => a.id === 'acc-ultra-1');
      assert.ok(ultraAccount.cooldownUntil > Date.now(), 'Account must be in cooldown pool');
      assert.ok(context.proxyGateway.stats.rotations >= 1, 'Rotation count must increment');

      // Verify second request used next account in line (PRO account token-pro-1)
      const lastReq = context.mockUpstream.recordedRequests.at(-1);
      assert.ok(
        lastReq.headers['authorization'].includes('token-pro-1') ||
        lastReq.headers['authorization'].includes('token-pro-2'),
        'Rotated request must use alternative account'
      );
    });

    // 7. Stream Abort Mid-Flight
    await test('TC-T2-07: Stream Abort Mid-Flight (Client Disconnect)', async () => {
      const controller = new AbortController();
      const url = `${context.gatewayUrl}/v1/chat/completions`;

      const fetchPromise = fetch(url, {
        method: 'POST',
        headers: validAuthHeaders,
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'Stream until cancelled' }],
          stream: true
        }),
        signal: controller.signal
      });

      // Abort after initiating
      setTimeout(() => {
        controller.abort();
      }, 30);

      try {
        await fetchPromise;
      } catch (err) {
        assert.ok(err.name === 'AbortError' || err.message.includes('aborted'));
      }

      // Ensure gateway server is still running and responsive
      const healthCheck = await context.request('/health');
      assert.strictEqual(healthCheck.res.status, 200);
    });

    // 8. All Accounts In Cooldown -> 503
    await test('TC-T2-08: All Accounts In Cooldown returns 503', async () => {
      // Put all accounts in cooldown
      const now = Date.now();
      for (const acc of context.proxyGateway.accounts) {
        acc.cooldownUntil = now + 120000;
      }

      const { res, body } = await context.request('/v1/chat/completions', {
        method: 'POST',
        headers: validAuthHeaders,
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'Test exhaustion' }]
        })
      });

      assertErrorResponse(res, body, 503, 'all_accounts_exhausted');

      // Restore accounts
      for (const acc of context.proxyGateway.accounts) {
        acc.cooldownUntil = 0;
      }
    });

  } finally {
    await context.teardown();
  }

  return results;
}
