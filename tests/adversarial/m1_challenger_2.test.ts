import test from 'node:test';
import crypto from 'node:crypto';
import { assertEqual, assertTrue, assertFalse, assertNotIncludes, assertIncludes } from '../e2e/harness/assertions';
import {
  V1_INTERNAL_BASE_URL_PROD,
  DISALLOWED_ENDPOINTS,
  buildUpstreamUrl,
  sanitizeErrorForLog,
  maskEmail,
} from '../e2e/suites/url_sanitization.test';
import {
  deriveAccountDeviceProfile,
  getAccountDeviceHeaders,
  sanitizeHeaderValue,
} from '../e2e/suites/device_fingerprint_isolation.test';
import { createMockAccount } from '../e2e/harness/test_context';

/**
 * High-fidelity TypeScript reproduction of Rust's is_whitelisted_production_url
 * from src-tauri/src/proxy/upstream/client.rs:76-99
 */
function rustIsWhitelistedProductionUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();
  if (
    lower.includes('sandbox') ||
    lower.includes('daily') ||
    lower.includes('autopush') ||
    lower.includes('staging') ||
    lower.includes('test')
  ) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'cloudcode-pa.googleapis.com' &&
      parsed.pathname.startsWith('/v1internal')
    );
  } catch {
    return false;
  }
}

/**
 * High-fidelity TypeScript reproduction of Rust's sanitize_v1_internal_base_url
 * from src-tauri/src/proxy/upstream/client.rs:103-114
 */
function rustSanitizeV1InternalBaseUrl(rawUrl: string): string {
  if (rustIsWhitelistedProductionUrl(rawUrl)) {
    return V1_INTERNAL_BASE_URL_PROD;
  }
  return V1_INTERNAL_BASE_URL_PROD;
}

/**
 * High-fidelity TypeScript reproduction of Rust's derive_account_machine_id
 * from src-tauri/src/modules/device.rs:457-480
 */
function rustDeriveAccountMachineId(accountId: string, hostSeed: string = 'host-hardware-uuid-test'): string {
  const hasher = crypto.createHash('sha256');
  hasher.update('antigravity:device_profile:machine_id:v1:');
  hasher.update(hostSeed);
  hasher.update(':');
  hasher.update(accountId);
  const digest = hasher.digest();

  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant RFC 4122

  return [
    bytes.subarray(0, 4).toString('hex'),
    bytes.subarray(4, 6).toString('hex'),
    bytes.subarray(6, 8).toString('hex'),
    bytes.subarray(8, 10).toString('hex'),
    bytes.subarray(10, 16).toString('hex'),
  ].join('-');
}

