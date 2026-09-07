import test from 'node:test';
import { assertEqual, assertTrue, assertFalse, assertDeepEqual } from '../harness/assertions';

export interface MessageItem {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'model';
  type?: string;
  content?: string;
  text?: string;
  tool_calls?: Array<{ id: string; name: string; args: Record<string, unknown> }>;
  tool_call_id?: string;
}

export interface PreparedSessionInput {
  merged: MessageItem[];
  delta: MessageItem[];
  resetParent: boolean;
}

/**
 * High-fidelity TypeScript implementation of Antigravity-Shield's
 * http_session_store.rs prepare_session_input reconciliation algorithm (Feature 8, Issue #3382).
 */
export function prepareSessionInput(
  history: MessageItem[],
  newInput: MessageItem[]
): PreparedSessionInput {
  const resetParent = newInput.some((item) =>
    item.type === 'compaction' || item.type === 'compaction_summary'
  );

  const exactReplay =
    history.length > 0 &&
    newInput.length >= history.length &&
    history.every((h, idx) => JSON.stringify(h) === JSON.stringify(newInput[idx]));

  const itemsSemanticallyEqual = (a: MessageItem, b: MessageItem): boolean => {
    const roleA = a.role;
    const roleB = b.role;
    const typeA = a.type;
    const typeB = b.type;
    const contentA = a.content ?? a.text;
    const contentB = b.content ?? b.text;
    return roleA === roleB && typeA === typeB && contentA === contentB;
  };

  const semanticPrefixMatch =
    history.length > 0 &&
    newInput.length >= history.length &&
    history.every((h, idx) => itemsSemanticallyEqual(h, newInput[idx]));

  let replayedThrough: number | null = null;
  if (!resetParent && !exactReplay && !semanticPrefixMatch) {
    const historyIds = new Set(history.map((h) => h.id).filter(Boolean));
    for (let i = newInput.length - 1; i >= 0; i--) {
      if (newInput[i].id && historyIds.has(newInput[i].id)) {
        replayedThrough = i;
        break;
      }
    }
  }

  let semanticSuffixIdx: number | null = null;
  if (!history.length || resetParent || exactReplay || replayedThrough !== null || semanticPrefixMatch) {
    semanticSuffixIdx = null;
  } else {
    const lastH = history[history.length - 1];
    for (let i = newInput.length - 1; i >= 0; i--) {
      if (itemsSemanticallyEqual(lastH, newInput[i])) {
        semanticSuffixIdx = i;
        break;
      }
    }
  }

  let deltaSource: MessageItem[];
  let useNewInputAsMerged: boolean;

  if (resetParent || history.length === 0) {
    deltaSource = [...newInput];
    useNewInputAsMerged = false;
  } else if (exactReplay) {
    deltaSource = newInput.slice(history.length);
    useNewInputAsMerged = false;
  } else if (semanticPrefixMatch) {
    deltaSource = newInput.slice(history.length);
    useNewInputAsMerged = false;
  } else if (replayedThrough !== null) {
    deltaSource = newInput.slice(replayedThrough + 1);
    useNewInputAsMerged = false;
  } else if (semanticSuffixIdx !== null) {
    deltaSource = newInput.slice(semanticSuffixIdx + 1);
    useNewInputAsMerged = false;
  } else if (newInput.length >= history.length) {
    // [FIX #3382] Fallback protection against Cartesian explosion
    deltaSource = newInput.length > 0 ? [newInput[newInput.length - 1]] : [];
    useNewInputAsMerged = true;
  } else {
    deltaSource = [...newInput];
    useNewInputAsMerged = false;
  }

  const delta = [...deltaSource];
  let merged: MessageItem[];
  if (resetParent || history.length === 0) {
    merged = [...delta];
  } else if (useNewInputAsMerged) {
    merged = [...newInput];
  } else {
    merged = [...history, ...delta];
  }

  return { merged, delta, resetParent };
}

