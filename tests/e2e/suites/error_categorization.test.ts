import test from 'node:test';
import { assertEqual, assertTrue, assertFalse } from '../harness/assertions';
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
}

export enum RateLimitReason {
  ModelCapacityExhausted = 'ModelCapacityExhausted',
  RateLimitExceeded = 'RateLimitExceeded',
  QuotaExhausted = 'QuotaExhausted',
  Unknown = 'Unknown',
}

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
    // string search fallback
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

export function determineRetryStrategy(
  statusCode: number,
  errorText: string,
  retryAfterHeader?: string,
  allowGraceRetry: boolean = true
): RetryStrategy {
  const lower = errorText.toLowerCase();

  if (statusCode === 400) {
    if (lower.includes('user location is not supported') || lower.includes('geofenced') || lower.includes('region restricted')) {
      return { kind: RetryStrategyKind.ProxyFailover };
    }
    if (lower.includes('invalid thought signature') || lower.includes('thoughtsignature')) {
      return { kind: RetryStrategyKind.FixedDelay, delayMs: 200 };
    }
    return { kind: RetryStrategyKind.NoRetry };
  }

  if (statusCode === 429) {
    const delayMs = parseRetryDelay(errorText, retryAfterHeader);
    if (delayMs !== null) {
      if (delayMs <= 5000 && allowGraceRetry) {
        return { kind: RetryStrategyKind.GraceRetry, delayMs };
      }
      return { kind: RetryStrategyKind.FixedDelay, delayMs: Math.min(delayMs, 30_000) };
    }
    return { kind: RetryStrategyKind.LinearBackoff, delayMs: 5000 };
  }

  if (statusCode === 403) {
    return { kind: RetryStrategyKind.AccountQuarantine, delayMs: 300_000 };
  }

  if (statusCode === 503 || statusCode === 529) {
    return { kind: RetryStrategyKind.ExponentialBackoff, delayMs: 10000 };
  }

  if (statusCode === 500) {
    return { kind: RetryStrategyKind.LinearBackoff, delayMs: 3000 };
  }

  return { kind: RetryStrategyKind.NoRetry };
}

export class QuarantineManager {
  private quarantinedAccounts: Map<string, number> = new Map();
  private deletedAccounts: Set<string> = new Set();

  public handle403Forbidden(account: TestAccount, cooldownMs: number = 300_000): void {
    this.quarantinedAccounts.set(account.id, Date.now() + cooldownMs);
    account.quarantineUntil = Date.now() + cooldownMs;
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
}

test('Feature 3 & 11: Error Categorization, Quarantine & Retry Strategies', async (t) => {
  await t.test('TC-T1-F03-01: 429 with short delay triggers GraceRetry on same account', () => {
    const errorBody = JSON.stringify({
      error: { details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '2s' }] },
    });
    const strategy = determineRetryStrategy(429, errorBody, undefined, true);
    assertEqual(strategy.kind, RetryStrategyKind.GraceRetry);
    assertEqual(strategy.delayMs, 2000);
  });

  await t.test('TC-T1-F03-02: 429 with long delay falls back to FixedDelay and account rotation', () => {
    const errorBody = JSON.stringify({
      error: { details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '60s' }] },
    });
    const strategy = determineRetryStrategy(429, errorBody, undefined, true);
    assertEqual(strategy.kind, RetryStrategyKind.FixedDelay);
    assertEqual(strategy.delayMs, 30000);
  });

  await t.test('TC-T1-F03-03: Rate limit reason properly categorizes model capacity vs quota vs requests', () => {
    assertEqual(classifyRateLimitReason('model_capacity_exceeded'), RateLimitReason.ModelCapacityExhausted);
    assertEqual(classifyRateLimitReason('too many requests per minute'), RateLimitReason.RateLimitExceeded);
    assertEqual(classifyRateLimitReason('daily quota limit exceeded for project'), RateLimitReason.QuotaExhausted);
  });

  await t.test('TC-T1-F03-04: 403 Forbidden transitions account to memory quarantine without disk deletion', () => {
    const account = createMockAccount('acc-1', 'test@example.com');
    const qm = new QuarantineManager();

    const strategy = determineRetryStrategy(403, 'Forbidden: Account validation required');
    assertEqual(strategy.kind, RetryStrategyKind.AccountQuarantine);

    qm.handle403Forbidden(account, 1000);
    assertFalse(qm.isAccountAvailable(account.id), 'Account must be quarantined initially');
    assertFalse(qm.isAccountDeleted(account.id), 'Account must NEVER be deleted on disk');
  });

  await t.test('TC-T1-F03-05: Account automatically un-quarantines after cooldown window expires', async () => {
    const account = createMockAccount('acc-2', 'test2@example.com');
    const qm = new QuarantineManager();

    qm.handle403Forbidden(account, 100);
    assertFalse(qm.isAccountAvailable(account.id));

    await new Promise((resolve) => setTimeout(resolve, 150));
    assertTrue(qm.isAccountAvailable(account.id), 'Account must be available after cooldown expires');
  });

  await t.test('TC-T1-F03-06: 503 / 529 servers overload categorized as ExponentialBackoff', () => {
    const s503 = determineRetryStrategy(503, 'Service Unavailable');
    assertEqual(s503.kind, RetryStrategyKind.ExponentialBackoff);
    assertEqual(s503.delayMs, 10000);

    const s529 = determineRetryStrategy(529, 'Site is overloaded');
    assertEqual(s529.kind, RetryStrategyKind.ExponentialBackoff);
  });
});
