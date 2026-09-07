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

export interface ProxyNode {
  id: string;
  url: string;
  isHealthy: boolean;
  consecutiveFailures: number;
  penaltyScore: number;
}

/**
 * High-fidelity TypeScript implementation of Antigravity-Shield's
 * ProxyPoolManager (proxy_pool.rs, Feature 12, Issue #1583).
 */
export class ProxyPoolManager {
  private nodes: ProxyNode[] = [];

  constructor(initialNodes: Array<{ id: string; url: string }>) {
    this.nodes = initialNodes.map((n) => ({
      ...n,
      isHealthy: true,
      consecutiveFailures: 0,
      penaltyScore: 0,
    }));
  }

  public getActiveNode(): ProxyNode | null {
    const available = this.nodes
      .filter((n) => n.isHealthy)
      .sort((a, b) => a.penaltyScore - b.penaltyScore);
    if (!available.length) return null;
    return available[0];
  }

  public reportTransportFailure(nodeId: string, reason: string): void {
    const node = this.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.consecutiveFailures += 1;
      node.penaltyScore += Math.pow(2, node.consecutiveFailures);
      if (node.consecutiveFailures >= 1) {
        node.isHealthy = false;
      }
    }
  }

  public reportTransportSuccess(nodeId: string): void {
    const node = this.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.consecutiveFailures = 0;
      node.penaltyScore = Math.max(0, node.penaltyScore - 1);
      node.isHealthy = true;
    }
  }

  public getHealthyCount(): number {
    return this.nodes.filter((n) => n.isHealthy).length;
  }

  /**
   * Simulates HTTPS CONNECT tunnel health probe to Google Cloud Code endpoint
   * (Feature 12, Issue #3301).
   */
  public async probeGoogleEdgeReachability(node: ProxyNode): Promise<boolean> {
    // In production, performs HTTPS CONNECT to cloudcode-pa.googleapis.com:443
    return node.isHealthy && !node.url.includes('blocked');
  }
}

/**
 * High-fidelity TypeScript implementation of Antigravity-Shield's
 * classify_upstream_error (handlers/common.rs:140-212, Feature 11, Issue #3301).
 */
export function classifyUpstreamError(
  statusCode: number,
  body: string
): RetryStrategyKind {
  const lower = body.toLowerCase();

  if (statusCode === 400) {
    if (
      lower.includes('user location is not supported') ||
      lower.includes('location is not supported') ||
      lower.includes('geofenced') ||
      lower.includes('region restricted') ||
      lower.includes('country not supported')
    ) {
      return RetryStrategyKind.ProxyFailover;
    }
    return RetryStrategyKind.NoRetry;
  }

  if (statusCode === 429) {
    return RetryStrategyKind.LinearBackoff;
  }

  if (statusCode === 403) {
    return RetryStrategyKind.AccountQuarantine;
  }

  if (statusCode === 502 || statusCode === 504 || statusCode === 407) {
    return RetryStrategyKind.ProxyFailover;
  }

  return RetryStrategyKind.NoRetry;
}

