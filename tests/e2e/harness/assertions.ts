import assert from 'node:assert';

export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  assert.strictEqual(actual, expected, message);
}

export function assertDeepEqual<T>(actual: T, expected: T, message?: string): void {
  assert.deepStrictEqual(actual, expected, message);
}

export function assertTrue(value: boolean, message?: string): void {
  assert.strictEqual(value, true, message);
}

export function assertFalse(value: boolean, message?: string): void {
  assert.strictEqual(value, false, message);
}

export function assertMatches(actual: string, pattern: RegExp, message?: string): void {
  assert.match(actual, pattern, message);
}

export function assertIncludes(haystack: string, needle: string, message?: string): void {
  assert.ok(
    haystack.includes(needle),
    message || ('Expected string to include ' + needle + ', got: ' + haystack)
  );
}

export function assertNotIncludes(haystack: string, needle: string, message?: string): void {
  assert.ok(
    !haystack.includes(needle),
    message || ('Expected string NOT to include ' + needle + ', got: ' + haystack)
  );
}

export async function assertRejectsWith(
  promiseFn: () => Promise<unknown>,
  needle: string,
  message?: string
): Promise<void> {
  try {
    await promiseFn();
    assert.fail(message || ('Expected promise to reject with ' + needle + ', but it resolved successfully'));
  } catch (err: unknown) {
    const errStr = err instanceof Error ? err.message : String(err);
    assert.ok(
      errStr.includes(needle),
      message || ('Expected error ' + errStr + ' to include ' + needle)
    );
  }
}
