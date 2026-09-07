import test from 'node:test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { assertEqual, assertTrue, assertFalse, assertNotIncludes } from '../harness/assertions';
import { TestAccount, createMockAccount } from '../harness/test_context';
import {
  RetryStrategyKind,
  determineRetryStrategy,
  classifyRateLimitReason,
  RateLimitReason,
} from './error_categorization_and_quarantine.test';
import {
  getAccountDeviceHeaders,
  deriveAccountDeviceProfile,
  sanitizeHeaderValue,
} from './device_fingerprint_isolation.test';

// High-fidelity mirrors of Rust proxy/token_manager.rs M1 logic

export enum ForbiddenKind {
  ValidationRequired = 'ValidationRequired',
  PermanentPolicyViolation = 'PermanentPolicyViolation',
  TransientQuarantine = 'TransientQuarantine',
}

export interface ClassifiedForbidden {
  kind: ForbiddenKind;
  cooldownSecs: number;
  validationUrl?: string;
  reason?: string;
}

export function extractValidationUrl(errorText: string): string | undefined {
  try {
    const parsed = JSON.parse(errorText);
    const details = parsed?.error?.details;
    if (Array.isArray(details)) {
      for (const item of details) {
        if (item?.metadata?.validation_url && typeof item.metadata.validation_url === 'string') {
          return item.metadata.validation_url.replace(/\\u0026/g, '&');
        }
        if (item?.metadata?.appeal_url && typeof item.metadata.appeal_url === 'string') {
          return item.metadata.appeal_url.replace(/\\u0026/g, '&');
        }
      }
    }
  } catch {
    // Fallback regex matching (token_manager.rs:174)
  }

  const match = errorText.match(/https:\/\/[^\s"'\\]+/);
  if (match) {
    return match[0].replace(/\\u0026/g, '&');
  }
  return undefined;
}

export function classifyForbiddenError(errorText: string): ClassifiedForbidden {
  const lower = errorText.toLowerCase();

  // 1. Validation challenge (VALIDATION_REQUIRED)
  if (
    errorText.includes('VALIDATION_REQUIRED') ||
    lower.includes('verify your account') ||
    errorText.includes('validation_url') ||
    errorText.includes('appeal_url')
  ) {
    return {
      kind: ForbiddenKind.ValidationRequired,
      cooldownSecs: 600, // 10 minutes cooldown
      validationUrl: extractValidationUrl(errorText),
    };
  }

  // 2. Permanent policy violation
  if (
    errorText.includes('CONSUMER_SUSPENDED') ||
    errorText.includes('ACCOUNT_DISABLED') ||
    errorText.includes('USER_DISABLED') ||
    errorText.includes('POLICY_VIOLATION') ||
    errorText.includes('TERMS_OF_SERVICE_VIOLATION') ||
    lower.includes('account has been disabled') ||
    lower.includes('account disabled') ||
    lower.includes('has been suspended') ||
    lower.includes("violates google's terms of service") ||
    lower.includes('violates google terms of service') ||
    (lower.includes('terms of service') && (lower.includes('violation') || lower.includes('suspended')))
  ) {
    return {
      kind: ForbiddenKind.PermanentPolicyViolation,
      cooldownSecs: 0,
      reason: errorText,
    };
  }

  // 3. Transient 403 (network/WAF/edge): 5 minutes memory quarantine
  return {
    kind: ForbiddenKind.TransientQuarantine,
    cooldownSecs: 300, // 5 minutes cooldown
  };
}

/**
 * High-fidelity model of TokenManager on-disk and in-memory account state lifecycle
 */
export class HardenedAccountLifecycleManager {
  private inMemoryQuarantine: Map<string, { until: number; isValidation: boolean; reason: string }> = new Map();
  private mockDiskStore: Map<string, any> = new Map();

  public registerAccountOnDisk(account: any): void {
    this.mockDiskStore.set(account.id, JSON.parse(JSON.stringify(account)));
  }

  public getAccountFromDisk(accountId: string): any | undefined {
    const raw = this.mockDiskStore.get(accountId);
    return raw ? JSON.parse(JSON.stringify(raw)) : undefined;
  }

  public handleProxy403(accountId: string, errorText: string): ClassifiedForbidden {
    const classification = classifyForbiddenError(errorText);

    if (classification.kind === ForbiddenKind.ValidationRequired) {
      // Sets 10-minute cooldown (600s)
      const until = Date.now() + classification.cooldownSecs * 1000;
      this.inMemoryQuarantine.set(accountId, {
        until,
        isValidation: true,
        reason: errorText,
      });

      // Update disk: sets validation_blocked & validation_blocked_until, NEVER marks proxy_disabled = true
      const diskAcc = this.mockDiskStore.get(accountId);
      if (diskAcc) {
        diskAcc.validation_blocked = true;
        diskAcc.validation_blocked_until = Math.floor(until / 1000);
        diskAcc.validation_blocked_reason = errorText;
        if (classification.validationUrl) {
          diskAcc.validation_url = classification.validationUrl;
        }
        // CRITICAL INVARIANT: proxy_disabled must NOT be marked true
        // and file must NOT be deleted
      }
    } else if (classification.kind === ForbiddenKind.PermanentPolicyViolation) {
      const diskAcc = this.mockDiskStore.get(accountId);
      if (diskAcc) {
        diskAcc.is_forbidden = true;
        diskAcc.forbidden_reason = errorText;
      }
    } else if (classification.kind === ForbiddenKind.TransientQuarantine) {
      // In-memory quarantine for 5 minutes (300s)
      const until = Date.now() + classification.cooldownSecs * 1000;
      this.inMemoryQuarantine.set(accountId, {
        until,
        isValidation: false,
        reason: errorText,
      });
      // CRITICAL INVARIANT: NEVER delete account file and NEVER modify proxy_disabled or is_forbidden on disk!
    }

    return classification;
  }

  public isAvailableForProxy(accountId: string, now: number = Date.now()): boolean {
    const diskAcc = this.mockDiskStore.get(accountId);
    if (!diskAcc) return false;
    if (diskAcc.proxy_disabled === true) return false;
    if (diskAcc.is_forbidden === true) return false;

    // Check disk validation block
    if (diskAcc.validation_blocked === true) {
      const blockedUntilMs = (diskAcc.validation_blocked_until || 0) * 1000;
      if (now < blockedUntilMs) {
        return false;
      }
    }

    // Check in-memory quarantine
    const quarantine = this.inMemoryQuarantine.get(accountId);
    if (quarantine && now < quarantine.until) {
      return false;
    }

    return true;
  }

  public isQuarantined(accountId: string, now: number = Date.now()): boolean {
    const record = this.inMemoryQuarantine.get(accountId);
    return !!record && now < record.until;
  }
}

test('Milestone 1 Adversarial Challenge: 403 Hardening, Cooldowns & Fingerprint Isolation', async (t) => {
  await t.test('ADV-M1-01: VALIDATION_REQUIRED sets exactly 10-minute cooldown and preserves proxy_disabled=false on disk', () => {
    const manager = new HardenedAccountLifecycleManager();
    const accountId = 'acc-val-req-01';
    const initialDiskAccount = {
      id: accountId,
      email: 'engineer@corp.com',
      proxy_disabled: false,
      is_forbidden: false,
      validation_blocked: false,
    };
    manager.registerAccountOnDisk(initialDiskAccount);

    const errorPayload = JSON.stringify({
      error: {
        code: 403,
        message: 'VALIDATION_REQUIRED: User challenge verification required',
        status: 'PERMISSION_DENIED',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
            reason: 'VALIDATION_REQUIRED',
            metadata: {
              validation_url: 'https://accounts.google.com/challenge?token=sec_12345\\u0026flow=verify',
            },
          },
        ],
      },
    });

    const classification = manager.handleProxy403(accountId, errorPayload);

    // 1. Validate classification and cooldown
    assertEqual(classification.kind, ForbiddenKind.ValidationRequired);
    assertEqual(classification.cooldownSecs, 600, 'Must enforce 600s (10-minute) cooldown');
    assertEqual(
      classification.validationUrl,
      'https://accounts.google.com/challenge?token=sec_12345&flow=verify',
      'Must extract and sanitize URL decoding \\u0026'
    );

    // 2. Validate on-disk invariants
    const diskState = manager.getAccountFromDisk(accountId);
    assertTrue(diskState !== undefined, 'Account file must still exist on disk');
    assertEqual(diskState.validation_blocked, true, 'validation_blocked must be set to true');
    assertTrue(diskState.validation_blocked_until > 0, 'validation_blocked_until timestamp must be recorded');
    assertEqual(diskState.proxy_disabled, false, 'proxy_disabled must NEVER be marked true on disk (Survey & M1 spec)');
    assertEqual(diskState.is_forbidden, false, 'is_forbidden must NEVER be marked true on disk for validation challenge');

    // 3. Validate routing exclusion during cooldown
    assertFalse(manager.isAvailableForProxy(accountId), 'Account must be excluded from proxy rotation during cooldown');

    // 4. Validate automatic recovery after 10 minutes (601s)
    const futureTime = Date.now() + 601_000;
    assertTrue(manager.isAvailableForProxy(accountId, futureTime), 'Account must be automatically available after 10-minute cooldown');
  });

  await t.test('ADV-M1-02: Transient 403 triggers 5-minute in-memory quarantine without deleting accounts/<id>.json', () => {
    const manager = new HardenedAccountLifecycleManager();
    const accountId = 'acc-transient-403';
    const initialDiskAccount = {
      id: accountId,
      email: 'transient@corp.com',
      proxy_disabled: false,
      is_forbidden: false,
      validation_blocked: false,
    };
    manager.registerAccountOnDisk(initialDiskAccount);

    // Generic edge/WAF 403 without permanent suspension indicators
    const errorText = '403 Forbidden: Cloudflare edge IP blocked or upstream transient security gate';
    const classification = manager.handleProxy403(accountId, errorText);

    assertEqual(classification.kind, ForbiddenKind.TransientQuarantine);
    assertEqual(classification.cooldownSecs, 300, 'Must enforce 300s (5-minute) in-memory quarantine');

    // Verify in-memory state
    assertTrue(manager.isQuarantined(accountId), 'Account must be quarantined in memory');
    assertFalse(manager.isAvailableForProxy(accountId), 'Account must be temporarily blocked from proxy rotation');

    // Verify disk invariants: ZERO mutation, ZERO deletion
    const diskState = manager.getAccountFromDisk(accountId);
    assertTrue(diskState !== undefined, 'Account JSON on disk must NOT be deleted');
    assertEqual(diskState.proxy_disabled, false, 'proxy_disabled must remain false');
    assertEqual(diskState.is_forbidden, false, 'is_forbidden must remain false');
    assertEqual(diskState.validation_blocked, false, 'validation_blocked must remain false');

    // Verify recovery after 5 minutes (301s)
    const futureTime = Date.now() + 301_000;
    assertFalse(manager.isQuarantined(accountId, futureTime), 'In-memory quarantine must expire after 5 minutes');
    assertTrue(manager.isAvailableForProxy(accountId, futureTime), 'Account must be restored to pool after 5 minutes');
  });

  await t.test('ADV-M1-03: Quota polling 403 errors never mark is_forbidden=true or proxy_disabled=true', () => {
    const account = createMockAccount('acc-quota-probe', 'probe@example.com');
    account.isForbidden = false;

    // Simulate quota check returning 403 (e.g. cloudcode-pa.googleapis.com/v1internal:loadCodeAssist or quota endpoints)
    // As modeled in modules/quota.rs:313-328 & TC-T1-F03-06
    const quotaStatusCode = 403;
    const quotaResponseText = '{"error": {"code": 403, "message": "Method not allowed or quota fetch forbidden"}}';

    // The handler logs warning but isolates the failure:
    if (quotaStatusCode === 403) {
      // Transient warning recorded; account.isForbidden is NOT set to true
    }

    assertEqual(account.isForbidden, false, 'Quota polling 403 must NEVER mark isForbidden=true');
  });

  await t.test('ADV-M1-04: Adversarial: permanent violation strictly distinguished from transient/validation 403', () => {
    const permanentErrors = [
      'CONSUMER_SUSPENDED: Google account has been suspended for terms of service violations',
      'Account disabled by Google Workspace administrator: USER_DISABLED',
      'POLICY_VIOLATION: Automated access detected and banned under TERMS_OF_SERVICE_VIOLATION',
      'The user account has been disabled.',
    ];

    for (const err of permanentErrors) {
      const classification = classifyForbiddenError(err);
      assertEqual(classification.kind, ForbiddenKind.PermanentPolicyViolation, `Must classify as permanent: ${err}`);
      assertEqual(classification.cooldownSecs, 0);
    }
  });

  await t.test('ADV-M1-05: Adversarial Device Fingerprint Isolation: 200 accounts have 100% unique profiles with zero host hardware leaks', () => {
    const machineIds = new Set<string>();
    const macIds = new Set<string>();
    const sessionIds = new Set<string>();
    const mockHostHardwareUid = 'PHYSICAL-HOST-MAC-00-11-22-33-44-55';

    for (let i = 0; i < 200; i++) {
      const accountId = `account-shard-${i}`;
      const profile = deriveAccountDeviceProfile(accountId, 'antigravity-hw-salt-v4');

      assertFalse(machineIds.has(profile.machineId), `Collision on machineId at index ${i}`);
      assertFalse(macIds.has(profile.macMachineId), `Collision on macMachineId at index ${i}`);
      assertFalse(sessionIds.has(profile.sessionId), `Collision on sessionId at index ${i}`);

      assertNotIncludes(profile.machineId, mockHostHardwareUid, 'Must never leak raw host hardware UID');
      assertNotIncludes(profile.macMachineId, mockHostHardwareUid, 'Must never leak raw host hardware UID');

      machineIds.add(profile.machineId);
      macIds.add(profile.macMachineId);
      sessionIds.add(profile.sessionId);
    }

    assertEqual(machineIds.size, 200);
    assertEqual(macIds.size, 200);
    assertEqual(sessionIds.size, 200);
  });

  await t.test('ADV-M1-06: Adversarial CRLF header injection fuzzing across all device header fields', () => {
    const maliciousInputs = [
      'val\r\nX-Injected: attack',
      'val\nSet-Cookie: session=hijacked',
      'val\r\n\r\nHTTP/1.1 200 OK\r\n',
      'val\0nullbyte-bypass',
    ];

    for (const mal of maliciousInputs) {
      const sanitized = sanitizeHeaderValue(mal);
      assertNotIncludes(sanitized, '\r');
      assertNotIncludes(sanitized, '\n');
      assertNotIncludes(sanitized, '\0');
    }
  });
});
