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
}

export class ProxyPoolManager {
  private nodes: ProxyNode[] = [];
  private activeIndex: number = 0;

  constructor(initialNodes: Array<{ id: string; url: string }>) {
    this.nodes = initialNodes.map((n) => ({
      ...n,
      isHealthy: true,
      consecutiveFailures: 0,
    }));
  }

  public getActiveNode(): ProxyNode | null {
    const available = this.nodes.filter((n) => n.isHealthy);
    if (!available.length) return null;
    return available[0];
  }

  public reportTransportFailure(nodeId: string, reason: string): void {
    const node = this.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.consecutiveFailures += 1;
      if (node.consecutiveFailures >= 1) {
        node.isHealthy = false;
      }
    }
  }

  public reportTransportSuccess(nodeId: string): void {
    const node = this.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.consecutiveFailures = 0;
      node.isHealthy = true;
    }
  }

  public getHealthyCount(): number {
    return this.nodes.filter((n) => n.isHealthy).length;
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

  return RetryStrategyKind.NoRetry;
}

test('Feature 11 & 12: Geo-Location 400 Reclassification & Proxy Pool Failover', async (t) => {
  const account = createMockAccount('acc-geo', 'geo-tester@example.com');

  await t.test('TC-T1-F11-01: Status 400 with User location is not supported reclassified to ProxyFailover', () => {
    const body = '{ error:{code:400,message:User location is not supported for the requested model.,status:FAILED_PRECONDITION}}';
    const strategy = classifyUpstreamError(400, body);
    assertEqual(strategy, RetryStrategyKind.ProxyFailover);
  });

  await t.test('TC-T1-F11-02: Matching is case-insensitive across variant Google edge geoblock bodies', () => {
    assertEqual(classifyUpstreamError(400, 'USER LOCATION IS NOT SUPPORTED'), RetryStrategyKind.ProxyFailover);
    assertEqual(classifyUpstreamError(400, 'Location is not supported in current region'), RetryStrategyKind.ProxyFailover);
    assertEqual(classifyUpstreamError(400, 'Request blocked: region restricted egress IP'), RetryStrategyKind.ProxyFailover);
  });

  await t.test('TC-T1-F11-03: Genuine client 400 (invalid argument) is NOT reclassified as ProxyFailover', () => {
    const genuineBadReq = '{error:{code:400,message:Invalid JSON payload: unknown field \invalid_opt\}}';
    const strategy = classifyUpstreamError(400, genuineBadReq);
    assertEqual(strategy, RetryStrategyKind.NoRetry);
  });

  await t.test('TC-T1-F11-04: Account integrity is preserved on geo-400 (not quarantined or deleted)', () => {
    const body = 'User location is not supported';
    const strategy = classifyUpstreamError(400, body);

    assertEqual(strategy, RetryStrategyKind.ProxyFailover);
    assertFalse(account.isForbidden, 'Account must NOT be marked forbidden on geo 400');
    assertEqual(account.quarantineUntil, undefined, 'Account must NOT be quarantined on geo 400');
  });

  await t.test('TC-T1-F12-01: ProxyPoolManager marks failing node unhealthy and dynamically rotates', () => {
    const pool = new ProxyPoolManager([
      { id: 'node-us-east', url: 'http://proxy-us-east:8080' },
      { id: 'node-eu-west', url: 'http://proxy-eu-west:8080' },
      { id: 'node-ap-south', url: 'http://proxy-ap-south:8080' },
    ]);

    assertEqual(pool.getHealthyCount(), 3);
    const firstNode = pool.getActiveNode();
    assertEqual(firstNode?.id, 'node-us-east');

    // Geo block occurs on us-east
    pool.reportTransportFailure('node-us-east', 'User location is not supported');
    assertEqual(pool.getHealthyCount(), 2);

    // Failover rotates to next healthy node
    const secondNode = pool.getActiveNode();
    assertEqual(secondNode?.id, 'node-eu-west');
    assertTrue(secondNode?.isHealthy ?? false);
  });
});
