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
  prose?: string;
  textFallback: string;
}

/**
 * High-fidelity TypeScript implementation of Antigravity-Shield's
 * strip_all_thinking_blocks (openai/thinking_recovery.rs:4-25, Feature 9).
 * Unconditionally prunes historical reasoning blocks (thought: true) across past turns
 * to prevent 400K -> 1M+ token Cartesian explosions (Issue #3325).
 */
export function stripAllThinkingBlocks(contents: ContentMessage[]): ContentMessage[] {
  return contents
    .map((content, idx) => {
      const isLatestTurn = idx === contents.length - 1;
      const filteredParts = content.parts.filter((part) => {
        if (!part.thought) return true;
        // If it's the latest turn and has a signature, preserve for verification
        if (isLatestTurn && part.thoughtSignature) return true;
        return false;
      });
      return {
        role: content.role,
        parts: filteredParts,
      };
    })
    .filter((msg) => msg.parts.length > 0);
}

/**
 * High-fidelity TypeScript implementation of Antigravity-Shield's
 * call:default_api:* pseudo-code recovery bridge (claude/response.rs & openai/response.rs, Feature 10, Issue #3379).
 * Recovers Gemini 3.7 plaintext pseudocode leaks into structured OpenAI/Claude tool_calls.
 */
export function recoverCallDefaultApi(
  text: string,
  registeredToolNames: string[]
): RecoveryResult {
  const trimmed = text.trim();
  const PREFIX = 'call:default_api:';

  // Guard against markdown code blocks: if pseudocode is inside ```, leave it as literal code
  if (trimmed.startsWith('```') || trimmed.includes('```call:default_api:')) {
    return { isToolCall: false, textFallback: text };
  }

  const prefixIdx = trimmed.indexOf(PREFIX);
  if (prefixIdx === -1 || !registeredToolNames.length) {
    return { isToolCall: false, textFallback: text };
  }

  const prose = prefixIdx > 0 ? trimmed.slice(0, prefixIdx).trim() : undefined;
  const rest = trimmed.slice(prefixIdx + PREFIX.length);

  let toolEnd = rest.length;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '{' || rest[i] === '(') {
      toolEnd = i;
      break;
    }
  }

  const toolName = rest.slice(0, toolEnd).trim();
  let argsStr = rest.slice(toolEnd).trim();

  if (!toolName) {
    return { isToolCall: false, textFallback: text };
  }

  // Normalize parentheses syntax to JSON object if needed: (arg: val) -> {arg: val}
  if (argsStr.startsWith('(') && argsStr.endsWith(')')) {
    argsStr = '{' + argsStr.slice(1, -1) + '}';
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

  const toolId = matchedName + '-3379-recovered-' + Date.now();
  return {
    isToolCall: true,
    toolCall: {
      id: toolId,
      name: matchedName,
      args: parsedArgs,
    },
    prose,
    textFallback: '',
  };
}

