import { Account, LiveLimitStatus } from '../types/account';

export function getLiveLimitForModel(
    account: Account,
    modelId?: string,
    protectedKey?: string
): LiveLimitStatus | undefined {
    if (!account.live_limited_models) return undefined;
    
    if (modelId && account.live_limited_models[modelId]) {
        return account.live_limited_models[modelId];
    }
    
    if (protectedKey && account.live_limited_models[protectedKey]) {
        return account.live_limited_models[protectedKey];
    }
    
    return undefined;
}

export interface LiveLimitState {
    shouldShow: boolean;
    isActive: boolean;
    secondsRemaining: number;
    secondsAgo: number;
}

export function getLiveLimitState(liveLimit?: LiveLimitStatus): LiveLimitState {
    if (!liveLimit) {
        return {
            shouldShow: false,
            isActive: false,
            secondsRemaining: 0,
            secondsAgo: 0,
        };
    }

    const now = Math.floor(Date.now() / 1000);
    const secondsRemaining = Math.max(0, liveLimit.until - now);
    const secondsAgo = Math.max(0, now - liveLimit.detected_at);
    
    const isActive = secondsRemaining > 0;
    const shouldShow = isActive || secondsAgo < 600; // 10 minutes

    return {
        shouldShow,
        isActive,
        secondsRemaining,
        secondsAgo,
    };
}

export function formatCompactDuration(seconds: number): string {
    if (seconds <= 0) return '0s';
    
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
        return `${h}h ${m}m`;
    }
    if (m > 0) {
        return `${m}m ${s}s`;
    }
    return `${s}s`;
}
