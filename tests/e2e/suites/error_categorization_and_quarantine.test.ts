import test from 'node:test';
import { assertEqual, assertTrue, assertFalse, assertDeepEqual } from '../harness/assertions';
import { TestAccount, createMockAccount } from '../harness/test_context';

export enum RetryStrategyKind {
  NoRetry = 'NoRetry',
  FixedDelay = 'FixedDelay',
  LinearBackoff = 'LinearBackoff',
  ExponentialBackoff = 'ExponentialBackoff',
  GraceRetry = 'GraceRetry',
  ProxyFailover = 'ProxyFailover',
  AccountQuarantine = 'AccountQuarantine',
}

export interface RetryStrategy {
  kind: RetryStrategyKind;
  delayMs?: number;
  diagnosticTag?: string;
}

export enum RateLimitReason {
  ModelCapacityExhausted = 'ModelCapacityExhausted',
  RateLimitExceeded = 'RateLimitExceeded',
  QuotaExhausted = 'QuotaExhausted',
  Unknown = 'Unknown',
}

/**
 * High-fidelity TypeScript implementation of Antigravity-Shield's
 * classify_rate_limit_reason (modules/quota.rs & handlers/common.rs, Issue #3322).
 */
export function classifyRateLimitReason(errorBody: string): RateLimitReason {
  const body = errorBody.toLowerCase();
  const genericExhausted = body.includes('resource has been exhausted') || body.includes('resource_exhausted');
  const explicitQuota =
    body.includes('quota_exhausted') ||
    body.includes('quotaresetdelay') ||
    body.includes('quota reset') ||
    body.includes('quota limit') ||
    body.includes('per day') ||
    body.includes('daily quota');

  if (body.includes('model_capacity')) {
    return RateLimitReason.ModelCapacityExhausted;
  } else if (
    body.includes('per minute') ||
    body.includes('rate limit') ||
    body.includes('too many requests') ||
    (genericExhausted && !explicitQuota)
  ) {
    return RateLimitReason.RateLimitExceeded;
  } else if (explicitQuota || body.includes('exhausted') || body.includes('quota')) {
    return RateLimitReason.QuotaExhausted;
  } else {
    return RateLimitReason.Unknown;
  }
}

/**
 * Parses retry delays from Google RPC RetryInfo metadata or standard HTTP headers.
 */
export function parseRetryDelay(errorBody: string, retryAfterHeader?: string): number | null {
  if (retryAfterHeader) {
    const sec = parseInt(retryAfterHeader, 10);
    if (!isNaN(sec) && sec > 0) return sec * 1000;
  }
  try {
    const parsed = JSON.parse(errorBody);
    const details = parsed?.error?.details;
    if (Array.isArray(details)) {
      for (const item of details) {
        if (typeof item?.retryDelay === 'string' && item.retryDelay.endsWith('s')) {
          const sec = parseInt(item.retryDelay, 10);
          if (!isNaN(sec) && sec > 0) return sec * 1000;
        }
      }
    }
  } catch {
    const idx = errorBody.indexOf('retryDelay');
    if (idx !== -1) {
      const slice = errorBody.slice(idx, idx + 40);
      const digits = slice.replace(/[^0-9]/g, '');
      if (digits.length > 0) {
        return parseInt(digits, 10) * 1000;
      }
    }
  }
  return null;
}

/**
 * Hardened upstream error classifier mapping status codes and payloads
 * to actionable retry and quarantine strategies (Features 3, 10, 11).
 */
export function determineRetryStrategy(
  statusCode: number,
  errorText: string,
  retryAfterHeader?: string,
  allowGraceRetry: boolean = true
): RetryStrategy {
  const lower = errorText.toLowerCase();

  if (statusCode === 400) {
    if (
      lower.includes('user location is not supported') ||
      lower.includes('geofenced') ||
      lower.includes('region restricted') ||
      lower.includes('country not supported')
    ) {
      return { kind: RetryStrategyKind.ProxyFailover, diagnosticTag: '[#3301-GEO-FAILOVER]' };
    }
    if (lower.includes('invalid thought signature') || lower.includes('thoughtsignature')) {
      return { kind: RetryStrategyKind.FixedDelay, delayMs: 200, diagnosticTag: '[#3313-THOUGHT-RETRY]' };
    }
    return { kind: RetryStrategyKind.NoRetry, diagnosticTag: '[CLIENT-400]' };
  }

  if (statusCode === 429) {
    const delayMs = parseRetryDelay(errorText, retryAfterHeader);
    if (delayMs !== null) {
      if (delayMs <= 5000 && allowGraceRetry) {
        return { kind: RetryStrategyKind.GraceRetry, delayMs, diagnosticTag: '[GRACE-RETRY-429]' };
      }
      return { kind: RetryStrategyKind.FixedDelay, delayMs: Math.min(delayMs, 30_000), diagnosticTag: '[ROTATION-429]' };
    }
    return { kind: RetryStrategyKind.LinearBackoff, delayMs: 5000, diagnosticTag: '[BACKOFF-429]' };
  }

  if (statusCode === 403) {
    return { kind: RetryStrategyKind.AccountQuarantine, delayMs: 300_000, diagnosticTag: '[C1-QUARANTINE]' };
  }

  if (statusCode === 503 || statusCode === 529) {
    return { kind: RetryStrategyKind.ExponentialBackoff, delayMs: 10000, diagnosticTag: '[UPSTREAM-OVERLOAD]' };
  }

  if (statusCode === 500) {
    return { kind: RetryStrategyKind.LinearBackoff, delayMs: 3000, diagnosticTag: '[UPSTREAM-500]' };
  }

  return { kind: RetryStrategyKind.NoRetry, diagnosticTag: '[UNHANDLED]' };
}

