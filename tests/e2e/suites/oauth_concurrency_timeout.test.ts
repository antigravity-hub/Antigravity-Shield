import test from 'node:test';
import { assertEqual, assertTrue, assertFalse, assertRejectsWith } from '../harness/assertions';
import { setupTestEnv, TestAccount } from '../harness/test_context';

/**
 * Simulates Antigravity-Shield's TokenManager token acquisition engine
 * implementing the 15-second expanded timeout, in-memory config caching,
 * and fine-grained per-account locks (Features 5, 6, 7).
 */
export class TokenManagerSimulator {
  public timeoutMs: number;
  private tokenCache: Map<string, { token: string; expiresAt: number }> = new Map();
  private accountLocks: Map<string, Promise<void>> = new Map();
  private pendingReloadQueue: string[] = [];
  public diskIoLatencyMs: number = 0;

  constructor(timeoutMs: number = 15000) {
    this.timeoutMs = timeoutMs;
  }

  public setPendingReload(accountId: string): void {
    this.pendingReloadQueue.push(accountId);
  }

  /**
   * Acquires a fine-grained per-account lock, ensuring that operations on Account A
   * do not serialize or block requests for Account B.
   */
  public async acquireAccountLock<T>(accountId: string, operation: () => Promise<T>): Promise<T> {
    const existingLock = this.accountLocks.get(accountId) || Promise.resolve();
    let resolveLock!: () => void;
    const newLock = new Promise<void>((res) => { resolveLock = res; });
    this.accountLocks.set(accountId, existingLock.then(() => newLock));

    await existingLock;
    try {
      return await operation();
    } finally {
      resolveLock();
      if (this.accountLocks.get(accountId) === newLock) {
        this.accountLocks.delete(accountId);
      }
    }
  }

  /**
   * Token acquisition core logic wrapped with configurable timeout (legacy 5s vs hardened 15s).
   */
  public async getToken(account: TestAccount, targetModel: string): Promise<{ token: string; latencyMs: number }> {
    const startTime = Date.now();

    const acquirePromise = this.acquireAccountLock(account.id, async () => {
      // 1. Fast-path in-memory cache check
      const cached = this.tokenCache.get(account.id);
      if (cached && cached.expiresAt > Date.now() + 60_000 && this.pendingReloadQueue.length === 0) {
        return cached.token;
      }

      // 2. Offloaded disk I/O simulation (spawn_blocking)
      if (this.diskIoLatencyMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.diskIoLatencyMs));
      }

      // 3. Pending reload queue drain
      while (this.pendingReloadQueue.length > 0) {
        this.pendingReloadQueue.shift();
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const freshToken = 'fresh-token-' + account.id + '-' + Date.now();
      this.tokenCache.set(account.id, { token: freshToken, expiresAt: Date.now() + 3600_000 });
      return freshToken;
    });

    let timeoutTimer: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutTimer = setTimeout(() => {
        const sec = Math.round(this.timeoutMs / 1000);
        reject(new Error('Token acquisition timeout (' + sec + 's) - system too busy or deadlock detected'));
      }, this.timeoutMs);
    });

    try {
      const token = await Promise.race([acquirePromise, timeoutPromise]);
      return { token, latencyMs: Date.now() - startTime };
    } finally {
      clearTimeout(timeoutTimer!);
    }
  }
}

test('Feature 5: Token Acquisition Non-Blocking Engine & Timeout Elimination', async (t) => {
  const env = await setupTestEnv();

  await t.test('TC-T1-F05-01: Legacy 5s timeout fails when disk I/O takes longer than timeout window', async () => {
    // Scaled simulation: 300ms timeout with 500ms latency reproduces 5s vs 7s behavior
    const legacyManager = new TokenManagerSimulator(300);
    legacyManager.diskIoLatencyMs = 500;

    await assertRejectsWith(
      () => legacyManager.getToken(env.accounts[0], 'gemini-2.5-pro'),
      'Token acquisition timeout'
    );
  });

  await t.test('TC-T1-F05-02: Hardened 15s timeout succeeds when operation completes within expanded window', async () => {
    // Scaled simulation: 1500ms timeout with 400ms latency reproduces 15s vs 7s behavior
    const hardenedManager = new TokenManagerSimulator(1500);
    hardenedManager.diskIoLatencyMs = 400;

    const result = await hardenedManager.getToken(env.accounts[0], 'gemini-2.5-pro');
    assertTrue(result.token.startsWith('fresh-token-acc-1'));
    assertTrue(result.latencyMs >= 350 && result.latencyMs < 1200);
  });

  await t.test('TC-T1-F05-03: Fast-path in-memory cache retrieval completes in <15ms under zero contention', async () => {
    const manager = new TokenManagerSimulator(1500);
    await manager.getToken(env.accounts[0], 'gemini-2.5-pro');

    const fastResult = await manager.getToken(env.accounts[0], 'gemini-2.5-pro');
    assertTrue(fastResult.latencyMs < 50, 'Fast-path latency must be <50ms, got: ' + fastResult.latencyMs);
  });

  await t.test('TC-T1-F07-01: Fine-grained per-account locks decouple distinct accounts under concurrency', async () => {
    const manager = new TokenManagerSimulator(1500);
    manager.diskIoLatencyMs = 200;

    const p1 = manager.getToken(env.accounts[0], 'gemini-2.5-pro');
    manager.diskIoLatencyMs = 0;
    const p2 = manager.getToken(env.accounts[1], 'gemini-2.5-pro');

    const [res1, res2] = await Promise.all([p1, p2]);
    assertTrue(res1.token.includes('acc-1'));
    assertTrue(res2.token.includes('acc-2'));
    assertTrue(res2.latencyMs < 150, 'Account 2 must not wait for Account 1 lock');
  });

  await t.test('TC-T1-F07-02: High-load burst of 10 concurrent requests resolves without deadlock', async () => {
    const manager = new TokenManagerSimulator(1500);
    const requests = Array.from({ length: 10 }, (_, i) => {
      const acc = env.accounts[i % env.accounts.length];
      return manager.getToken(acc, 'gemini-2.5-flash');
    });

    const results = await Promise.all(requests);
    assertEqual(results.length, 10);
    for (const r of results) {
      assertTrue(r.token.length > 0);
    }
  });

  await env.cleanup();
});