test('ADVERSARIAL VERIFICATION: URL Whitelisting, Staging/Sandbox Blocking & SSRF Resistance', async (t) => {
  await t.test('ADV-URL-01: Disallow staging, sandbox, daily, autopush variants across protocols and cases', () => {
    const maliciousUrls = [
      'https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal',
      'https://staging-cloudcode-pa.googleapis.com/v1internal',
      'https://cloudcode-pa-dev.sandbox.googleapis.com/v1internal',
      'https://autopush-cloudcode-pa.sandbox.googleapis.com/v1internal',
      'https://test-cloudcode-pa.sandbox.googleapis.com/v1internal',
      'HTTPS://DAILY-CLOUDCODE-PA.SANDBOX.GOOGLEAPIS.COM/V1INTERNAL',
      'HTTPS://STAGING-CLOUDCODE-PA.GOOGLEAPIS.COM/V1INTERNAL',
      'https://cloudcode-pa.sandbox.googleapis.com/v1internal',
      'https://cloudcode-pa.googleapis.com/v1internal-daily',
      'https://cloudcode-pa.googleapis.com/v1internal/test',
    ];

    for (const badUrl of maliciousUrls) {
      // 1. Check buildUpstreamUrl rejection
      let threw = false;
      try {
        buildUpstreamUrl(badUrl, 'generateContent', '');
      } catch (err: unknown) {
        threw = true;
        assertIncludes((err as Error).message, 'Disallowed upstream endpoint');
      }
      assertTrue(threw, `buildUpstreamUrl failed to reject disallowed URL: ${badUrl}`);

      // 2. Check Rust is_whitelisted_production_url rejection
      assertFalse(
        rustIsWhitelistedProductionUrl(badUrl),
        `Rust is_whitelisted_production_url allowed non-prod URL: ${badUrl}`
      );

      // 3. Check Rust sanitize fallback always forces production
      assertEqual(
        rustSanitizeV1InternalBaseUrl(badUrl),
        V1_INTERNAL_BASE_URL_PROD,
        `Rust sanitize failed to neutralize: ${badUrl}`
      );
    }
  });

  await t.test('ADV-URL-02: SSRF & Host Spoofing Resistance', () => {
    const ssrfVectors = [
      'http://169.254.169.254/latest/meta-data',
      'http://169.254.169.254/computeMetadata/v1/',
      'http://127.0.0.1:8080/v1internal',
      'http://localhost:3000/v1internal',
      'http://[::1]:8080/v1internal',
      'http://0.0.0.0:8080/v1internal',
      'https://cloudcode-pa.googleapis.com.attacker.com/v1internal',
      'https://cloudcode-pa.googleapis.com@attacker.com/v1internal',
      'https://attacker.com#cloudcode-pa.googleapis.com/v1internal',
      'https://attacker.com/cloudcode-pa.googleapis.com/v1internal',
      'http://cloudcode-pa.googleapis.com/v1internal', // HTTP plaintext downgrade
      'ftp://cloudcode-pa.googleapis.com/v1internal',
      'file:///etc/passwd',
      'gopher://127.0.0.1:6379/_flushall',
    ];

    for (const vector of ssrfVectors) {
      let threw = false;
      try {
        buildUpstreamUrl(vector, 'generateContent', '');
      } catch (err: unknown) {
        threw = true;
      }
      assertTrue(threw, `buildUpstreamUrl allowed SSRF vector: ${vector}`);

      assertFalse(
        rustIsWhitelistedProductionUrl(vector),
        `Rust whitelisting allowed SSRF vector: ${vector}`
      );

      assertEqual(
        rustSanitizeV1InternalBaseUrl(vector),
        V1_INTERNAL_BASE_URL_PROD,
        `Rust sanitizer did not neutralize SSRF vector: ${vector}`
      );
    }
  });

  await t.test('ADV-URL-03: Method Path Traversal Attacks are strictly blocked', () => {
    const maliciousMethods = [
      '../v1/models',
      '../../../../etc/passwd',
      '..\\windows\\win.ini',
      'generateContent/../v1beta',
      'generateContent/models',
      'generateContent\\secret',
      '/generateContent',
      '\\generateContent',
    ];

    for (const badMethod of maliciousMethods) {
      let threw = false;
      try {
        buildUpstreamUrl(V1_INTERNAL_BASE_URL_PROD, badMethod, '');
      } catch (err: unknown) {
        threw = true;
        assertIncludes((err as Error).message, 'Invalid method name');
      }
      assertTrue(threw, `buildUpstreamUrl allowed malicious method: ${badMethod}`);
    }
  });

  await t.test('ADV-URL-04: Credential Scrubbing Baseline', () => {
    const leaks = [
      'Upstream error: Bearer ya29.SECRET_TOKEN_VALUE_12345 with code 403',
      'Client config: access_token: ya29.A0AfH6S-1234567890abcdef and refresh_token: 1//0gMOCK_REFRESH_12345',
      'Proxy authentication error: proxy_url=http://admin:SuperSecretP@ssword!@10.0.0.1:8080/path',
      'Environment dump: HTTP_PROXY=http://user:p%40ss@proxy.corp.net:3128 HTTPS_PROXY=https://corp:secret@gw.corp.net',
    ];

    for (const leak of leaks) {
      const scrubbed = sanitizeErrorForLog(leak);
      assertNotIncludes(scrubbed, 'ya29.SECRET_TOKEN_VALUE_12345');
      assertNotIncludes(scrubbed, 'ya29.A0AfH6S-1234567890abcdef');
      assertNotIncludes(scrubbed, '1//0gMOCK_REFRESH_12345');
      assertNotIncludes(scrubbed, 'SuperSecretP@ssword!');
      assertNotIncludes(scrubbed, 'p%40ss');
      assertNotIncludes(scrubbed, 'secret@gw');
    }
  });

  // EMPIRICAL CHALLENGE 1: Reproduce Credential Leak When "authorization: Bearer <token>" is logged
  await t.test('ADV-CHALLENGE-01: [BUG DEMO] authorization: Bearer token leaks raw token', () => {
    const rawError = 'authorization: Bearer ya29.super_secret_token_leaked';
    const scrubbed = sanitizeErrorForLog(rawError);

    // The bug: reKeys turns "authorization: Bearer" into "authorization=<redacted>",
    // leaving " ya29.super_secret_token_leaked" unredacted!
    const tokenLeaked = scrubbed.includes('ya29.super_secret_token_leaked');
    assertTrue(
      tokenLeaked,
      'Empirically demonstrates bug: sanitizeErrorForLog leaks raw Bearer token when prefixed by authorization:'
    );
  });

  // EMPIRICAL CHALLENGE 2: Reproduce Port Bypass on Rust is_whitelisted_production_url
  await t.test('ADV-CHALLENGE-02: [BUG DEMO] is_whitelisted_production_url ignores port in URL', () => {
    const urlWithPort = 'https://cloudcode-pa.googleapis.com:8443/v1internal';
    const accepted = rustIsWhitelistedProductionUrl(urlWithPort);

    // The bug: parsed.host_str() does not check parsed.port()
    assertTrue(
      accepted,
      'Empirically demonstrates bug: is_whitelisted_production_url does not restrict non-standard ports (e.g. :8443)'
    );
  });

  // EMPIRICAL CHALLENGE 3: Reproduce Colon In Method Name
  await t.test('ADV-CHALLENGE-03: [BUG DEMO] buildUpstreamUrl permits colon separator in method name', () => {
    const customMethod = 'v1internal:generateContent';
    let threw = false;
    let url = '';
    try {
      url = buildUpstreamUrl(V1_INTERNAL_BASE_URL_PROD, customMethod, '');
    } catch {
      threw = true;
    }

    assertFalse(threw, 'buildUpstreamUrl did not reject colon in method name');
    assertEqual(url, 'https://cloudcode-pa.googleapis.com/v1internal:v1internal:generateContent');
  });
});

