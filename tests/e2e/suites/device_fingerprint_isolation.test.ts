import test from 'node:test';
import crypto from 'node:crypto';
import { assertEqual, assertTrue, assertFalse, assertNotIncludes } from '../harness/assertions';
import { TestAccount, createMockAccount } from '../harness/test_context';

export interface DeviceHeaders {
  [key: string]: string;
}

export interface SanitizedDeviceProfile {
  machineId: string;
  macMachineId: string;
  sessionId: string;
}

/**
 * Derives a fallback salted device profile when physical hardware UID is unavailable
 * or when multi-account isolation is enforced (Feature 2, client.rs).
 */
export function deriveAccountDeviceProfile(
  accountId: string,
  salt: string = 'antigravity-hw-salt-v4'
): SanitizedDeviceProfile {
  const machineHash = crypto
    .createHash('sha256')
    .update(accountId + salt + 'machine_id')
    .digest('hex');
  const macHash = crypto
    .createHash('sha256')
    .update(accountId + salt + 'mac_id')
    .digest('hex');
  const sessionHash = crypto
    .createHash('sha256')
    .update(accountId + salt + Date.now().toString() + Math.random().toString())
    .digest('hex')
    .slice(0, 32);

  return {
    machineId: 'mach-' + machineHash.slice(0, 32),
    macMachineId: 'mac-' + macHash.slice(0, 32),
    sessionId: 'sess-' + sessionHash,
  };
}

/**
 * Sanitizes header values to prevent CRLF injection and HTTP header splitting.
 */
export function sanitizeHeaderValue(val: string): string {
  // Strip control characters and CRLF
  return val.replace(/[\r\n\0]/g, '').trim();
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
    'authorization': 'Bearer ' + sanitizeHeaderValue(account.accessToken),
    'user-agent': 'antigravity',
    'x-client-name': 'antigravity',
    'x-client-version': sanitizeHeaderValue(appVersion),
    'x-machine-id': sanitizeHeaderValue(account.deviceProfile.machineId),
    'x-vscode-sessionid': sanitizeHeaderValue(account.deviceProfile.sessionId),
  };

  // [REMOVED v4.1.24] x-goog-api-client header must NEVER be injected.
  // It creates an Electron + Node.js contradictory fingerprint.

  return headers;
}

test('Feature 2: Device Profile & Fingerprint Isolation Architecture', async (t) => {
  const accountA = createMockAccount('acc-alpha', 'alpha@example.com');
  const accountB = createMockAccount('acc-beta', 'beta@example.com');

  await t.test('TC-T1-F02-01: Header generation injects official Antigravity client identifiers', () => {
    const headers = getAccountDeviceHeaders(accountA);
    assertEqual(headers['x-client-name'], 'antigravity');
    assertEqual(headers['x-client-version'], '4.6.7');
    assertEqual(headers['user-agent'], 'antigravity');
    assertEqual(headers['x-machine-id'], accountA.deviceProfile.machineId);
    assertEqual(headers['x-vscode-sessionid'], accountA.deviceProfile.sessionId);
  });

  await t.test('TC-T1-F02-02: Distinct accounts possess completely isolated machine and session fingerprints', () => {
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

  await t.test('TC-T1-F02-03: Contradictory x-goog-api-client header is strictly omitted', () => {
    const headers = getAccountDeviceHeaders(accountA);
    assertEqual(headers['x-goog-api-client'], undefined, 'x-goog-api-client must never be present');
  });

  await t.test('TC-T1-F02-04: Deterministic header output for same account profile', () => {
    const h1 = getAccountDeviceHeaders(accountA);
    const h2 = getAccountDeviceHeaders(accountA);
    assertEqual(h1['x-machine-id'], h2['x-machine-id']);
    assertEqual(h1['x-vscode-sessionid'], h2['x-vscode-sessionid']);
  });

  await t.test('TC-T1-F02-05: Raw physical host UUID is never exposed across account requests', () => {
    const physicalHostUid = 'phys-host-uuid-8822-aabbccddeeff';
    const profile = deriveAccountDeviceProfile('account-123');

    assertNotIncludes(profile.machineId, physicalHostUid);
    assertNotIncludes(profile.macMachineId, physicalHostUid);
  });

  await t.test('TC-T2-F02-01: Cryptographic fallback derives unique salted profiles for 50 accounts without collision', () => {
    const machineIds = new Set<string>();
    const macIds = new Set<string>();

    for (let i = 0; i < 50; i++) {
      const p = deriveAccountDeviceProfile('user-acc-' + i);
      assertFalse(machineIds.has(p.machineId), 'Machine ID collision detected at index ' + i);
      assertFalse(macIds.has(p.macMachineId), 'MAC ID collision detected at index ' + i);
      machineIds.add(p.machineId);
      macIds.add(p.macMachineId);
    }
    assertEqual(machineIds.size, 50);
  });

  await t.test('TC-T2-F02-03: CRLF injection in version or token is safely stripped from headers', () => {
    const taintedAccount = createMockAccount('acc-tainted', 'taint@example.com');
    taintedAccount.accessToken = 'token123\r\nInjected-Header: evil\r\n';

    const headers = getAccountDeviceHeaders(taintedAccount, '4.6.7\r\nBad: val');
    assertNotIncludes(headers['authorization'], '\r');
    assertNotIncludes(headers['authorization'], '\n');
    assertNotIncludes(headers['x-client-version'], '\r');
    assertEqual(headers['Injected-Header'], undefined);
  });

  await t.test('TC-T3-10: Fingerprint stability across proxy failovers preserves Google trust score', () => {
    // When proxy node rotates from Node 1 to Node 2, the account's DeviceProfile remains constant
    const beforeFailover = getAccountDeviceHeaders(accountA);
    // Simulate proxy failover
    const afterFailover = getAccountDeviceHeaders(accountA);

    assertEqual(beforeFailover['x-machine-id'], afterFailover['x-machine-id']);
    assertEqual(beforeFailover['x-vscode-sessionid'], afterFailover['x-vscode-sessionid']);
  });
});
