/**
 * Predictive Burn Rate & Fleet Quota Sustainability Engine
 * 
 * Mathematically calculates:
 * - Hourly consumption velocity (V = Q_used / T_elapsed)
 * - Sustainability ratio (S = Q_rem_pct / T_rem_pct)
 * - Projected Time to Depletion (TTD / Runway)
 * - Estimated depletion date & time
 * - Deficit / Surplus gap hours before weekly reset
 * - Normalized gauge angle (0 to 180 deg)
 */

export interface BurnVelocityMetrics {
  sustainabilityRatio: number; // S: <1 means burning faster than time; >1 means surplus
  hourlyBurnRatePct: number; // % consumed per hour
  runwayHoursRemaining: number; // hours of quota remaining at current velocity
  projectedDepletionDate: Date | null;
  isDepletedBeforeReset: boolean;
  deficitHours: number; // hours before weekly reset when quota hits 0
  surplusHours: number; // hours of surplus beyond reset
  zone: 'critical' | 'high_burn' | 'balanced' | 'safe' | 'surplus';
  zoneLabel: string;
  zoneTag: 'STRONG SELL' | 'SELL' | 'NEUTRAL' | 'BUY' | 'STRONG BUY';
  zoneColor: string;
  gaugeAngle: number; // 0 (far left, red) to 180 (far right, green), 90 = balanced
  timeRemainingHours: number;
  quotaRemainingPct: number;
  timeRemainingPct: number;
  // Session (Rolling 5-Hour Limit) Horizon Prediction
  sessionRemainingPct?: number;
  sessionResetTimeMs?: number;
  sessionRunwayMinutes?: number;
  sessionDepletionDate?: Date | null;
  sessionDepletionFormatted?: string;
  isSessionAtRisk?: boolean;
}

export interface AccountLike {
  id?: string;
  disabled?: boolean;
  proxy_disabled?: boolean;
  validation_blocked?: boolean;
  quota?: {
    is_forbidden?: boolean;
    quota_groups?: Array<{
      display_name?: string;
      buckets?: Array<{
        window?: string;
        bucket_id?: string;
        remaining_fraction?: number;
        reset_time?: string;
      }>;
    }>;
    models?: Array<{
      name?: string;
      percentage?: number;
      reset_time?: string;
    }>;
  };
}

/**
 * Calculates predictive runway & consumption velocity for an individual account
 */