test('ADVERSARIAL VERIFICATION: DeviceProfile Fingerprint Isolation & Host UID Leak Prevention', async (t) => {
  const PHYSICAL_HOST_UID = 'b4829fa1-41e9-4e5a-93e1-38c641de002a';

  await t.test('ADV-DEV-01: Zero Host UID Leakage in Rust and TypeScript Generators', () => {
    // Test 100 distinct accounts
    for (let i = 0; i < 100; i++) {
      const accountId = `user-prod-account-${i}`;
      
      // TypeScript derived profile
      const tsProfile = deriveAccountDeviceProfile(accountId, PHYSICAL_HOST_UID);
      assertNotIncludes(tsProfile.machineId, PHYSICAL_HOST_UID);
      assertNotIncludes(tsProfile.macMachineId, PHYSICAL_HOST_UID);
      assertNotIncludes(tsProfile.sessionId, PHYSICAL_HOST_UID);

      // Rust derived machine ID
      const rustMachineId = rustDeriveAccountMachineId(accountId, PHYSICAL_HOST_UID);
      assertNotIncludes(rustMachineId, PHYSICAL_HOST_UID);

      // Verify UUID structure of Rust machine ID (RFC 4122 v4)
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      assertTrue(uuidV4Regex.test(rustMachineId), `Rust machine ID is not valid UUIDv4: ${rustMachineId}`);

      // Test header generation
      const mockAcc = createMockAccount(accountId, `test-${i}@gmail.com`);
      const headers = getAccountDeviceHeaders(mockAcc);
      for (const [key, value] of Object.entries(headers)) {
        assertNotIncludes(value, PHYSICAL_HOST_UID, `Header ${key} leaked physical host UID`);
      }
    }
  });

  await t.test('ADV-DEV-02: Zero Collision Across 500 Virtual Hardware Machine IDs and Sessions', () => {
    const machineIdSet = new Set<string>();
    const macIdSet = new Set<string>();
    const sessionIdSet = new Set<string>();
    const rustMachineIdSet = new Set<string>();

    for (let i = 0; i < 500; i++) {
      const accId = `acc-${i}-${crypto.randomUUID()}`;
      const tsProfile = deriveAccountDeviceProfile(accId);
      const rustMid = rustDeriveAccountMachineId(accId, PHYSICAL_HOST_UID);

      assertFalse(machineIdSet.has(tsProfile.machineId), `Collision on TS machineId: ${tsProfile.machineId}`);
      assertFalse(macIdSet.has(tsProfile.macMachineId), `Collision on TS macMachineId: ${tsProfile.macMachineId}`);
      assertFalse(sessionIdSet.has(tsProfile.sessionId), `Collision on TS sessionId: ${tsProfile.sessionId}`);
      assertFalse(rustMachineIdSet.has(rustMid), `Collision on Rust machineId: ${rustMid}`);

      machineIdSet.add(tsProfile.machineId);
      macIdSet.add(tsProfile.macMachineId);
      sessionIdSet.add(tsProfile.sessionId);
      rustMachineIdSet.add(rustMid);
    }

    assertEqual(machineIdSet.size, 500);
    assertEqual(macIdSet.size, 500);
    assertEqual(sessionIdSet.size, 500);
    assertEqual(rustMachineIdSet.size, 500);
  });

  await t.test('ADV-DEV-03: Boundary & Pathological Account IDs', () => {
    const pathologicalIds = [
      '',
      '   ',
      'a'.repeat(2048),
      '!@#$%^&*()_+-=[]{}|;\':",.<>?/',
      "' OR '1'='1",
      '../../../../etc/passwd',
      'acc\r\nInjected: True',
      '用户-9988_αβγ-🚀',
      '\0\0\0nullbytes',
    ];

    for (const badId of pathologicalIds) {
      // Must not throw, crash, or return empty machine ID
      const rustMid = rustDeriveAccountMachineId(badId, PHYSICAL_HOST_UID);
      assertTrue(rustMid.length >= 36, `Rust mid too short for ID: ${badId}`);
      assertNotIncludes(rustMid, PHYSICAL_HOST_UID);

      const tsProfile = deriveAccountDeviceProfile(badId);
      assertTrue(tsProfile.machineId.length > 10);
      assertNotIncludes(tsProfile.machineId, PHYSICAL_HOST_UID);
    }
  });

  await t.test('ADV-DEV-04: Strict Omission of Contradictory Headers (x-goog-api-client)', () => {
    const acc = createMockAccount('acc-anti-detect', 'antidetect@corp.com');
    const headers = getAccountDeviceHeaders(acc);

    assertEqual(headers['x-goog-api-client'], undefined, 'x-goog-api-client must not be present');
    assertEqual(headers['x-client-name'], 'antigravity');
    assertEqual(headers['user-agent'], 'antigravity');
  });

  await t.test('ADV-DEV-05: CRLF Injection in Token, Version, or Machine IDs', () => {
    const taintedAcc = createMockAccount('acc-crlf', 'crlf@test.com');
    taintedAcc.accessToken = 'secret-tok\r\nInjected-Header: evil\r\n';
    taintedAcc.deviceProfile.machineId = 'mach-123\r\nInjected: x';
    taintedAcc.deviceProfile.sessionId = 'sess-456\r\nEvil: true';

    const headers = getAccountDeviceHeaders(taintedAcc, '4.6.7\r\nX-Bad: 1');

    for (const [k, v] of Object.entries(headers)) {
      assertNotIncludes(v, '\r', `CRLF CR detected in header: ${k}`);
      assertNotIncludes(v, '\n', `CRLF LF detected in header: ${k}`);
      assertNotIncludes(v, '\0', `Null byte detected in header: ${k}`);
    }
    assertEqual(headers['Injected-Header'], undefined);
    assertEqual(headers['Injected'], undefined);
    assertEqual(headers['Evil'], undefined);
    assertEqual(headers['X-Bad'], undefined);
  });
});