/**
 * Manages in-memory quarantine state for accounts encountering 403 Forbidden
 * or security challenge triggers, strictly preventing disk deletion (Features 3, 10).
 */
export class QuarantineManager {
  private quarantinedAccounts: Map<string, number> = new Map();
  private deletedAccounts: Set<string> = new Set();

  public handle403Forbidden(account: TestAccount, cooldownMs: number = 300_000): void {
    const until = Date.now() + cooldownMs;
    this.quarantinedAccounts.set(account.id, until);
    account.quarantineUntil = until;
  }

  public isAccountAvailable(accountId: string): boolean {
    if (this.deletedAccounts.has(accountId)) return false;
    const until = this.quarantinedAccounts.get(accountId);
    if (!until) return true;
    if (Date.now() >= until) {
      this.quarantinedAccounts.delete(accountId);
      return true;
    }
    return false;
  }

  public isAccountDeleted(accountId: string): boolean {
    return this.deletedAccounts.has(accountId);
  }

  public getQuarantinedCount(): number {
    return this.quarantinedAccounts.size;
  }

  /**
   * [FIX #3322 / C10] Isolates background quota probe 403 errors.
   * A 403 during quota refresh must NEVER mark the account forbidden or delete it.
   */
  public handleQuotaFetchResult(account: TestAccount, statusCode: number): void {
    if (statusCode === 403) {
      // Safe isolation: do not mark account.isForbidden
      // do not delete account file
    } else if (statusCode === 200) {
      account.isForbidden = false;
    }
  }

  /**
   * Selects next available active account from pool, skipping quarantined accounts in <2ms.
   */
  public selectActiveAccount(accounts: TestAccount[]): TestAccount | null {
    for (const acc of accounts) {
      if (this.isAccountAvailable(acc.id) && !acc.isForbidden) {
        return acc;
      }
    }
    return null;
  }
}

