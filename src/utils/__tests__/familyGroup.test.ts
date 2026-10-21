/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Tests for Family Group Detection & Quota Clustering
 */

import {
    areAccountsInSameFamily,
    clusterAccountsByFamily,
    reorderAccountsPreservingFamily,
    getDistinctCapacityUnits,
} from '../familyGroup';
import type { Account } from '../../types/account';

let passed = 0;
let failed = 0;

function test(description: string, fn: () => void): void {
    try {
        fn();
        passed++;
    } catch (e: unknown) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  FAIL: ${description} — ${msg}`);
    }
}

function assert(condition: boolean, msg?: string): void {
    if (!condition) {
        throw new Error(msg || 'Assertion failed');
    }
}

function assertEqual<T>(actual: T, expected: T, msg?: string): void {
    if (actual !== expected) {
        throw new Error(`${msg ? msg + ': ' : ''}expected "${expected}", got "${actual}"`);
    }
}

function makeMockAccount(
    id: string,
    email: string,
    weeklyReset: string | null,
    fiveHourReset: string | null,
    modelProReset?: string,
    tier = 'PRO'
): Account {
    return {
        id,
        email,
        token: { access_token: 'tok', refresh_token: 'ref', expires_in: 3600, expiry_timestamp: Date.now() + 3600000, token_type: 'Bearer' },
        created_at: Date.now(),
        last_used: Date.now(),
        quota: {
            last_updated: Date.now(),
            subscription_tier: tier,
            quota_groups: [
                {
                    display_name: 'Gemini Models',
                    buckets: [
                        ...(weeklyReset ? [{
                            bucket_id: 'weekly-bucket',
                            window: 'weekly',
                            remaining_fraction: 0.85,
                            reset_time: weeklyReset,
                        }] : []),
                        ...(fiveHourReset ? [{
                            bucket_id: '5h-bucket',
                            window: '5h',
                            remaining_fraction: 0.70,
                            reset_time: fiveHourReset,
                        }] : []),
                    ],
                },
            ],
            models: [
                {
                    name: 'gemini-2.5-pro',
                    percentage: 70,
                    reset_time: modelProReset || fiveHourReset || '2026-10-25T14:30:00Z',
                },
            ],
        },
    };
}

console.log('--- Running Family Group Tests ---');

test('identical weekly and 5-hour resets down to the second match as family', () => {
    const acc1 = makeMockAccount('acc-1', 'father@gmail.com', '2026-10-28T12:00:00Z', '2026-10-21T22:30:15Z');
    const acc2 = makeMockAccount('acc-2', 'child@gmail.com', '2026-10-28T12:00:00Z', '2026-10-21T22:30:15Z');
    assert(areAccountsInSameFamily(acc1, acc2), 'Accounts should be detected as same family');
});

test('different weekly resets do not match', () => {
    const acc1 = makeMockAccount('acc-1', 'user1@gmail.com', '2026-10-28T12:00:00Z', '2026-10-21T22:30:15Z');
    const acc2 = makeMockAccount('acc-2', 'user2@gmail.com', '2026-10-29T15:20:00Z', '2026-10-21T22:30:15Z');
    assert(!areAccountsInSameFamily(acc1, acc2), 'Different weekly reset should not match');
});

test('clustering clusters multiple family accounts and separates outsiders', () => {
    const fam1 = makeMockAccount('fam-1', 'parent@gmail.com', '2026-10-28T12:00:00Z', '2026-10-21T22:30:15Z');
    const fam2 = makeMockAccount('fam-2', 'kid1@gmail.com', '2026-10-28T12:00:00Z', '2026-10-21T22:30:15Z');
    const fam3 = makeMockAccount('fam-3', 'kid2@gmail.com', '2026-10-28T12:00:00Z', '2026-10-21T22:30:15Z');
    const solo = makeMockAccount('solo-1', 'solo@gmail.com', '2026-10-27T08:15:00Z', '2026-10-21T19:00:00Z');

    const result = clusterAccountsByFamily([fam1, solo, fam2, fam3]);
    assertEqual(result.familyGroups.length, 1, 'Should find exactly 1 family group');
    assertEqual(result.familyGroups[0].accountIds.length, 3, 'Family group should have 3 members');
    assert(result.familyAccountIdsSet.has('fam-1'));
    assert(result.familyAccountIdsSet.has('fam-2'));
    assert(result.familyAccountIdsSet.has('fam-3'));
    assert(!result.familyAccountIdsSet.has('solo-1'));
});

test('reorderAccountsPreservingFamily groups family members contiguously', () => {
    const fam1 = makeMockAccount('fam-1', 'parent@gmail.com', '2026-10-28T12:00:00Z', '2026-10-21T22:30:15Z');
    const fam2 = makeMockAccount('fam-2', 'kid1@gmail.com', '2026-10-28T12:00:00Z', '2026-10-21T22:30:15Z');
    const solo1 = makeMockAccount('solo-1', 'solo1@gmail.com', '2026-10-26T00:00:00Z', '2026-10-21T18:00:00Z');
    const solo2 = makeMockAccount('solo-2', 'solo2@gmail.com', '2026-10-25T00:00:00Z', '2026-10-21T17:00:00Z');

    // Scattered order: fam1, solo1, fam2, solo2
    const reordered = reorderAccountsPreservingFamily([fam1, solo1, fam2, solo2]);
    const ids = reordered.map(a => a.id);
    // fam1 and fam2 should be adjacent!
    const fam1Index = ids.indexOf('fam-1');
    const fam2Index = ids.indexOf('fam-2');
    assertEqual(Math.abs(fam1Index - fam2Index), 1, 'Family members should be adjacent');
});

test('getDistinctCapacityUnits deduplicates family members into single capacity unit', () => {
    const fam1 = makeMockAccount('fam-1', 'parent@gmail.com', '2026-10-28T12:00:00Z', '2026-10-21T22:30:15Z');
    const fam2 = makeMockAccount('fam-2', 'kid1@gmail.com', '2026-10-28T12:00:00Z', '2026-10-21T22:30:15Z');
    const fam3 = makeMockAccount('fam-3', 'kid2@gmail.com', '2026-10-28T12:00:00Z', '2026-10-21T22:30:15Z');
    const solo1 = makeMockAccount('solo-1', 'solo1@gmail.com', '2026-10-26T00:00:00Z', '2026-10-21T18:00:00Z');

    const units = getDistinctCapacityUnits([fam1, fam2, fam3, solo1], 'fam-2');
    assertEqual(units.length, 2, 'Should collapse 3 family members + 1 solo into 2 units');
    // Active account fam-2 was requested as currentAccountId, so fam-2 should be the representative
    const unitIds = units.map(u => u.id);
    assert(unitIds.includes('fam-2'), 'Should include requested active account fam-2 as representative');
    assert(unitIds.includes('solo-1'), 'Should include solo-1');
});

test('handles accounts with missing or empty quota gracefully', () => {
    const empty1: Account = {
        id: 'empty-1',
        email: 'empty1@gmail.com',
        token: { access_token: '', refresh_token: '', expires_in: 0, expiry_timestamp: 0, token_type: '' },
        created_at: 0,
        last_used: 0,
    };
    const empty2: Account = {
        id: 'empty-2',
        email: 'empty2@gmail.com',
        token: { access_token: '', refresh_token: '', expires_in: 0, expiry_timestamp: 0, token_type: '' },
        created_at: 0,
        last_used: 0,
    };
    assert(!areAccountsInSameFamily(empty1, empty2), 'Accounts without quota cannot match');
    const result = clusterAccountsByFamily([empty1, empty2]);
    assertEqual(result.familyGroups.length, 0, 'No family groups should be created for empty accounts');
});

console.log(`\nTests finished: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
    throw new Error(`Test suite failed: ${failed} assertion(s) failed.`);
}
