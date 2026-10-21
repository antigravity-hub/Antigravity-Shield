/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Family Group Detection & Quota Clustering Engine
 */

import { Account } from '../types/account';
import { getAccountWeeklyReset, getAccountFiveHourReset } from './quota';

export interface FamilyGroup {
    id: string;
    accountIds: string[];
    accounts: Account[];
    isFamily: boolean; // true if >= 2 accounts share pooled family quota
}

export interface AccountFamilyInfo {
    familyId: string | null;
    isFamilyMember: boolean;
    familySize: number;
    isFirstInFamily: boolean;
    isLastInFamily: boolean;
}

export interface QuotaFingerprint {
    weeklyResetSec: number | null;
    fiveHourResetSec: number | null;
    weeklyFraction: number | null;
    fiveHourFraction: number | null;
    modelResets: Record<string, number>;
    modelFractions: Record<string, number>;
    subscriptionTier?: string;
}

/**
 * Extracts normalized epoch-second timestamps and fractions for weekly, 5h, and model-level quota resets.
 */
export function extractAccountQuotaFingerprint(account: Account): QuotaFingerprint {
    const weeklyInfo = getAccountWeeklyReset(account, 'gemini');
    const fiveHourInfo = getAccountFiveHourReset(account, 'gemini');

    const toSec = (dateStr: string | null | undefined): number | null => {
        if (!dateStr) return null;
        const ms = new Date(dateStr).getTime();
        if (isNaN(ms) || ms <= 0) return null;
        return Math.floor(ms / 1000);
    };

    const weeklyResetSec = toSec(weeklyInfo.resetTime);
    const fiveHourResetSec = toSec(fiveHourInfo.resetTime);

    let weeklyFraction: number | null = null;
    let fiveHourFraction: number | null = null;
    const modelResets: Record<string, number> = {};
    const modelFractions: Record<string, number> = {};

    for (const m of account.quota?.models || []) {
        const sec = toSec(m.reset_time);
        const name = m.name.toLowerCase();
        if (sec !== null) {
            modelResets[name] = sec;
        }
        if (typeof m.percentage === 'number') {
            modelFractions[name] = m.percentage / 100;
        }
    }

    // Also check quota_groups buckets if present
    for (const group of account.quota?.quota_groups || []) {
        for (const bucket of group.buckets || []) {
            const sec = toSec(bucket.reset_time);
            const bId = (bucket.bucket_id || bucket.window || '').toLowerCase();
            const bWindow = (bucket.window || '').toLowerCase();
            if (sec !== null) {
                modelResets[`bucket:${bId}`] = sec;
            }
            if (typeof bucket.remaining_fraction === 'number') {
                modelFractions[`bucket:${bId}`] = bucket.remaining_fraction;
                if (bId.includes('week') || bWindow.includes('week')) {
                    weeklyFraction = bucket.remaining_fraction;
                }
                if (bId.includes('5h') || bWindow.includes('5h') || (!bId.includes('week') && bWindow.includes('hour'))) {
                    fiveHourFraction = bucket.remaining_fraction;
                }
            }
        }
    }

    return {
        weeklyResetSec,
        fiveHourResetSec,
        weeklyFraction,
        fiveHourFraction,
        modelResets,
        modelFractions,
        subscriptionTier: account.quota?.subscription_tier?.toLowerCase(),
    };
}

/**
 * Evaluates whether two accounts belong to the same Google Family pool.
 * In a Google Family, members share the same Google One pooled capacity.
 * Consequently, their 5-hour and weekly reset times are identical down to the exact second.
 */
