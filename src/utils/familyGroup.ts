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
    modelResets: Record<string, number>;
    subscriptionTier?: string;
}

/**
 * Extracts normalized epoch-second timestamps for weekly, 5h, and model-level quota resets.
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

    const modelResets: Record<string, number> = {};
    for (const m of account.quota?.models || []) {
        const sec = toSec(m.reset_time);
        if (sec !== null) {
            modelResets[m.name.toLowerCase()] = sec;
        }
    }

    // Also check quota_groups buckets if present
    for (const group of account.quota?.quota_groups || []) {
        for (const bucket of group.buckets || []) {
            const sec = toSec(bucket.reset_time);
            if (sec !== null) {
                const bId = (bucket.bucket_id || bucket.window || '').toLowerCase();
                modelResets[`bucket:${bId}`] = sec;
            }
        }
    }

    return {
        weeklyResetSec,
        fiveHourResetSec,
        modelResets,
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

    // If both have weekly resets and they do NOT match, they cannot be in the same Google Family
    if (fpA.weeklyResetSec !== null && fpB.weeklyResetSec !== null) {
        if (Math.abs(fpA.weeklyResetSec - fpB.weeklyResetSec) > 1) {
            return false;
        }
    }

    // If both have 5-hour resets and they do NOT match, they cannot be in the same Google Family
    if (fpA.fiveHourResetSec !== null && fpB.fiveHourResetSec !== null) {
        if (Math.abs(fpA.fiveHourResetSec - fpB.fiveHourResetSec) > 1) {
            return false;
        }
    }

    // Rule 1: Both have valid weekly reset AND 5-hour reset matching down to the second (tolerance <= 1s)
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
                    return true;
                }
            }
            // Check paid tier match (Pro / Ultra subscription periods align to the exact second)
            const isPaidA = fpA.subscriptionTier?.includes('pro') || fpA.subscriptionTier?.includes('ultra');
            const isPaidB = fpB.subscriptionTier?.includes('pro') || fpB.subscriptionTier?.includes('ultra');
            if (isPaidA && isPaidB && fpA.subscriptionTier === fpB.subscriptionTier) {
                return true;
            }
        }
    }

    // Rule 3: Both have 5-hour reset matching down to the second AND primary model matching
    if (fpA.fiveHourResetSec !== null && fpB.fiveHourResetSec !== null) {
        const fiveHourMatch = Math.abs(fpA.fiveHourResetSec - fpB.fiveHourResetSec) <= 1;
        if (fiveHourMatch) {
            let sharedModelMatches = 0;
            for (const [modelName, secA] of Object.entries(fpA.modelResets)) {
                const secB = fpB.modelResets[modelName];
                if (secB !== undefined && Math.abs(secA - secB) <= 1) {
                    sharedModelMatches++;
                }
            }
            if (sharedModelMatches >= 1) {
                return true;
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
        // 1. If the current active account is in this family, prefer it
        // 2. Otherwise pick the member present in accounts
        const familyMembersInList = accounts.filter((a) => group.accountIds.includes(a.id || ''));
        const representative =
            (currentAccountId && familyMembersInList.find((a) => a.id === currentAccountId)) ||
            familyMembersInList[0] ||
            acc;

        capacityUnits.push(representative);
    }

    return capacityUnits;
}
