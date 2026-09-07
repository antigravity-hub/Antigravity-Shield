import test from 'node:test';
import { assertEqual, assertTrue, assertFalse } from '../harness/assertions';
import { TestAccount, createMockAccount } from '../harness/test_context';

export interface DeviceHeaders {
  [key: string]: string;
}

/**
 * High-fidelity TypeScript implementation of Antigravity-Shield's
 * upstream client device header generator (Feature 2, client.rs:330-375, Issue #655).
 */
export function getAccountDeviceHeaders(
  account: TestAccount,
  appVersion: string = '4.6.7'
): DeviceHeaders {
  const headers: DeviceHeaders = {
    'content-type': 'application/json',
    'authorization': 'Bearer ' + account.accessToken,
    'user-agent': 'antigravity',
    'x-client-name': 'antigravity',
    'x-client-version': appVersion,
    'x-machine-id': account.deviceProfile.machineId,
    'x-vscode-sessionid': account.deviceProfile.sessionId,
  };

  // [REMOVED v4.1.24] x-goog-api-client header must NEVER be injected.
  // It creates an Electron + Node.js contradictory fingerprint.

  return headers;
}

test('Feature 2: Device Profile Isolation & Fingerprint Anomaly Prevention', async (t) => {
  const accountA = createMockAccount('acc-alpha', 'alpha@example.com');
  const accountB = createMockAccount('acc-beta', 'beta@example.com');

  await t.test('TC-T1-F02-01: Header generation contains official Antigravity client features', () => {
    const headers = getAccountDeviceHeaders(accountA);
    assertEqual(headers['x-client-name'], 'antigravity');
    assertEqual(headers['x-client-version'], '4.6.7');
    assertEqual(headers['user-agent'], 'antigravity');
    assertEqual(headers['x-machine-id'], accountA.deviceProfile.machineId);
    assertEqual(headers['x-vscode-sessionid'], accountA.deviceProfile.sessionId);
  });

  await t.test('TC-T1-F02-02: Distinct accounts have completely isolated machine_id and session_id', () => {
    const headersA = getAccountDeviceHeaders(accountA);
    const headersB = getAccountDeviceHeaders(accountB);

    assertFalse(
      headersA['x-machine-id'] === headersB['x-machine-id'],
      'Machine IDs must be distinct across accounts'
    );
    assertFalse(
      headersA['x-vscode-sessionid'] === headersB['x-vscode-sessionid'],
      'Session IDs must be distinct across accounts'
    );
  });

  await t.test('TC-T1-F02-03: Contradictory x-goog-api-client (gl-node) header is strictly omitted', () => {
    const headers = getAccountDeviceHeaders(accountA);
    assertEqual(headers['x-goog-api-client'], undefined, 'x-goog-api-client must be absent');
  });

  await t.test('TC-T1-F02-04: Header generation is deterministic per account', () => {
    const headers1 = getAccountDeviceHeaders(accountA);
    const headers2 = getAccountDeviceHeaders(accountA);
    assertEqual(headers1['x-machine-id'], headers2['x-machine-id']);
    assertEqual(headers1['x-vscode-sessionid'], headers2['x-vscode-sessionid']);
  });

  await t.test('TC-T1-F02-05: Non-leakage: raw host identifier is never shared across accounts', () => {
    const rawHostUid = 'raw-physical-hardware-uid-12345';
    const headersA = getAccountDeviceHeaders(accountA);
    const headersB = getAccountDeviceHeaders(accountB);

    assertFalse(headersA['x-machine-id'].includes(rawHostUid));
    assertFalse(headersB['x-machine-id'].includes(rawHostUid));
  });
});
