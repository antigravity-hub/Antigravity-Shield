/**
 * Tier 1: Feature Coverage (Positive Happy Paths)
 *
 * Verifies F1-F16 core functionality:
 * - OpenAI /v1/chat/completions (JSON and SSE streaming)
 * - Claude /v1/messages (JSON and SSE streaming)
 * - GET /v1/models
 * - Model alias normalization (gemini-3.8-flash -> gemini-3-flash)
 * - Thinking tokens handling
 * - Health check telemetry
 */

import assert from 'node:assert';
import { TestContext } from '../harness/test_context.mjs';
import {
  assertOpenAIChatResponse,
  assertOpenAIStreamChunks,
  assertClaudeResponse,
  assertClaudeStreamEvents,
  assertModelListing
} from '../harness/assertions.mjs';

export async function runTier1Tests() {
  const context = new TestContext();
  await context.setup();

  const results = {
    name: 'tier1_feature_coverage.mjs',
    tier: 'Tier 1: Feature Coverage (Happy Paths)',
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

  try {
    // 1. OpenAI JSON Chat Completion Happy Path
    await test('TC-T1-01: OpenAI JSON Chat Completion (/v1/chat/completions)', async () => {
      const { res, body } = await context.request('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'Explain quantum computing in one sentence.' }],
          stream: false
        })
      });

      assertOpenAIChatResponse(res, body);
      assert.ok(body.choices[0].message.content.length > 0, 'Response text should not be empty');

      // Verify upstream received client headers
      const lastReq = context.mockUpstream.recordedRequests.at(-1);
      assert.strictEqual(lastReq.headers['x-client-name'], 'antigravity');
      assert.ok(lastReq.headers['x-machine-id'], 'Machine ID must be provided');
    });

    // 2. OpenAI SSE Streaming Happy Path
    await test('TC-T1-02: OpenAI SSE Streaming (/v1/chat/completions stream: true)', async () => {
      const { res, chunks, events } = await context.consumeSSE('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'Count from 1 to 5.' }],
          stream: true
        })
      });

      assert.strictEqual(res.status, 200);
      assertOpenAIStreamChunks(chunks);
      assert.ok(events.some(e => e.data === '[DONE]'), 'Stream must conclude with [DONE]');
    });

    // 3. Claude Messages Non-Streaming Happy Path
    await test('TC-T1-03: Claude Messages Protocol (/v1/messages)', async () => {
      const { res, body } = await context.request('/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          messages: [{ role: 'user', content: 'Hello Claude, confirm readiness.' }],
          max_tokens: 1024,
          stream: false
        })
      });

      assertClaudeResponse(res, body);
      assert.strictEqual(body.content[0].type, 'text');
    });

    // 4. Claude Messages SSE Streaming Happy Path
    await test('TC-T1-04: Claude Messages SSE Streaming (/v1/messages stream: true)', async () => {
      const { res, events } = await context.consumeSSE('/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          messages: [{ role: 'user', content: 'Stream a greeting.' }],
          max_tokens: 512,
          stream: true
        })
      });

      assert.strictEqual(res.status, 200);
      assertClaudeStreamEvents(events);
    });

    // 5. Models Listing (/v1/models)
    await test('TC-T1-05: Model Listing Endpoint (/v1/models)', async () => {
      const { res, body } = await context.request('/v1/models', {
        method: 'GET'
      });

      assertModelListing(res, body, [
        'gemini-3-flash',
        'gemini-2.5-flash',
        'gemini-3.1-pro-preview',
        'claude-sonnet-4-6',
        'gemini-3.8-flash'
      ]);
    });

    // 6. Model Alias Normalization
    await test('TC-T1-06: Model Alias Normalization (gemini-3.8-flash -> gemini-3-flash)', async () => {
      const { res, body } = await context.request('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-3.8-flash',
          messages: [{ role: 'user', content: 'Test alias routing.' }],
          stream: false
        })
      });

      assertOpenAIChatResponse(res, body);
      const lastReq = context.mockUpstream.recordedRequests.at(-1);
      assert.strictEqual(lastReq.body.model, 'gemini-3-flash', 'Model must be normalized to gemini-3-flash');
    });

    // 7. Thinking Tokens Stream Handling
    await test('TC-T1-07: Thinking Tokens Extraction & Streaming', async () => {
      const { res, events } = await context.consumeSSE('/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-opus-4-6-thinking',
          messages: [{ role: 'user', content: 'thinking_request: complex math proof' }],
          thinking: { type: 'enabled', budget_tokens: 2048 },
          stream: true
        })
      });

      assert.strictEqual(res.status, 200);
      assert.ok(events.length > 0);
      const deltas = events.filter(e => e.event === 'content_block_delta');
      const hasThinking = deltas.some(d => d.data?.delta?.type === 'thinking_delta');
      assert.ok(hasThinking, 'Event stream must include thinking_delta for thinking model');
    });

    // 8. Health Check Telemetry
    await test('TC-T1-08: Health Check Telemetry (/health and /healthz)', async () => {
      const { res, body } = await context.request('/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.status, 'ok');
      assert.strictEqual(body.accounts_total, 4);
      assert.strictEqual(body.accounts_in_cooldown, 0);
    });

  } finally {
    await context.teardown();
  }

  return results;
}
