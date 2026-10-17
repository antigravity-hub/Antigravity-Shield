/**
 * Domain-Specific Assertions for Antigravity Shield API Proxy Test Suite
 */

import assert from 'node:assert';

export function assertOpenAIChatResponse(res, body) {
  assert.strictEqual(res.status, 200, `Expected HTTP 200, got ${res.status}: ${JSON.stringify(body)}`);
  assert.ok(body.id && body.id.startsWith('chatcmpl-'), `Expected chatcmpl- id, got ${body.id}`);
  assert.strictEqual(body.object, 'chat.completion');
  assert.ok(Array.isArray(body.choices) && body.choices.length > 0, 'Choices must be non-empty array');
  const firstChoice = body.choices[0];
  assert.strictEqual(firstChoice.message?.role, 'assistant');
  assert.ok(typeof firstChoice.message?.content === 'string', 'Message content must be string');
  assert.ok(body.usage && typeof body.usage.total_tokens === 'number', 'Usage with total_tokens required');
}

export function assertOpenAIStreamChunks(chunks) {
  assert.ok(chunks.length > 0, 'Stream must produce at least one chunk');
  for (const chunk of chunks) {
    assert.ok(chunk.id && chunk.id.startsWith('chatcmpl-'), 'Chunk id missing');
    assert.strictEqual(chunk.object, 'chat.completion.chunk');
    assert.ok(Array.isArray(chunk.choices), 'Chunk choices missing');
  }
}

export function assertClaudeResponse(res, body) {
  assert.strictEqual(res.status, 200, `Expected HTTP 200, got ${res.status}: ${JSON.stringify(body)}`);
  assert.ok(body.id && body.id.startsWith('msg_'), `Expected msg_ id, got ${body.id}`);
  assert.strictEqual(body.type, 'message');
  assert.strictEqual(body.role, 'assistant');
  assert.ok(Array.isArray(body.content) && body.content.length > 0, 'Content must be non-empty array');
  assert.ok(body.usage && typeof body.usage.output_tokens === 'number', 'Usage metrics required');
}

export function assertClaudeStreamEvents(events) {
  assert.ok(events.length > 0, 'Claude stream must emit events');
  const eventTypes = events.map(e => e.type || e.event);
  assert.ok(eventTypes.includes('message_start'), 'Must include message_start');
  assert.ok(eventTypes.includes('message_stop'), 'Must include message_stop');
}

export function assertModelListing(res, body, expectedModelIds = []) {
  assert.strictEqual(res.status, 200, `Expected HTTP 200, got ${res.status}`);
  assert.strictEqual(body.object, 'list');
  assert.ok(Array.isArray(body.data), 'Data must be array of models');
  const ids = body.data.map(m => m.id);
  for (const exp of expectedModelIds) {
    assert.ok(ids.includes(exp), `Model list missing expected model: ${exp}`);
  }
}

export function assertErrorResponse(res, body, expectedStatus, expectedCode = null) {
  assert.strictEqual(res.status, expectedStatus, `Expected HTTP ${expectedStatus}, got ${res.status}`);
  assert.ok(body.error, 'Error object missing in response');
  assert.ok(typeof body.error.message === 'string', 'Error message missing');
  if (expectedCode) {
    assert.strictEqual(body.error.code, expectedCode, `Expected error code ${expectedCode}, got ${body.error.code}`);
  }
}
