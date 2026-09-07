import test from 'node:test';
import { assertEqual, assertTrue, assertFalse, assertDeepEqual } from '../harness/assertions';

export interface ContentPart {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
}

export interface ContentMessage {
  role: 'user' | 'model' | 'assistant';
  parts: ContentPart[];
}

export interface RecoveredToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface RecoveryResult {
  isToolCall: boolean;
  toolCall?: RecoveredToolCall;
  textFallback: string;
}

/**
 * High-fidelity TypeScript implementation of Antigravity-Shield's
 * strip_all_thinking_blocks (openai/thinking_recovery.rs:4-25, Feature 9).
 */
export function stripAllThinkingBlocks(contents: ContentMessage[]): ContentMessage[] {
  return contents
    .map((content) => {
      const filteredParts = content.parts.filter((part) => !part.thought);
      return {
        role: content.role,
        parts: filteredParts,
      };
    })
    .filter((msg) => msg.parts.length > 0);
}

/**
 * High-fidelity TypeScript implementation of Antigravity-Shield's
 * call:default_api:* recovery bridge (claude/response.rs:446-525 & Feature 10, Issue #3379).
 */
export function recoverCallDefaultApi(
  text: string,
  registeredToolNames: string[]
): RecoveryResult {
  const trimmed = text.trim();
  const PREFIX = 'call:default_api:';

  if (!registeredToolNames.length || !trimmed.startsWith(PREFIX)) {
    return { isToolCall: false, textFallback: text };
  }

  const rest = trimmed.slice(PREFIX.length);
  let toolEnd = rest.length;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '{' || rest[i] === '(') {
      toolEnd = i;
      break;
    }
  }

  const toolName = rest.slice(0, toolEnd).trim();
  const argsStr = rest.slice(toolEnd).trim();

  if (!toolName) {
    return { isToolCall: false, textFallback: text };
  }

  // Guard: Check whitelist (case-insensitive)
  const matchedName = registeredToolNames.find(
    (n) => n.toLowerCase() === toolName.toLowerCase()
  );

  if (!matchedName) {
    return { isToolCall: false, textFallback: text };
  }

  // Guard: Parse arguments JSON
  let parsedArgs: Record<string, unknown> = {};
  if (argsStr.length > 0) {
    try {
      const parsed = JSON.parse(argsStr);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        parsedArgs = parsed as Record<string, unknown>;
      } else {
        return { isToolCall: false, textFallback: text };
      }
    } catch {
      // Fail-closed on invalid JSON
      return { isToolCall: false, textFallback: text };
    }
  }

  const toolId = matchedName + '-3379-mock-id';
  return {
    isToolCall: true,
    toolCall: {
      id: toolId,
      name: matchedName,
      args: parsedArgs,
    },
    textFallback: '',
  };
}

test('Feature 9 & 10: Thinking Token Pruning & Gemini 3.7 Tool Recovery Bridge', async (t) => {
  await t.test('TC-T1-F09-01: stripAllThinkingBlocks strips all historical thought blocks cleanly', () => {
    const messages: ContentMessage[] = [
      {
        role: 'user',
        parts: [{ text: 'Solve this problem.' }],
      },
      {
        role: 'model',
        parts: [
          { text: 'Let me think deeply...', thought: true, thoughtSignature: 'sig123' },
          { text: 'Here is the final answer.', thought: false },
        ],
      },
    ];

    const stripped = stripAllThinkingBlocks(messages);
    assertEqual(stripped.length, 2);
    assertEqual(stripped[1].parts.length, 1);
    assertEqual(stripped[1].parts[0].text, 'Here is the final answer.');
    assertFalse(Boolean(stripped[1].parts[0].thought));
  });

  await t.test('TC-T1-F09-02: Message with only thinking blocks is pruned completely to avoid token waste', () => {
    const messages: ContentMessage[] = [
      {
        role: 'model',
        parts: [{ text: 'Intermediate internal reasoning', thought: true }],
      },
    ];

    const stripped = stripAllThinkingBlocks(messages);
    assertEqual(stripped.length, 0);
  });

  await t.test('TC-T1-F10-01: recoverCallDefaultApi recovers plaintext pseudocode into structured tool call', () => {
    const rawOutput = 'call:default_api:run_command{"CommandLine":"cargo test","Cwd":"src-tauri"}';
    const registered = ['run_command', 'read_file', 'grep'];

    const result = recoverCallDefaultApi(rawOutput, registered);
    assertTrue(result.isToolCall);
    assertTrue(result.toolCall !== undefined);
    assertEqual(result.toolCall?.name, 'run_command');
    assertEqual(result.toolCall?.args.CommandLine, 'cargo test');
    assertEqual(result.toolCall?.args.Cwd, 'src-tauri');
  });

  await t.test('TC-T1-F10-02: Unregistered tool is NOT promoted to tool call and stays as text', () => {
    const rawOutput = 'call:default_api:unauthorized_dangerous_tool{"arg":1}';
    const registered = ['run_command', 'read_file'];

    const result = recoverCallDefaultApi(rawOutput, registered);
    assertFalse(result.isToolCall);
    assertEqual(result.textFallback, rawOutput);
  });

  await t.test('TC-T1-F10-03: Malformed JSON arguments fail closed and preserve text safely', () => {
    const rawOutput = 'call:default_api:run_command{invalid json broken syntax';
    const registered = ['run_command', 'read_file'];

    const result = recoverCallDefaultApi(rawOutput, registered);
    assertFalse(result.isToolCall, 'Must fail closed on malformed JSON');
    assertEqual(result.textFallback, rawOutput);
  });

  await t.test('TC-T1-F10-04: Empty args object call:default_api:read_file{} produces valid empty object args', () => {
    const rawOutput = 'call:default_api:read_file{}';
    const registered = ['read_file'];

    const result = recoverCallDefaultApi(rawOutput, registered);
    assertTrue(result.isToolCall);
    assertEqual(result.toolCall?.name, 'read_file');
    assertDeepEqual(result.toolCall?.args, {});
  });
});
