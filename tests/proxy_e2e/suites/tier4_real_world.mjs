/**
 * Tier 4: Real-World Scenarios Simulation
 *
 * Simulates high-fidelity production agent sessions:
 * - Cursor AI Agent payload simulation (OpenAI multi-turn with tool calls and file context)
 * - Claude Code CLI message session simulation (Anthropic protocol with system prompts and thinking)
 * - Windsurf Cascade completion simulation (Streaming code generation)
 * - Python SDK client format simulation (Official openai library parameters)
 */

import assert from 'node:assert';
import { TestContext } from '../harness/test_context.mjs';
import { assertOpenAIChatResponse, assertClaudeResponse } from '../harness/assertions.mjs';

export async function runTier4Tests() {
  const context = new TestContext();
  await context.setup();

  const results = {
    name: 'tier4_real_world.mjs',
    tier: 'Tier 4: Real-World Scenarios',
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
    // 1. Cursor AI Agent Payload Simulation
    await test('TC-T4-01: Cursor AI Agent Multi-Turn Payload Simulation', async () => {
      const cursorPayload = {
        model: 'gemini-3.8-flash', // Cursor using custom alias
        messages: [
          {
            role: 'system',
            content: 'You are Cursor, an expert AI programming assistant. Be concise.'
          },
          {
            role: 'user',
            content: 'Inspect src-tauri/src/main.rs and refactor error handling.'
          },
          {
            role: 'assistant',
            content: 'I will read the file first to analyze the error types.'
          },
          {
            role: 'user',
            content: 'Proceed with the refactoring now.'
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'edit_file',
              description: 'Applies diff patch to file',
              parameters: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  diff: { type: 'string' }
                },
                required: ['path', 'diff']
              }
            }
          }
        ],
        temperature: 0.2,
        stream: false
      };

      const { res, body } = await context.request('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Cursor/0.45.0 (Windows_NT x64)'
        },
        body: JSON.stringify(cursorPayload)
      });

      assertOpenAIChatResponse(res, body);
      assert.strictEqual(body.choices[0].finish_reason, 'stop');

      // Verify upstream normalized alias
      const lastReq = context.mockUpstream.recordedRequests.at(-1);
      assert.strictEqual(lastReq.body.model, 'gemini-3-flash');
    });

    // 2. Claude Code CLI Message Session Simulation
    await test('TC-T4-02: Claude Code CLI Message Session Simulation', async () => {
      const claudeCodePayload = {
        model: 'claude-sonnet-4-6',
        system: 'You are Claude Code, Anthropic official CLI tool for software engineering.',
        messages: [
          {
            role: 'user',
            content: 'Run cargo check and fix any compiler warnings.'
          }
        ],
        max_tokens: 4096,
        thinking: {
          type: 'enabled',
          budget_tokens: 2048
        },
        stream: false
      };

      const { res, body } = await context.request('/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'User-Agent': 'claude-code-cli/1.2.0'
        },
        body: JSON.stringify(claudeCodePayload)
      });

      assertClaudeResponse(res, body);
      assert.strictEqual(body.model, 'claude-sonnet-4-6');
      assert.strictEqual(body.type, 'message');
    });

    // 3. Windsurf Cascade Completion Simulation
    await test('TC-T4-03: Windsurf Cascade Streaming Code Generation Simulation', async () => {
      const windsurfPayload = {
        model: 'gpt-4o-mini', // Windsurf configured model
        messages: [
          {
            role: 'system',
            content: 'You are Windsurf Cascade assistant.'
          },
          {
            role: 'user',
            content: 'Generate a fast Axum health check handler.'
          }
        ],
        stream: true,
        temperature: 0.1
      };

      const { res, chunks, events } = await context.consumeSSE('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Windsurf/1.0.0 Codeium'
        },
        body: JSON.stringify(windsurfPayload)
      });

      assert.strictEqual(res.status, 200);
      assert.ok(chunks.length > 0);
      assert.ok(events.some(e => e.data === '[DONE]'));

      // Verify model alias resolution gpt-4o-mini -> gemini-2.5-flash
      const lastReq = context.mockUpstream.recordedRequests.at(-1);
      assert.strictEqual(lastReq.body.model, 'gemini-2.5-flash');
    });

    // 4. Official Python SDK Client Payload Simulation
    await test('TC-T4-04: Official Python OpenAI SDK Payload Simulation', async () => {
      // Shape emitted by `openai.OpenAI().chat.completions.create(...)`
      const pythonSdkPayload = {
        messages: [
          { role: 'user', content: 'What is the speed of light?' }
        ],
        model: 'gemini-2.5-flash',
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        temperature: 1.0,
        top_p: 1.0,
        user: 'python-sdk-test-user-id'
      };

      const { res, body } = await context.request('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'OpenAI/Python 1.58.0'
        },
        body: JSON.stringify(pythonSdkPayload)
      });

      assertOpenAIChatResponse(res, body);
      assert.ok(body.created > 0);
      assert.strictEqual(body.object, 'chat.completion');
    });

  } finally {
    await context.teardown();
  }

  return results;
}