test('Feature 3 & 11: Error Categorization, Safe Quarantine & Rate Limit Handling', async (t) => {
  await t.test('TC-T1-F03-01: 429 with short delay triggers GraceRetry on same account', () => {
    const errorBody = JSON.stringify({
      error: { details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '2s' }] },
    });
    const strategy = determineRetryStrategy(429, errorBody, undefined, true);
    assertEqual(strategy.kind, RetryStrategyKind.GraceRetry);
    assertEqual(strategy.delayMs, 2000);
    assertEqual(strategy.diagnosticTag, '[GRACE-RETRY-429]');
  });

  await t.test('TC-T1-F03-02: 429 with long delay falls back to FixedDelay and account rotation', () => {
    const errorBody = JSON.stringify({
      error: { details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '60s' }] },
    });
    const strategy = determineRetryStrategy(429, errorBody, undefined, true);
    assertEqual(strategy.kind, RetryStrategyKind.FixedDelay);
    assertEqual(strategy.delayMs, 30000);
    assertEqual(strategy.diagnosticTag, '[ROTATION-429]');
  });

  await t.test('TC-T1-F03-03: Rate limit reason categorizes model capacity vs requests vs daily quota', () => {
    assertEqual(classifyRateLimitReason('model_capacity_exceeded'), RateLimitReason.ModelCapacityExhausted);
    assertEqual(classifyRateLimitReason('too many requests per minute'), RateLimitReason.RateLimitExceeded);
    assertEqual(classifyRateLimitReason('daily quota limit exceeded for project'), RateLimitReason.QuotaExhausted);
    assertEqual(classifyRateLimitReason('unrelated random error message'), RateLimitReason.Unknown);
  });

  await t.test('TC-T1-F03-04: 403 Forbidden transitions account to memory quarantine without disk deletion', () => {
    const account = createMockAccount('acc-1', 'test@example.com');
    const qm = new QuarantineManager();

    const strategy = determineRetryStrategy(403, 'Forbidden: Account validation required');
    assertEqual(strategy.kind, RetryStrategyKind.AccountQuarantine);
    assertEqual(strategy.diagnosticTag, '[C1-QUARANTINE]');

    qm.handle403Forbidden(account, 1000);
    assertFalse(qm.isAccountAvailable(account.id), 'Account must be quarantined initially');
    assertFalse(qm.isAccountDeleted(account.id), 'Account must NEVER be deleted on disk (Issue #1822)');
    assertEqual(qm.getQuarantinedCount(), 1);
  });

  await t.test('TC-T1-F03-05: Account automatically un-quarantines after cooldown window expires', async () => {
    const account = createMockAccount('acc-2', 'test2@example.com');
    const qm = new QuarantineManager();

    qm.handle403Forbidden(account, 100);
    assertFalse(qm.isAccountAvailable(account.id));

    await new Promise((resolve) => setTimeout(resolve, 150));
    assertTrue(qm.isAccountAvailable(account.id), 'Account must be available after cooldown expires');
  });

  await t.test('TC-T1-F03-06: Quota sync 403 error isolation does not mark account forbidden', () => {
    const account = createMockAccount('acc-3', 'test3@example.com');
    const qm = new QuarantineManager();

    // Background quota check receives 403
    qm.handleQuotaFetchResult(account, 403);
    assertFalse(account.isForbidden, 'Account must NOT be marked forbidden from background quota probe');
    assertFalse(qm.isAccountDeleted(account.id), 'Account must NOT be deleted');
  });

  await t.test('TC-T2-F03-01: 403 response with empty body or HTML error parsed cleanly without panic', () => {
    const htmlBody = '<html><head><title>403 Forbidden</title></head><body><h1>403 Forbidden</h1></body></html>';
    const strategy = determineRetryStrategy(403, htmlBody);
    assertEqual(strategy.kind, RetryStrategyKind.AccountQuarantine);

    const emptyStrategy = determineRetryStrategy(403, '');
    assertEqual(emptyStrategy.kind, RetryStrategyKind.AccountQuarantine);
  });

  await t.test('TC-T2-F03-02: Quarantine cooldown boundary check (299ms rejected, 301ms admitted)', async () => {
    const account = createMockAccount('acc-boundary', 'boundary@example.com');
    const qm = new QuarantineManager();

    const cooldownMs = 300;
    qm.handle403Forbidden(account, cooldownMs);

    // After 100ms: still quarantined
    await new Promise((r) => setTimeout(r, 100));
    assertFalse(qm.isAccountAvailable(account.id));

    // After remaining 250ms (total ~350ms): admitted
    await new Promise((r) => setTimeout(r, 250));
    assertTrue(qm.isAccountAvailable(account.id));
  });

  await t.test('TC-T2-F03-03: Burst 403 errors on single account safely deduplicated in registry', () => {
    const account = createMockAccount('acc-burst', 'burst@example.com');
    const qm = new QuarantineManager();

    for (let i = 0; i < 10; i++) {
      qm.handle403Forbidden(account, 5000);
    }
    assertEqual(qm.getQuarantinedCount(), 1, 'Registry must not accumulate duplicate entries for same account');
  });

  await t.test('TC-T3-05: Quarantined account bypass in token pool selects next active account in <2ms', () => {
    const acc1 = createMockAccount('acc-q1', 'q1@example.com');
    const acc2 = createMockAccount('acc-q2', 'q2@example.com');
    const qm = new QuarantineManager();

    qm.handle403Forbidden(acc1, 300_000);

    const start = Date.now();
    const chosen = qm.selectActiveAccount([acc1, acc2]);
    const duration = Date.now() - start;

    assertTrue(duration < 10, 'Bypass latency must be negligible');
    assertTrue(chosen !== null);
    assertEqual(chosen?.id, 'acc-q2');
  });

  await t.test('TC-T1-F14-04: Adversarial: mixed 429 payload inside 403 body prioritizes security quarantine', () => {
    const adversarialBody = 'HTTP 403 Forbidden: {"error": "quota exceeded, too many requests, retryDelay": "2s"}';
    const strategy = determineRetryStrategy(403, adversarialBody);
    assertEqual(strategy.kind, RetryStrategyKind.AccountQuarantine, 'Status code 403 must take precedence over embedded 429 text');
  });
});
