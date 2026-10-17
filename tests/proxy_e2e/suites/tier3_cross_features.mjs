/**
 * Tier 3: Cross-Feature Combinations
 *
 * Verifies compound emergent behavior across subsystem boundaries:
 * - Streaming SSE + Tool Calls Translation
 * - Model Alias Resolution + 429 Cooldown Failover
 * - Thinking Budget + Streaming Chunks
 * - Multi-turn Context Thinking Pruning
 */

import assert from 'node:assert';
import { TestContext } from '../harness/test_context.mjs';

export async function runTier3Tests() {
  const context = new TestContext();
  await context.setup();

  const results = {
    name: 'tier3_cross_features.mjs',
    tier: 'Tier 3: Cross-Feature Combinations',
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
    // 1. Streaming SSE + Tool Calls
    await test('TC-T3-01: Streaming SSE + Tool Calls Delta Translation', async () => {
      const { res, chunks } = await context.consumeSSE('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'tool_request: read file src/main.rs' }],
          tools: [{
            type: 'function',
            function: {
              name: 'read_file',
              description: 'Read file contents',
              parameters: { type: 'object', properties: { path: { type: 'string' } } }
            }
          }],
          stream: true
        })
      });

      assert.strictEqual(res.status, 200);
      assert.ok(chunks.length > 0);

      // Check if any chunk contained tool_calls
      const toolChunk = chunks.find(c => c.choices?.[0]?.delta?.tool_calls);
      assert.ok(toolChunk, 'Stream must emit tool_calls delta chunk');
      const tc = toolChunk.choices[0].delta.tool_calls[0];
      assert.strictEqual(tc.function.name, 'read_file');
      assert.ok(tc.function.arguments.includes('src/main.rs'));
    });

    // 2. Model Alias Resolution + 429 Cooldown Failover
    await test('TC-T3-02: Model Alias Resolution + 429 Cooldown Failover', async () => {
      // Configure mock upstream to reject first account with 429
      let rejectedFirst = false;
      context.mockUpstream.registerHandler((req, res, record) => {
        if (!rejectedFirst) {
          rejectedFirst = true;
          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'Quota exhausted for top priority account' } }));
          return true;
        }
        return false;
      });

      const { res, body } = await context.request('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-3.8-flash', // Alias!
          messages: [{ role: 'user', content: 'Compound test' }],
          stream: false
        })
      });

      assert.strictEqual(res.status, 200, 'Request with alias must succeed despite 429 failover');
      assert.strictEqual(body.object, 'chat.completion');

      // Verify that model alias was resolved to gemini-3-flash in upstream request
      const lastReq = context.mockUpstream.recordedRequests.at(-1);
      assert.strictEqual(lastReq.body.model, 'gemini-3-flash', 'Model must be normalized');

      // Verify rotation happened
      assert.ok(context.proxyGateway.stats.rotations >= 1, 'Rotation must be recorded');
    });

    // 3. Thinking Budget + Streaming Chunks
    await test('TC-T3-03: Thinking Budget + Claude Streaming Sequence', async () => {
      const { res, events } = await context.consumeSSE('/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-opus-4-6-thinking',
          messages: [{ role: 'user', content: 'thinking_request: prove theorem' }],
          thinking: { type: 'enabled', budget_tokens: 2048 },
          stream: true
        })
      });

      assert.strictEqual(res.status, 200);

      // Verify event sequence: message_start -> content_block_start (thinking) -> content_block_delta -> content_block_stop -> message_delta -> message_stop
      const eventNames = events.map(e => e.event);
      assert.ok(eventNames.includes('message_start'));
      assert.ok(eventNames.includes('content_block_start'));
      assert.ok(eventNames.includes('content_block_delta'));
      assert.ok(eventNames.includes('content_block_stop'));
      assert.ok(eventNames.includes('message_stop'));

      const startBlock = events.find(e => e.event === 'content_block_start');
      assert.strictEqual(startBlock.data.content_block.type, 'thinking');
    });

    // 4. Multi-Turn Context Pruning
    await test('TC-T3-04: Multi-Turn Context Payload Handling', async () => {
      const { res, body } = await context.request('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [
            { role: 'user', content: 'Turn 1 user' },
            { role: 'assistant', content: 'Turn 1 response' },
            { role: 'user', content: 'Turn 2 user' }
          ],
          stream: false
        })
      });

      assert.strictEqual(res.status, 200);
      const lastReq = context.mockUpstream.recordedRequests.at(-1);
      assert.strictEqual(lastReq.body.contents.length, 3, 'Must forward 3 turns properly mapped to Gemini format');
    });

  } finally {
    await context.teardown();
  }

  return results;
}