test('Feature 8: Robust Context Reconciliation & Non-Duplication', async (t) => {
  await t.test('TC-T1-F08-01: Exact replay prefix match extracts only new delta without duplicating history', () => {
    const history: MessageItem[] = [
      { id: '1', role: 'user', content: 'What is Antigravity?' },
      { id: '2', role: 'model', content: 'It is an AI account proxy.' },
    ];
    const newInput: MessageItem[] = [
      { id: '1', role: 'user', content: 'What is Antigravity?' },
      { id: '2', role: 'model', content: 'It is an AI account proxy.' },
      { id: '3', role: 'user', content: 'How does it prevent 403 errors?' },
    ];

    const result = prepareSessionInput(history, newInput);
    assertFalse(result.resetParent);
    assertEqual(result.delta.length, 1);
    assertEqual(result.delta[0].content, 'How does it prevent 403 errors?');
    assertEqual(result.merged.length, 3);
  });

  await t.test('TC-T1-F08-02: Semantic prefix match dedupes history when client regenerates message IDs', () => {
    const history: MessageItem[] = [
      { id: 'client-gen-101', role: 'user', content: 'Analyze the codebase.' },
      { id: 'client-gen-102', role: 'model', content: 'Codebase has 14 features.' },
    ];
    // Client sends the exact same conversation turns, but with new randomized IDs (e.g. Cursor / Claude Code behavior)
    const newInput: MessageItem[] = [
      { id: 'new-id-999', role: 'user', content: 'Analyze the codebase.' },
      { id: 'new-id-1000', role: 'model', content: 'Codebase has 14 features.' },
      { id: 'new-id-1001', role: 'user', content: 'Refactor token_manager.rs.' },
    ];

    const result = prepareSessionInput(history, newInput);
    assertEqual(result.delta.length, 1);
    assertEqual(result.delta[0].content, 'Refactor token_manager.rs.');
    assertEqual(result.merged.length, 3);
  });

  await t.test('TC-T1-F08-03: Semantic suffix match preserves intermediate tool turns in multi-turn agent loops', () => {
    const history: MessageItem[] = [
      { role: 'user', content: 'Read project configuration' },
      { role: 'model', content: 'Calling tool read_file', tool_calls: [{ id: 't1', name: 'read_file', args: {} }] },
    ];
    const newInput: MessageItem[] = [
      { role: 'user', content: 'Read project configuration' },
      { role: 'model', content: 'Calling tool read_file', tool_calls: [{ id: 't1', name: 'read_file', args: {} }] },
      { role: 'user', content: 'file content: { version: 4.6.7 }' },
      { role: 'model', content: 'Config read successfully.' },
    ];

    const result = prepareSessionInput(history, newInput);
    assertEqual(result.delta.length, 2);
    assertEqual(result.delta[0].content, 'file content: { version: 4.6.7 }');
    assertEqual(result.delta[1].content, 'Config read successfully.');
    assertEqual(result.merged.length, 4);
  });

  await t.test('TC-T1-F08-04: Fallback protection prevents 2x Cartesian token explosion when formatting differs', () => {
    // Client sends mutated turns (e.g. whitespace changes) so neither exact nor ID match hits
    const history: MessageItem[] = [
      { id: 'h1', role: 'user', content: 'Initial user prompt' },
      { id: 'h2', role: 'model', content: 'Initial model response' },
    ];
    const newInput: MessageItem[] = [
      { id: 'diff1', role: 'user', content: 'Initial user prompt [reformatted]' },
      { id: 'diff2', role: 'model', content: 'Initial model response [reformatted]' },
      { id: 'diff3', role: 'user', content: 'Next step instruction' },
    ];

    // Under flawed legacy logic, all 3 items of newInput would be appended to 2 items of history = 5 items (duplication)
    // Under hardened #3382 fallback protection, newInput is taken as authoritative merged history and only last element is delta
    const result = prepareSessionInput(history, newInput);
    assertEqual(result.delta.length, 1);
    assertEqual(result.delta[0].content, 'Next step instruction');
    assertEqual(result.merged.length, 3, 'Merged history must not exceed newInput length (no 2x Cartesian explosion)');
  });

  await t.test('TC-T1-F08-05: Context compaction sentinel resets parent session cleanly', () => {
    const history: MessageItem[] = [
      { role: 'user', content: 'Turn 1' },
      { role: 'model', content: 'Turn 2' },
      { role: 'user', content: 'Turn 3' },
    ];
    const newInput: MessageItem[] = [
      { type: 'compaction_summary', role: 'system', content: 'Summary of past 3 turns' },
      { role: 'user', content: 'Proceed with next task' },
    ];

    const result = prepareSessionInput(history, newInput);
    assertTrue(result.resetParent);
    assertEqual(result.merged.length, 2);
    assertEqual(result.merged[0].type, 'compaction_summary');
    assertEqual(result.merged[1].content, 'Proceed with next task');
  });
});
