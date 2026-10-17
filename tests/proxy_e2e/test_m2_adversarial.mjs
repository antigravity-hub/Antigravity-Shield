import assert from 'node:assert';
import { TestContext } from './harness/test_context.mjs';

async function main() {
  console.log('Testing model aliases against ProxyGateway...');
  const context = new TestContext();
  await context.setup();

  const modelsToTest = [
    { input: 'gemini-3.8-flash', expected: 'gemini-3-flash' },
    { input: 'gemini-3.8-flash-medium', expected: 'gemini-3-flash' },
    { input: 'gemini-3.8-flash-high', expected: 'gemini-3-flash' },
    { input: 'gpt-4o-mini', expected: 'gemini-2.5-flash' },
  ];

  for (const { input, expected } of modelsToTest) {
    console.log(`Sending request with model: ${input}`);
    const { res, body } = await context.request('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: input,
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false
      })
    });

    const lastReq = context.mockUpstream.recordedRequests.at(-1);
    console.log(`Model input: ${input} -> Upstream received: ${lastReq?.body?.model}`);
    try {
      assert.strictEqual(lastReq.body.model, expected, `Expected ${input} to be mapped to ${expected}`);
      console.log(`  [PASS] ${input} -> ${expected}`);
    } catch (e) {
      console.error(`  [FAIL] ${e.message}`);
    }
  }

  await context.teardown();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