export function areAccountsInSameFamily(a: Account, b: Account): boolean {
    if (!a || !b || a.id === b.id) return false;
    if (!a.quota || !b.quota) return false;

    const fpA = extractAccountQuotaFingerprint(a);
    const fpB = extractAccountQuotaFingerprint(b);

    // Negative guard 1: If both have weekly resets and they do NOT match down to the second, NOT family
    if (fpA.weeklyResetSec !== null && fpB.weeklyResetSec !== null) {
        if (Math.abs(fpA.weeklyResetSec - fpB.weeklyResetSec) > 1) {
            return false;
        }
    }

    // Negative guard 2: If both have 5-hour resets and they do NOT match down to the second, NOT family
    if (fpA.fiveHourResetSec !== null && fpB.fiveHourResetSec !== null) {
        if (Math.abs(fpA.fiveHourResetSec - fpB.fiveHourResetSec) > 1) {
            return false;
        }
    }

    // Negative guard 3: If both have weekly remaining fractions and they differ by > 0.05, NOT pooled
    if (fpA.weeklyFraction !== null && fpB.weeklyFraction !== null) {
        if (Math.abs(fpA.weeklyFraction - fpB.weeklyFraction) > 0.05) {
            return false;
        }
    }

    // Negative guard 4: If both have 5-hour remaining fractions and they differ by > 0.05, NOT pooled
    if (fpA.fiveHourFraction !== null && fpB.fiveHourFraction !== null) {
        if (Math.abs(fpA.fiveHourFraction - fpB.fiveHourFraction) > 0.05) {
            return false;
        }
    }

    // Rule 1 (Primary - User spec): Both have valid weekly reset AND 5-hour reset matching down to the second (<= 1s)
    if (fpA.weeklyResetSec !== null && fpB.weeklyResetSec !== null && fpA.fiveHourResetSec !== null && fpB.fiveHourResetSec !== null) {
        const weeklyMatch = Math.abs(fpA.weeklyResetSec - fpB.weeklyResetSec) <= 1;
        const fiveHourMatch = Math.abs(fpA.fiveHourResetSec - fpB.fiveHourResetSec) <= 1;
        if (weeklyMatch && fiveHourMatch) {
            return true;
        }
    }

    // Rule 2: Identical weekly reset down to the second AND matching reset on any active model
    if (fpA.weeklyResetSec !== null && fpB.weeklyResetSec !== null) {
        const weeklyMatch = Math.abs(fpA.weeklyResetSec - fpB.weeklyResetSec) <= 1;
        if (weeklyMatch) {
            // Check if any model reset matches down to the second
            for (const [modelName, secA] of Object.entries(fpA.modelResets)) {
                const secB = fpB.modelResets[modelName];
                if (secB !== undefined && Math.abs(secA - secB) <= 1) {
                    // Check quota fraction correlation on this model if available
                    const fracA = fpA.modelFractions[modelName];
                    const fracB = fpB.modelFractions[modelName];
                    if (fracA !== undefined && fracB !== undefined) {
                        if (Math.abs(fracA - fracB) <= 0.05) {
                            return true;
                        }
                    } else {
                        return true;
                    }
                }
            }
        }
    }

    // Rule 3: Both have 5-hour reset matching down to the second AND model reset matching
    if (fpA.fiveHourResetSec !== null && fpB.fiveHourResetSec !== null) {
        const fiveHourMatch = Math.abs(fpA.fiveHourResetSec - fpB.fiveHourResetSec) <= 1;
        if (fiveHourMatch) {
            for (const [modelName, secA] of Object.entries(fpA.modelResets)) {
                const secB = fpB.modelResets[modelName];
                if (secB !== undefined && Math.abs(secA - secB) <= 1) {
                    const fracA = fpA.modelFractions[modelName];
                    const fracB = fpB.modelFractions[modelName];
                    if (fracA !== undefined && fracB !== undefined) {
                        if (Math.abs(fracA - fracB) <= 0.05) {
                            return true;
                        }
                    } else {
                        return true;
                    }
                }
            }
        }
    }

    return false;
}

/**
 * Clusters a list of accounts into Family Groups using Union-Find / Connected Components.
 * Returns a map of accountId -> FamilyGroup, and a list of all FamilyGroups.
 */
export function clusterAccountsByFamily(accounts: Account[]): {
    familyGroups: FamilyGroup[];
    accountFamilyMap: Map<string, FamilyGroup>;
    familyAccountIdsSet: Set<string>;
} {
    if (!accounts || accounts.length === 0) {
        return {
            familyGroups: [],
            accountFamilyMap: new Map(),
            familyAccountIdsSet: new Set(),
        };
    }

    // Disjoint Set Union (Union-Find)
    const parent = new Map<string, string>();
    const find = (id: string): string => {
        const p = parent.get(id);
        if (p === undefined || p === id) {
            parent.set(id, id);
            return id;
        }
        const root = find(p);
        parent.set(id, root);
        return root;
    };

    const union = (id1: string, id2: string) => {
        const r1 = find(id1);
        const r2 = find(id2);
        if (r1 !== r2) {
            parent.set(r1, r2);
        }
    };

    // Initialize Union-Find
    for (const acc of accounts) {
        parent.set(acc.id, acc.id);
    }

    // Pairwise comparisons
    const n = accounts.length;
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (areAccountsInSameFamily(accounts[i], accounts[j])) {
                union(accounts[i].id, accounts[j].id);
            }
        }
    }

    // Aggregate into groups
    const groupMembers = new Map<string, Account[]>();
    for (const acc of accounts) {
        const root = find(acc.id);
        if (!groupMembers.has(root)) {
            groupMembers.set(root, []);
        }
        groupMembers.get(root)!.push(acc);
    }

    const familyGroups: FamilyGroup[] = [];
    const accountFamilyMap = new Map<string, FamilyGroup>();
    const familyAccountIdsSet = new Set<string>();

    let familyCounter = 1;
    for (const [, members] of groupMembers.entries()) {
        const isFamily = members.length >= 2;
        const groupId = isFamily ? `family-${familyCounter++}` : `individual-${members[0].id}`;
        const group: FamilyGroup = {
            id: groupId,
            accountIds: members.map((m) => m.id),
            accounts: members,
            isFamily,
        };

        if (isFamily) {
            familyGroups.push(group);
            for (const m of members) {
                familyAccountIdsSet.add(m.id);
            }
        }

        for (const m of members) {
            accountFamilyMap.set(m.id, group);
        }
    }

    return {
        familyGroups,
        accountFamilyMap,
        familyAccountIdsSet,
    };
}