export function calculateAccountBurnVelocity(
  account: AccountLike,
  now = Date.now(),
  windowHours = 168 // 7 days default
): BurnVelocityMetrics {
  let quotaRemainingPct = 100;
  let resetTimeMs = now + windowHours * 3600 * 1000;

  // 1. Extract weekly quota from quota_groups
  const weeklyBucket = account.quota?.quota_groups
    ?.flatMap((g) => g.buckets || [])
    ?.find(
      (b) =>
        b?.window?.toLowerCase().includes('week') ||
        b?.bucket_id?.toLowerCase().includes('week')
    );

  if (weeklyBucket) {
    if (typeof weeklyBucket.remaining_fraction === 'number') {
      quotaRemainingPct = Math.max(0, Math.min(100, weeklyBucket.remaining_fraction * 100));
    }
    if (weeklyBucket.reset_time) {
      const parsed = new Date(weeklyBucket.reset_time).getTime();
      if (!isNaN(parsed) && parsed > now) {
        resetTimeMs = parsed;
      }
    }
  } else if (account.quota?.models && account.quota.models.length > 0) {
    const primary =
      account.quota.models.find(
        (m) => m.name?.toLowerCase().includes('pro') || m.name?.toLowerCase().includes('flash')
      ) || account.quota.models[0];
    if (primary && typeof primary.percentage === 'number') {
      quotaRemainingPct = Math.max(0, Math.min(100, primary.percentage));
    }
    if (primary?.reset_time) {
      const parsed = new Date(primary.reset_time).getTime();
      if (!isNaN(parsed) && parsed > now) {
        resetTimeMs = parsed;
      }
    }
  }

  // 1b. Extract 5-hour rolling session bucket (primary IDE session boundary)
  const sessionBucket = account.quota?.quota_groups
    ?.flatMap((g) => g.buckets || [])
    ?.find(
      (b) =>
        b?.window?.toLowerCase().includes('5h') ||
        b?.bucket_id?.toLowerCase().includes('5h')
    );

  let sessionRemainingPct: number | undefined;
  let sessionResetTimeMs: number | undefined;
  let sessionRunwayMinutes: number | undefined;
  let sessionDepletionDate: Date | null = null;
  let sessionDepletionFormatted: string | undefined;
  let isSessionAtRisk = false;

  if (sessionBucket) {
    if (typeof sessionBucket.remaining_fraction === 'number') {
      sessionRemainingPct = Math.max(0, Math.min(100, Math.round(sessionBucket.remaining_fraction * 100)));
    }
    if (sessionBucket.reset_time) {
      const parsed = new Date(sessionBucket.reset_time).getTime();
      if (!isNaN(parsed) && parsed > now) {
        sessionResetTimeMs = parsed;
      }
    }
  } else if (account.quota?.models && account.quota.models.length > 0) {
    const flashModel = account.quota.models.find(
      (m) => m.name?.toLowerCase().includes('flash') || m.name?.toLowerCase().includes('pro')
    );
    if (flashModel) {
      if (typeof flashModel.percentage === 'number') {
        sessionRemainingPct = flashModel.percentage;
      }
      if (flashModel.reset_time) {
        const parsed = new Date(flashModel.reset_time).getTime();
        if (!isNaN(parsed) && parsed > now) {
          sessionResetTimeMs = parsed;
        }
      }
    }
  }

  if (sessionRemainingPct !== undefined && sessionResetTimeMs !== undefined) {
    const sessionTimeRemHours = Math.max(0.01, (sessionResetTimeMs - now) / (1000 * 3600));
    const sessionTimeElapsedHours = Math.max(0.1, 5 - sessionTimeRemHours);
    const sessionUsedPct = Math.max(0, 100 - sessionRemainingPct);
    const sessionBurnRate = sessionUsedPct / sessionTimeElapsedHours;

    if (sessionRemainingPct === 0) {
      sessionRunwayMinutes = 0;
      sessionDepletionDate = new Date(now);
      isSessionAtRisk = true;
      sessionDepletionFormatted = 'اتمام سهمیه سشن (0%)';
    } else if (sessionBurnRate > 0.5) {
      const remMins = Math.round((sessionRemainingPct / sessionBurnRate) * 60);
      sessionRunwayMinutes = remMins;
      const totalSessionRemMins = Math.round(sessionTimeRemHours * 60);

      if (remMins < totalSessionRemMins) {
        isSessionAtRisk = true;
        sessionDepletionDate = new Date(now + remMins * 60 * 1000);
        const hours = Math.floor(remMins / 60);
        const mins = remMins % 60;
        const timePart = sessionDepletionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const durPart = hours > 0 ? `${hours} ساعت و ${mins} دقیقه دیگر` : `${mins} دقیقه دیگر`;
        sessionDepletionFormatted = `${durPart} (ساعت ${timePart})`;
      } else {
        const resetDate = new Date(sessionResetTimeMs);
        const timePart = resetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        sessionDepletionFormatted = `پایدار تا ریست بعدی (ساعت ${timePart})`;
      }
    } else {
      sessionRunwayMinutes = Math.round(sessionTimeRemHours * 60);
      const resetDate = new Date(sessionResetTimeMs);
      const timePart = resetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      sessionDepletionFormatted = `پایدار تا ریست بعدی (ساعت ${timePart})`;
    }
  }

  const timeRemainingHours = Math.max(0.1, (resetTimeMs - now) / (1000 * 3600));
  const timeRemainingPct = Math.max(0.1, Math.min(100, (timeRemainingHours / windowHours) * 100));
  const timeElapsedHours = Math.max(0.5, windowHours - timeRemainingHours);
  const quotaUsedPct = Math.max(0, 100 - quotaRemainingPct);

  // Velocity in % per hour
  const hourlyBurnRatePct = quotaUsedPct > 0.5 ? quotaUsedPct / timeElapsedHours : 0;

  // Sustainability Ratio S = Q_rem% / T_rem%
  let sustainabilityRatio = 1.0;
  if (quotaUsedPct <= 0.5) {
    // Virtually untouched
    sustainabilityRatio = 2.0;
  } else {
    sustainabilityRatio = quotaRemainingPct / timeRemainingPct;
  }

  // Runway in hours
  let runwayHoursRemaining = 999;
  if (hourlyBurnRatePct > 0.005) {
    runwayHoursRemaining = quotaRemainingPct / hourlyBurnRatePct;
  }

  // Depletion projection
  let projectedDepletionDate: Date | null = null;
  if (runwayHoursRemaining < 999 && quotaRemainingPct > 0) {
    projectedDepletionDate = new Date(now + runwayHoursRemaining * 3600 * 1000);
  }

  // Gap between time to reset and runway
  const gapHours = timeRemainingHours - runwayHoursRemaining;
  const isDepletedBeforeReset = gapHours > 0.5 && quotaRemainingPct < 100;
  const deficitHours = isDepletedBeforeReset ? Math.round(gapHours) : 0;
  const surplusHours = !isDepletedBeforeReset ? Math.round(Math.max(0, -gapHours)) : 0;

  // Zones & Colors
  let zone: BurnVelocityMetrics['zone'] = 'balanced';
  let zoneLabel = 'Balanced Pace';
  let zoneTag: BurnVelocityMetrics['zoneTag'] = 'NEUTRAL';
  let zoneColor = '#94a3b8'; // Slate/White

  if (sustainabilityRatio < 0.5) {
    zone = 'critical';
    zoneLabel = 'Critical Burn';
    zoneTag = 'STRONG SELL';
    zoneColor = '#f43f5e'; // Crimson
  } else if (sustainabilityRatio < 0.85) {
    zone = 'high_burn';
    zoneLabel = 'Over-Burning';
    zoneTag = 'SELL';
    zoneColor = '#f59e0b'; // Amber
  } else if (sustainabilityRatio <= 1.15) {
    zone = 'balanced';
    zoneLabel = 'Balanced Pace';
    zoneTag = 'NEUTRAL';
    zoneColor = '#38bdf8'; // Sky Blue
  } else if (sustainabilityRatio <= 1.6) {
    zone = 'safe';
    zoneLabel = 'Safe Reserve';
    zoneTag = 'BUY';
    zoneColor = '#06b6d4'; // Cyan
  } else {
    zone = 'surplus';
    zoneLabel = 'Full Surplus';
    zoneTag = 'STRONG BUY';
    zoneColor = '#10b981'; // Emerald
  }

  // Smooth Gauge Angle: 0 to 180 deg (90 is S = 1.0)
  let gaugeAngle = 90;
  if (sustainabilityRatio <= 1.0) {
    gaugeAngle = Math.max(0, Math.min(90, sustainabilityRatio * 90));
  } else {
    const extra = Math.min(1.0, (sustainabilityRatio - 1.0) / 1.0);
    gaugeAngle = Math.min(180, 90 + extra * 90);
  }

  return {
    sustainabilityRatio: Number(sustainabilityRatio.toFixed(2)),
    hourlyBurnRatePct: Number(hourlyBurnRatePct.toFixed(2)),
    runwayHoursRemaining: Math.round(runwayHoursRemaining),
    projectedDepletionDate,
    isDepletedBeforeReset,
    deficitHours,
    surplusHours,
    zone,
    zoneLabel,
    zoneTag,
    zoneColor,
    gaugeAngle: Math.round(gaugeAngle),
    timeRemainingHours: Math.round(timeRemainingHours),
    quotaRemainingPct: Math.round(quotaRemainingPct),
    timeRemainingPct: Math.round(timeRemainingPct),
    sessionRemainingPct,
    sessionResetTimeMs,
    sessionRunwayMinutes,
    sessionDepletionDate,
    sessionDepletionFormatted,
    isSessionAtRisk,
  };
}

