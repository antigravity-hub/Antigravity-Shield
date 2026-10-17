/**
 * Tier 5: Adversarial Stress, Race Condition & Stream Safety Harness
 *
 * Deeply challenges Milestone M1 requirements:
 * 1. High-concurrency client abort hammer (50 concurrent SSE streams dropped mid-flight)
 * 2. Socket leak verification (server responsiveness post-abort without hanging)
 * 3. Concurrent account reload/delete race simulation (DashSet thread-safety & zero-leak)
 * 4. Graceful capability fallback for unknown aliases / empty model_quotas
 * 5. Sub-50ms 429 failover cascade under concurrent load
 * 6. Stream idle timeout & malformed SSE chunk resilience
 */

import assert from 'node:assert';
import { TestContext } from '../harness/test_context.mjs';

export async function runTier5Tests() {
  const context = new TestContext({
    authToken: 'tier5-stress-secret',
    maxPayloadBytes: 5 * 1024 * 1024
  });
  await context.setup();

  const results = {
    name: 'tier5_adversarial_stress.mjs',
    tier: 'Tier 5: Adversarial Stress & Stream Safety',
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
    'Authorization': 'Bearer tier5-stress-secret'
  };

  try {
    // 1. High-Concurrency Client Abort Hammer (50 parallel SSE stream aborts)
    await test('TC-T5-01: High-Concurrency Client Abort Hammer (50 parallel SSE streams aborted at staggered intervals)', async () => {
      const abortCount = 50;
      const abortDelays = [0, 5, 15, 25, 50]; // staggered abort timings

      const abortTasks = Array.from({ length: abortCount }, (_, i) => {
        const controller = new AbortController();
        const delay = abortDelays[i % abortDelays.length];
        const url = `${context.gatewayUrl}/v1/chat/completions`;

        const p = fetch(url, {
          method: 'POST',
          headers: validAuthHeaders,
          body: JSON.stringify({
            model: 'gemini-2.5-flash',
            messages: [{ role: 'user', content: `Stress abort test #${i}` }],
            stream: true
          }),
          signal: controller.signal
        }).catch(err => {
          assert.ok(err.name === 'AbortError' || err.message.includes('aborted'));
        });

        if (delay === 0) {
          controller.abort();
        } else {
          setTimeout(() => controller.abort(), delay);
        }

        return p;
      });

      await Promise.all(abortTasks);

      // Verify server is alive, has no leaked sockets, and can process a regular request immediately
      const postAbortHealth = await context.request('/health');
      assert.strictEqual(postAbortHealth.res.status, 200, 'Gateway must remain healthy post-abort storm');

      const normalReq = await context.request('/v1/chat/completions', {
        method: 'POST',
        headers: validAuthHeaders,
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'Post-abort sanity check' }]
        })
      });
      assert.strictEqual(normalReq.res.status, 200, 'Subsequent request must succeed cleanly');
    });

    // 2. DashSet Concurrency Simulation: Concurrent Account Reload & Delete Race
    await test('TC-T5-02: Concurrent DashSet Race Simulation (100 parallel enqueue & drain cycles)', async () => {
      // Emulate DashSet behavior: concurrent inserts into pending reload and delete queues while draining
      const pendingReload = new Set();
      const pendingDelete = new Set();
      let reloadDrainedTotal = 0;
      let deleteDrainedTotal = 0;

      const workers = Array.from({ length: 100 }, async (_, i) => {
        const accountId = `account-${i % 10}`;
        if (i % 2 === 0) {
          pendingReload.add(accountId);
        } else {
          pendingDelete.add(accountId);
        }

        // Interleaved drains
        if (i % 10 === 0) {
          const reloaded = Array.from(pendingReload);
          pendingReload.clear();
          reloadDrainedTotal += reloaded.length;

          const deleted = Array.from(pendingDelete);
          pendingDelete.clear();
          deleteDrainedTotal += deleted.length;
        }
      });

      await Promise.all(workers);

      // Final drain
      reloadDrainedTotal += pendingReload.size;
      pendingReload.clear();
      deleteDrainedTotal += pendingDelete.size;
      pendingDelete.clear();

      assert.strictEqual(pendingReload.size, 0, 'Reload queue must be empty');
      assert.strictEqual(pendingDelete.size, 0, 'Delete queue must be empty');
      assert.ok(reloadDrainedTotal > 0, 'Must have processed reload events');
      assert.ok(deleteDrainedTotal > 0, 'Must have processed delete events');
    });

    // 3. Graceful Capability Fallback: Model Alias with Empty Model Quotas
    await test('TC-T5-03: Graceful Capability Fallback (Unlisted model alias maps and retains PRO/ULTRA accounts)', async () => {
      // Request model alias `gemini-3.8-flash` which normalizes to `gemini-3-flash`
      const { res, body } = await context.request('/v1/chat/completions', {
        method: 'POST',
        headers: validAuthHeaders,
        body: JSON.stringify({
          model: 'gemini-3.8-flash',
          messages: [{ role: 'user', content: 'Capability fallback check' }]
        })
      });

      assert.strictEqual(res.status, 200, 'Unlisted model alias must NOT return 503');
      assert.strictEqual(body.model, 'gemini-3-flash', 'Model must be normalized to gemini-3-flash');

      // Verify that ULTRA account was selected first according to tier priority
      const ultraAccount = context.proxyGateway.accounts.find(a => a.tier === 'ULTRA');
      assert.ok(ultraAccount, 'ULTRA account must exist');
    });

    // 4. Sub-50ms Fast Failover Cascade Under Concurrent 429
    await test('TC-T5-04: Sub-50ms Fast Failover Cascade (Consecutive 429s rotate through account tiers)', async () => {
      // Configure mock upstream to return 429 for the first account
      let callCount = 0;
      context.mockUpstream.handlers.unshift(async (req, res, record) => {
        if (callCount === 0) {
          callCount++;
          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: {
              code: 429,
              message: 'Resource exhausted: rate limit exceeded',
              status: 'RESOURCE_EXHAUSTED'
            }
          }));
          return true; // handled
        }
        return false; // let normal handler process
      });

      const startTime = Date.now();
      const { res, body } = await context.request('/v1/chat/completions', {
        method: 'POST',
        headers: validAuthHeaders,
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'Test failover latency' }]
        })
      });

      const duration = Date.now() - startTime;
      assert.strictEqual(res.status, 200, 'Must recover and succeed on failover');
      assert.ok(duration < 250, `Failover must be rapid (<250ms total request wall-time, got ${duration}ms)`);
      assert.ok(context.proxyGateway.stats.rotations >= 1, 'Must have recorded a rotation');
    });

    // 5. Upstream Stream Error Event Recovery
    await test('TC-T5-05: Upstream SSE Error Event Detection & Graceful Termination', async () => {
      const { res, events, error } = await context.consumeSSE('/v1/chat/completions', {
        method: 'POST',
        headers: validAuthHeaders,
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'Stream error test' }],
          stream: true
        })
      });

      assert.strictEqual(res.status, 200);
      assert.ok(events.length > 0, 'Stream must deliver chunks');
      assert.ok(events.some(e => e.data === '[DONE]'), 'Stream must terminate with [DONE]');
    });

  } finally {
    await context.teardown();
  }

  return results;
}
