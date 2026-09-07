import test from 'node:test';
import { assertEqual, assertTrue, assertFalse, assertIncludes, assertNotIncludes } from '../harness/assertions';

export const V1_INTERNAL_BASE_URL_PROD = 'https://cloudcode-pa.googleapis.com/v1internal';
export const DISALLOWED_ENDPOINTS = [
  'https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal',
  'https://staging-cloudcode-pa.googleapis.com/v1internal',
  'https://cloudcode-pa-dev.sandbox.googleapis.com/v1internal',
];

export function buildUpstreamUrl(baseUrl: string, method: string, queryString: string): string {
  if (baseUrl !== V1_INTERNAL_BASE_URL_PROD) {
    throw new Error('Security Violation: Disallowed upstream endpoint: ' + baseUrl);
  }
  if (method.includes('..') || method.includes('/') || method.includes('\\')) {
    throw new Error('Security Violation: Invalid method name: ' + method);
  }
  const cleanQuery = queryString.startsWith('?') ? queryString : (queryString ? '?' + queryString : '');
  return baseUrl + ':' + method + cleanQuery;
}

export function maskEmail(email: string): string {
  const atPos = email.indexOf('@');
  if (atPos !== -1) {
    const local = email.slice(0, atPos);
    const domain = email.slice(atPos + 1);
    const localPrefix = local.slice(0, 3);
    const domainPrefix = domain.slice(0, 2);
    return localPrefix + '***@' + domainPrefix + '***';
  } else {
    return email.slice(0, 5) + '***';
  }
}

export function sanitizeErrorForLog(errorText: string): string {
  const reKeys = new RegExp('(access_token|refresh_token|id_token|authorization|api_key|secret|password|proxy_url|http_proxy|https_proxy)\\s*[:=]\\s*[^\\s,}\\]]+', 'gi');
  let redacted = errorText.replace(reKeys, (_m, p1) => p1 + '=<redacted>');
  const reBearer = new RegExp('(bearer\\s+)[^\\s,}\\]]+', 'gi');
  redacted = redacted.replace(reBearer, (_m, p1) => p1 + '<redacted>');
  if (redacted.length > 1000) {
    return redacted.slice(0, 1000) + '... (truncated)';
  }
  return redacted;
}

test('Feature 4: Production Route Sanitization & Credential Scrubbing', async (t) => {
  await t.test('TC-T1-F04-01: Production endpoint is strictly whitelisted for generateContent', () => {
    const url = buildUpstreamUrl(V1_INTERNAL_BASE_URL_PROD, 'generateContent', '');
    assertEqual(url, 'https://cloudcode-pa.googleapis.com/v1internal:generateContent');
  });

  await t.test('TC-T1-F04-02: Non-production sandbox endpoints are strictly rejected', () => {
    for (const disallowed of DISALLOWED_ENDPOINTS) {
      let threw = false;
      try {
        buildUpstreamUrl(disallowed, 'generateContent', '');
      } catch (err: unknown) {
        threw = true;
        assertIncludes((err as Error).message, 'Disallowed upstream endpoint');
      }
      assertTrue(threw, 'Should have rejected disallowed endpoint: ' + disallowed);
    }
  });

  await t.test('TC-T1-F04-03: Query strings are preserved accurately in streamGenerateContent', () => {
    const url = buildUpstreamUrl(V1_INTERNAL_BASE_URL_PROD, 'streamGenerateContent', 'alt=sse');
    assertEqual(url, 'https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse');
  });

  await t.test('TC-T1-F04-04: Path traversal attempts in method name are blocked', () => {
    let threw = false;
    try {
      buildUpstreamUrl(V1_INTERNAL_BASE_URL_PROD, '../v1/models', '');
    } catch (err: unknown) {
      threw = true;
      assertIncludes((err as Error).message, 'Invalid method name');
    }
    assertTrue(threw);
  });

  await t.test('TC-T1-F04-05: Sensitive credential scrubbing removes tokens and proxy credentials from logs', () => {
    const rawError = 'Upstream 403 error: Bearer ya29.a0AfH6SM... and access_token: secret_abc123 with proxy_url=http://user:pass123@proxy.com:8080';
    const sanitized = sanitizeErrorForLog(rawError);

    assertNotIncludes(sanitized, 'ya29.a0AfH6SM');
    assertNotIncludes(sanitized, 'secret_abc123');
    assertNotIncludes(sanitized, 'pass123');
    assertIncludes(sanitized.toLowerCase(), 'bearer <redacted>');
    assertIncludes(sanitized.toLowerCase(), 'access_token=<redacted>');
    assertIncludes(sanitized.toLowerCase(), 'proxy_url=<redacted>');
  });

  await t.test('TC-T1-F04-06: Email addresses are masked consistently for privacy', () => {
    assertEqual(maskEmail('developer@gmail.com'), 'dev***@gm***');
    assertEqual(maskEmail('admin@corp.internal.net'), 'adm***@co***');
    assertEqual(maskEmail('nonstandard'), 'nonst***');
  });
});