/**
 * Reorders a list of accounts so that members of the same Family Group remain
 * strictly contiguous (side-by-side) for UI grouping.
 */
export function reorderAccountsPreservingFamily(accounts: Account[]): Account[] {
    if (!accounts || accounts.length <= 1) return accounts;

    const { accountFamilyMap } = clusterAccountsByFamily(accounts);
    const seenFamilies = new Set<string>();
    const ordered: Account[] = [];

    for (const acc of accounts) {
        const group = accountFamilyMap.get(acc.id);
        if (!group || !group.isFamily) {
            ordered.push(acc);
            continue;
        }

        if (seenFamilies.has(group.id)) {
            // Already added this family cluster contiguously
            continue;
        }

        seenFamilies.add(group.id);
        // Add all members of this family that exist in the input list
        const familyMemberIds = new Set(group.accountIds);
        const membersInInput = accounts.filter((a) => familyMemberIds.has(a.id));
        for (const member of membersInInput) {
            ordered.push(member);
        }
    }

    return ordered;
}

/**
 * Deduplicates pooled family accounts into single capacity units for fleet quota calculations.
 * In a family group, all accounts share the same Google One quota pool;
 * thus each family group must be counted as ONE distinct capacity unit.
 */
export function getDistinctCapacityUnits<T extends { id?: string; quota?: any }>(
    accounts: T[],
    currentAccountId?: string | null
): T[] {
    if (!accounts || accounts.length === 0) return [];

    const { familyGroups, accountFamilyMap } = clusterAccountsByFamily(accounts as unknown as Account[]);
    if (familyGroups.length === 0) return accounts;

    const seenFamilies = new Set<string>();
    const capacityUnits: T[] = [];

    for (const acc of accounts) {
        const accId = acc.id || '';
        const group = accountFamilyMap.get(accId);

        if (!group || !group.isFamily) {
            capacityUnits.push(acc);
            continue;
        }

        if (seenFamilies.has(group.id)) {
            continue;
        }

        seenFamilies.add(group.id);

        // Pick representative account for this family pool:
        // 1. Prefer member with valid, non-empty, non-forbidden quota models
        // 2. If current active account is in this family and has valid quota, prefer it
        // 3. Otherwise pick the member with the freshest quota update (latest last_updated timestamp)
        const familyMembersInList = accounts.filter((a) => group.accountIds.includes(a.id || ''));
        const membersWithValidQuota = familyMembersInList.filter(
            (m) => m.quota && Array.isArray(m.quota.models) && m.quota.models.length > 0 && !m.quota.is_forbidden
        );

        let representative: T;
        if (membersWithValidQuota.length > 0) {
            const activeMember = currentAccountId
                ? membersWithValidQuota.find((m) => m.id === currentAccountId)
                : null;
            if (activeMember) {
                representative = activeMember;
            } else {
                representative = membersWithValidQuota.reduce((freshest, curr) => {
                    const freshestTime = freshest.quota?.last_updated || 0;
                    const currTime = curr.quota?.last_updated || 0;
                    return currTime > freshestTime ? curr : freshest;
                });
            }
        } else {
            representative =
                (currentAccountId && familyMembersInList.find((a) => a.id === currentAccountId)) ||
                familyMembersInList[0] ||
                acc;
        }

        capacityUnits.push(representative);
    }

    return capacityUnits;
}