/**
 * Calculates aggregate fleet sustainability & burn metrics across all active accounts
 */
export function calculateFleetBurnVelocity(
  accounts: AccountLike[],
  now = Date.now()
): BurnVelocityMetrics {
  if (!accounts || accounts.length === 0) {
    return {
      sustainabilityRatio: 1.0,
      hourlyBurnRatePct: 0,
      runwayHoursRemaining: 168,
      projectedDepletionDate: null,
      isDepletedBeforeReset: false,
      deficitHours: 0,
      surplusHours: 168,
      zone: 'balanced',
      zoneLabel: 'Balanced Pace',
      zoneTag: 'NEUTRAL',
      zoneColor: '#38bdf8',
      gaugeAngle: 90,
      timeRemainingHours: 168,
      quotaRemainingPct: 100,
      timeRemainingPct: 100,
    };
  }

  // 1. Filter active eligible accounts (exclude disabled, banned, or blocked accounts)
  const activeAccounts = accounts.filter(
    (acc) =>
      !acc.disabled &&
      !acc.proxy_disabled &&
      !acc.validation_blocked &&
      !acc.quota?.is_forbidden
  );

  // Fallback to all accounts if every account is currently disabled/blocked
  const targetAccounts = activeAccounts.length > 0 ? activeAccounts : accounts;

  let totalQuotaRem = 0;
  let totalTimeRemPct = 0;
  let totalTimeRemHours = 0;
  let totalBurnRate = 0;
  let validAccounts = 0;

  for (const acc of targetAccounts) {
    const m = calculateAccountBurnVelocity(acc, now);
    totalQuotaRem += m.quotaRemainingPct;
    totalTimeRemPct += m.timeRemainingPct;
    totalTimeRemHours += m.timeRemainingHours;
    totalBurnRate += m.hourlyBurnRatePct;
    validAccounts++;
  }

  if (validAccounts === 0) {
    return {
      sustainabilityRatio: 1.0,
      hourlyBurnRatePct: 0,
      runwayHoursRemaining: 168,
      projectedDepletionDate: null,
      isDepletedBeforeReset: false,
      deficitHours: 0,
      surplusHours: 168,
      zone: 'balanced',
      zoneLabel: 'Balanced Pace',
      zoneTag: 'NEUTRAL',
      zoneColor: '#38bdf8',
      gaugeAngle: 90,
      timeRemainingHours: 168,
      quotaRemainingPct: 100,
      timeRemainingPct: 100,
    };
  }

  // Aggregate pool metrics across active accounts
  const avgQuotaRem = totalQuotaRem / validAccounts;
  const avgTimeRemPct = totalTimeRemPct / validAccounts;
  const avgTimeRemHours = totalTimeRemHours / validAccounts;
  const avgBurnRate = totalBurnRate / validAccounts;

  // Best Method: Pooled Aggregate Ratio (Ratio of Totals) with robust boundary safeguards
  // S_fleet = (Total Quota Remaining) / (Total Time Remaining)
  let sustainabilityRatio = 1.0;

  if (avgQuotaRem <= 0.05) {
    sustainabilityRatio = 0.0;
  } else if (avgQuotaRem >= 99.5 && avgBurnRate <= 0.005) {
    // Virtually untouched fleet quota
    sustainabilityRatio = 2.0;
  } else {
    // Epsilon guard: remaining time guarded to at least 1.0% (~1.68 hours) to prevent division explosion
    const safeTimeRemPct = Math.max(1.0, avgTimeRemPct);
    const rawRatio = avgQuotaRem / safeTimeRemPct;
    // Bound the ratio cleanly between 0.0 and 2.5
    sustainabilityRatio = Math.max(0.0, Math.min(2.5, rawRatio));
  }

  let runwayHoursRemaining = 999;
  if (avgBurnRate > 0.005) {
    runwayHoursRemaining = avgQuotaRem / avgBurnRate;
  }

  let projectedDepletionDate: Date | null = null;
  if (runwayHoursRemaining < 999 && avgQuotaRem > 0) {
    projectedDepletionDate = new Date(now + runwayHoursRemaining * 3600 * 1000);
  }

  const gapHours = avgTimeRemHours - runwayHoursRemaining;
  const isDepletedBeforeReset = gapHours > 0.5 && avgQuotaRem < 100;
  const deficitHours = isDepletedBeforeReset ? Math.round(gapHours) : 0;
  const surplusHours = !isDepletedBeforeReset ? Math.round(Math.max(0, -gapHours)) : 0;

  let zone: BurnVelocityMetrics['zone'] = 'balanced';
  let zoneLabel = 'Balanced Fleet';
  let zoneTag: BurnVelocityMetrics['zoneTag'] = 'NEUTRAL';
  let zoneColor = '#38bdf8';

  if (sustainabilityRatio < 0.5) {
    zone = 'critical';
    zoneLabel = 'Fleet Over-Draining';
    zoneTag = 'STRONG SELL';
    zoneColor = '#f43f5e';
  } else if (sustainabilityRatio < 0.85) {
    zone = 'high_burn';
    zoneLabel = 'High Consumption Pace';
    zoneTag = 'SELL';
    zoneColor = '#f59e0b';
  } else if (sustainabilityRatio <= 1.15) {
    zone = 'balanced';
    zoneLabel = 'Balanced Sustainability';
    zoneTag = 'NEUTRAL';
    zoneColor = '#38bdf8';
  } else if (sustainabilityRatio <= 1.6) {
    zone = 'safe';
    zoneLabel = 'Healthy Fleet Buffer';
    zoneTag = 'BUY';
    zoneColor = '#06b6d4';
  } else {
    zone = 'surplus';
    zoneLabel = 'Maximum Quota Surplus';
    zoneTag = 'STRONG BUY';
    zoneColor = '#10b981';
  }

  let gaugeAngle = 90;
  if (sustainabilityRatio <= 1.0) {
    gaugeAngle = Math.max(0, Math.min(90, sustainabilityRatio * 90));
  } else {
    const extra = Math.min(1.0, (sustainabilityRatio - 1.0) / 1.0);
    gaugeAngle = Math.min(180, 90 + extra * 90);
  }

  return {
    sustainabilityRatio: Number(sustainabilityRatio.toFixed(2)),
    hourlyBurnRatePct: Number(avgBurnRate.toFixed(2)),
    runwayHoursRemaining: Math.round(runwayHoursRemaining),
    projectedDepletionDate,
    isDepletedBeforeReset,
    deficitHours,
    surplusHours,
    zone,
    zoneLabel,
    zoneTag,
    zoneColor,
    gaugeAngle: Math.round(gaugeAngle),
    timeRemainingHours: Math.round(avgTimeRemHours),
    quotaRemainingPct: Math.round(avgQuotaRem),
    timeRemainingPct: Math.round(avgTimeRemPct),
  };
}