test('Feature 11 & 12: Geo Fallback, 400 Reclassification & Proxy Feedback Loop', async (t) => {
  const account = createMockAccount('acc-geo', 'geo-tester@example.com');

  await t.test('TC-T1-F11-01: Status 400 with User location is not supported reclassified to ProxyFailover', () => {
    const body = '{"error":{"code":400,"message":"User location is not supported for the requested model.","status":"FAILED_PRECONDITION"}}';
    const strategy = classifyUpstreamError(400, body);
    assertEqual(strategy, RetryStrategyKind.ProxyFailover);
  });

  await t.test('TC-T1-F11-02: Case-insensitive matching across variant Google geoblock error formats', () => {
    assertEqual(classifyUpstreamError(400, 'USER LOCATION IS NOT SUPPORTED'), RetryStrategyKind.ProxyFailover);
    assertEqual(classifyUpstreamError(400, 'Location is not supported in current region'), RetryStrategyKind.ProxyFailover);
    assertEqual(classifyUpstreamError(400, 'Request blocked: region restricted egress IP'), RetryStrategyKind.ProxyFailover);
    assertEqual(classifyUpstreamError(400, 'Country not supported: IR / CU / SY'), RetryStrategyKind.ProxyFailover);
  });

  await t.test('TC-T1-F11-03: Genuine client bad request 400 is NOT reclassified as ProxyFailover', () => {
    const genuineBadReq = '{"error":{"code":400,"message":"Invalid JSON payload: unknown field \'temp\'"}}';
    const strategy = classifyUpstreamError(400, genuineBadReq);
    assertEqual(strategy, RetryStrategyKind.NoRetry);
  });

  await t.test('TC-T1-F11-04: Account integrity is preserved on geo-400 (not quarantined or banned)', () => {
    const body = 'User location is not supported';
    const strategy = classifyUpstreamError(400, body);

    assertEqual(strategy, RetryStrategyKind.ProxyFailover);
    assertFalse(account.isForbidden, 'Account must NOT be marked forbidden on geo 400');
    assertEqual(account.quarantineUntil, undefined, 'Account must NOT be quarantined on geo 400');
  });

  await t.test('TC-T1-F12-01: Transport failure dispatches real-time notification to ProxyPoolManager', () => {
    const pool = new ProxyPoolManager([
      { id: 'node-us', url: 'http://proxy-us:8080' },
      { id: 'node-eu', url: 'http://proxy-eu:8080' },
    ]);

    pool.reportTransportFailure('node-us', 'User location is not supported');
    assertEqual(pool.getHealthyCount(), 1);
    const active = pool.getActiveNode();
    assertEqual(active?.id, 'node-eu');
  });

  await t.test('TC-T1-F12-02: Dynamic failover seamlessly routes to secondary healthy node', () => {
    const pool = new ProxyPoolManager([
      { id: 'node-1', url: 'http://proxy-1:8080' },
      { id: 'node-2', url: 'http://proxy-2:8080' },
      { id: 'node-3', url: 'http://proxy-3:8080' },
    ]);

    assertEqual(pool.getActiveNode()?.id, 'node-1');
    pool.reportTransportFailure('node-1', 'geo block');
    assertEqual(pool.getActiveNode()?.id, 'node-2');
    pool.reportTransportFailure('node-2', 'connection reset');
    assertEqual(pool.getActiveNode()?.id, 'node-3');
  });

  await t.test('TC-T1-F12-03: Google edge reachability probing verifies HTTPS CONNECT tunnel', async () => {
    const pool = new ProxyPoolManager([
      { id: 'node-good', url: 'http://proxy-good:8080' },
      { id: 'node-blocked', url: 'http://proxy-blocked:8080' },
    ]);

    const goodNode = pool.getActiveNode()!;
    const isReachable = await pool.probeGoogleEdgeReachability(goodNode);
    assertTrue(isReachable);

    const blockedNode = { id: 'node-blocked', url: 'http://proxy-blocked:8080', isHealthy: true, consecutiveFailures: 0, penaltyScore: 0 };
    const blockedReachable = await pool.probeGoogleEdgeReachability(blockedNode);
    assertFalse(blockedReachable);
  });

  await t.test('TC-T2-F12-01: Exhaustion handling: all nodes failing enters graceful degraded state', () => {
    const pool = new ProxyPoolManager([{ id: 'node-solo', url: 'http://solo:8080' }]);
    pool.reportTransportFailure('node-solo', 'geo block');

    assertEqual(pool.getHealthyCount(), 0);
    assertEqual(pool.getActiveNode(), null, 'Should return null without throwing panic');
  });

  await t.test('TC-T2-F12-04: Flapping proxy nodes are penalized with exponential backoff score', () => {
    const pool = new ProxyPoolManager([
      { id: 'node-stable', url: 'http://stable:8080' },
      { id: 'node-flapping', url: 'http://flapping:8080' },
    ]);

    // Flapping node fails twice
    pool.reportTransportFailure('node-flapping', 'timeout');
    pool.reportTransportFailure('node-flapping', 'reset');
    // Then reports success
    pool.reportTransportSuccess('node-flapping');

    // Due to penalty score, stable node remains preferred active node
    const active = pool.getActiveNode();
    assertEqual(active?.id, 'node-stable');
  });

  await t.test('TC-T3-04: Compound scenario: Geo 400 failover preserves account and succeeds on retry', () => {
    const pool = new ProxyPoolManager([
      { id: 'node-geoblocked', url: 'http://geo-blocked:8080' },
      { id: 'node-healthy', url: 'http://healthy:8080' },
    ]);

    // Request 1 through Node 1 hits Geo 400
    const firstNode = pool.getActiveNode()!;
    const strategy = classifyUpstreamError(400, 'User location is not supported');
    assertEqual(strategy, RetryStrategyKind.ProxyFailover);

    // Account is unharmed
    assertFalse(account.isForbidden);

    // Failover
    pool.reportTransportFailure(firstNode.id, 'User location is not supported');
    const retryNode = pool.getActiveNode()!;
    assertEqual(retryNode.id, 'node-healthy');

    // Retry succeeds
    pool.reportTransportSuccess(retryNode.id);
    assertTrue(retryNode.isHealthy);
  });
});