test('Feature 9 & 10: Thinking Token Pruning & Gemini 3.7 Tool Leak Recovery Bridge', async (t) => {
  await t.test('TC-T1-F09-01: Historical thinking blocks are pruned unconditionally from earlier turns', () => {
    const messages: ContentMessage[] = [
      {
        role: 'user',
        parts: [{ text: 'Investigate the codebase bug.' }],
      },
      {
        role: 'model',
        parts: [
          { text: 'Thinking about file locks...', thought: true, thoughtSignature: 'sig1' },
          { text: 'The bug is in token_manager.rs', thought: false },
        ],
      },
      {
        role: 'user',
        parts: [{ text: 'Please fix it.' }],
      },
    ];

    const pruned = stripAllThinkingBlocks(messages);
    assertEqual(pruned.length, 3);
    assertEqual(pruned[1].parts.length, 1);
    assertEqual(pruned[1].parts[0].text, 'The bug is in token_manager.rs');
    assertFalse(Boolean(pruned[1].parts[0].thought));
  });

  await t.test('TC-T1-F09-02: Latest active turn preserves cryptographic thoughtSignature', () => {
    const messages: ContentMessage[] = [
      {
        role: 'model',
        parts: [
          { text: 'Active reasoning in flight...', thought: true, thoughtSignature: 'valid-hmac-sig-998' },
        ],
      },
    ];

    const pruned = stripAllThinkingBlocks(messages);
    assertEqual(pruned.length, 1);
    assertEqual(pruned[0].parts[0].thoughtSignature, 'valid-hmac-sig-998');
  });

  await t.test('TC-T1-F09-03: 100 consecutive thinking blocks stripped in single pass without stack overflow', () => {
    const parts: ContentPart[] = Array.from({ length: 100 }, (_, i) => ({
      text: 'Reasoning step ' + i,
      thought: true,
    }));
    parts.push({ text: 'Final answer', thought: false });

    const messages: ContentMessage[] = [
      { role: 'model', parts },
      { role: 'user', parts: [{ text: 'Next' }] },
    ];

    const pruned = stripAllThinkingBlocks(messages);
    assertEqual(pruned[0].parts.length, 1);
    assertEqual(pruned[0].parts[0].text, 'Final answer');
  });

  await t.test('TC-T1-F10-01: Standard pseudocode call:default_api:run_command is recovered into structured tool_call', () => {
    const rawOutput = 'call:default_api:run_command{"CommandLine":"cargo test","Cwd":"src-tauri"}';
    const registered = ['run_command', 'read_file', 'grep_search'];

    const result = recoverCallDefaultApi(rawOutput, registered);
    assertTrue(result.isToolCall);
    assertTrue(result.toolCall !== undefined);
    assertEqual(result.toolCall?.name, 'run_command');
    assertEqual(result.toolCall?.args.CommandLine, 'cargo test');
    assertEqual(result.toolCall?.args.Cwd, 'src-tauri');
  });

  await t.test('TC-T1-F10-02: Parentheses BNF syntax call:default_api:read_file("path":"src/main.rs") recovered', () => {
    const rawOutput = 'call:default_api:read_file("path":"src/main.rs")';
    const registered = ['read_file'];

    const result = recoverCallDefaultApi(rawOutput, registered);
    assertTrue(result.isToolCall);
    assertEqual(result.toolCall?.name, 'read_file');
    assertEqual(result.toolCall?.args.path, 'src/main.rs');
  });

  await t.test('TC-T1-F10-03: Conversational prose preceding tool call is cleanly split and preserved', () => {
    const rawOutput = 'I will now run the tests to verify.\ncall:default_api:run_command{"CommandLine":"npm test"}';
    const registered = ['run_command'];

    const result = recoverCallDefaultApi(rawOutput, registered);
    assertTrue(result.isToolCall);
    assertEqual(result.prose, 'I will now run the tests to verify.');
    assertEqual(result.toolCall?.name, 'run_command');
    assertEqual(result.toolCall?.args.CommandLine, 'npm test');
  });

  await t.test('TC-T1-F10-04: Unregistered tool names fail closed and stay as text fallback', () => {
    const rawOutput = 'call:default_api:delete_system_disk{"force":true}';
    const registered = ['run_command', 'read_file'];

    const result = recoverCallDefaultApi(rawOutput, registered);
    assertFalse(result.isToolCall);
    assertEqual(result.textFallback, rawOutput);
  });

  await t.test('TC-T1-F10-05: Malformed JSON arguments fail closed safely', () => {
    const rawOutput = 'call:default_api:run_command{invalid:json:syntax';
    const registered = ['run_command'];

    const result = recoverCallDefaultApi(rawOutput, registered);
    assertFalse(result.isToolCall, 'Must fail closed on syntax errors');
    assertEqual(result.textFallback, rawOutput);
  });

  await t.test('TC-T1-F10-06: Empty arguments call:default_api:list_dir{} produces valid empty object', () => {
    const rawOutput = 'call:default_api:list_dir{}';
    const registered = ['list_dir'];

    const result = recoverCallDefaultApi(rawOutput, registered);
    assertTrue(result.isToolCall);
    assertEqual(result.toolCall?.name, 'list_dir');
    assertDeepEqual(result.toolCall?.args, {});
  });

  await t.test('TC-T2-F10-02: Nested JSON arguments and escaped quotes parsed accurately', () => {
    const rawOutput = 'call:default_api:edit_file{"path":"src/test.rs","edits":[{"find":"old \\"quote\\"","replace":"new"}]}';
    const registered = ['edit_file'];

    const result = recoverCallDefaultApi(rawOutput, registered);
    assertTrue(result.isToolCall);
    const edits = result.toolCall?.args.edits as Array<{ find: string; replace: string }>;
    assertEqual(edits[0].find, 'old "quote"');
  });

  await t.test('TC-T2-F10-03: Pseudocode inside markdown code block is preserved as literal text', () => {
    const markdownCode = '```\ncall:default_api:run_command{"CommandLine":"ls"}\n```';
    const registered = ['run_command'];

    const result = recoverCallDefaultApi(markdownCode, registered);
    assertFalse(result.isToolCall, 'Markdown code blocks must not trigger tool recovery');
    assertEqual(result.textFallback, markdownCode);
  });

  await t.test('TC-T3-03: Multi-turn loop with thinking pruning and recovered pseudocode execution', () => {
    // Turn 1: History contains thinking block
    const history: ContentMessage[] = [
      { role: 'user', parts: [{ text: 'Run compilation check' }] },
      { role: 'model', parts: [{ text: 'Planning...', thought: true }, { text: 'Starting...', thought: false }] },
    ];
    const prunedHistory = stripAllThinkingBlocks(history);
    assertEqual(prunedHistory[1].parts.length, 1);

    // Turn 2: Agent emits pseudocode
    const rawDelta = 'call:default_api:run_command{"CommandLine":"tsc --noEmit"}';
    const recovery = recoverCallDefaultApi(rawDelta, ['run_command']);
    assertTrue(recovery.isToolCall);
    assertEqual(recovery.toolCall?.args.CommandLine, 'tsc --noEmit');
  });
});
