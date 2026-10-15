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
    } else if (sessionBurnRate > 0.5) {
      const remMins = Math.round((sessionRemainingPct / sessionBurnRate) * 60);
      sessionRunwayMinutes = remMins;
      const totalSessionRemMins = Math.round(sessionTimeRemHours * 60);

      if (remMins < totalSessionRemMins) {
        isSessionAtRisk = true;
        sessionDepletionDate = new Date(now + remMins * 60 * 1000);
      } else {
        sessionDepletionDate = new Date(sessionResetTimeMs);
        isSessionAtRisk = false;
      }
    } else {
      sessionRunwayMinutes = Math.round(sessionTimeRemHours * 60);
      sessionDepletionDate = new Date(sessionResetTimeMs);
      isSessionAtRisk = false;
    }
  }

  const timeRemainingHours = Math.max(0.1, (resetTimeMs - now) / (1000 * 3600));
  const timeRemainingPct = Math.max(0.1, Math.min(100, (timeRemainingHours / windowHours) * 100));
  const timeElapsedHours = Math.max(0.5, windowHours - timeRemainingHours);
  const quotaUsedPct = Math.max(0, 100 - quotaRemainingPct);

  // Velocity in % per hour
  const hourlyBurnRatePct = quotaUsedPct > 0.5 ? quotaUsedPct / timeElapsedHours : 0;

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

  // Unified Mathematical Sustainability Ratio: S = Runway / TimeToReset
  // Invariant: S >= 1.0 <=> Runway >= TimeToReset <=> isDepletedBeforeReset is false
  let sustainabilityRatio = 1.0;
  if (quotaUsedPct <= 0.5 || hourlyBurnRatePct <= 0.005) {
    // Virtually untouched
    sustainabilityRatio = 2.0;
  } else {
    const rawRatio = runwayHoursRemaining / timeRemainingHours;
    sustainabilityRatio = Math.max(0.0, Math.min(2.5, rawRatio));
  }

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
    zoneColor = '#4ade9a'; // Seafoam Mid
  } else if (sustainabilityRatio <= 1.6) {
    zone = 'safe';
    zoneLabel = 'Safe Reserve';
    zoneTag = 'BUY';
    zoneColor = '#93e9be'; // Seafoam Core Green
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
    sustainabilityRatio: isNaN(sustainabilityRatio) ? 1.0 : Number(sustainabilityRatio.toFixed(2)),
    hourlyBurnRatePct: isNaN(hourlyBurnRatePct) ? 0 : Number(hourlyBurnRatePct.toFixed(2)),
    runwayHoursRemaining: isNaN(runwayHoursRemaining) ? 168 : Math.round(runwayHoursRemaining),
    projectedDepletionDate,
    isDepletedBeforeReset,
    deficitHours: isNaN(deficitHours) ? 0 : deficitHours,
    surplusHours: isNaN(surplusHours) ? 0 : surplusHours,
    zone,
    zoneLabel,
    zoneTag,
    zoneColor,
    gaugeAngle: isNaN(gaugeAngle) ? 90 : Math.round(gaugeAngle),
    timeRemainingHours: isNaN(timeRemainingHours) ? 168 : Math.round(timeRemainingHours),
    quotaRemainingPct: isNaN(quotaRemainingPct) ? 100 : Math.round(quotaRemainingPct),
    timeRemainingPct: isNaN(timeRemainingPct) ? 100 : Math.round(timeRemainingPct),
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


  // 2. Extract baseline parameters for each account
  interface AccountSimItem {
    id: string;
    quotaPct: number;
    timeRemainingHours: number;
    hourlyBurnRatePct: number;
  }

  const accountItems: AccountSimItem[] = [];
  let totalQuotaRem = 0;
  let totalTimeRemPct = 0;
  let totalTimeRemHours = 0;
  let totalBurnRate = 0;

  for (const acc of targetAccounts) {
    const m = calculateAccountBurnVelocity(acc, now);
    totalQuotaRem += m.quotaRemainingPct;
    totalTimeRemPct += m.timeRemainingPct;
    totalTimeRemHours += m.timeRemainingHours;
    totalBurnRate += m.hourlyBurnRatePct;

    accountItems.push({
      id: acc.id || String(accountItems.length),
      quotaPct: m.quotaRemainingPct,
      timeRemainingHours: Math.max(0.1, m.timeRemainingHours),
      hourlyBurnRatePct: m.hourlyBurnRatePct,
    });
  }

  const validCount = accountItems.length;
  if (validCount === 0) {
    return {
      sustainabilityRatio: 1.0,
      hourlyBurnRatePct: 0,
      runwayHoursRemaining: 168,
      projectedDepletionDate: null,
      isDepletedBeforeReset: false,
      deficitHours: 0,
      surplusHours: 168,
      zone: 'balanced',
      zoneLabel: 'Balanced Fleet',
      zoneTag: 'NEUTRAL',
      zoneColor: '#38bdf8',
      gaugeAngle: 90,
      timeRemainingHours: 168,
      quotaRemainingPct: 100,
      timeRemainingPct: 100,
    };
  }

  // Aggregate statistical averages across active accounts
  const avgQuotaRem = totalQuotaRem / validCount;
  const avgTimeRemPct = totalTimeRemPct / validCount;
  const avgTimeRemHours = totalTimeRemHours / validCount;
  const avgBurnRate = totalBurnRate / validCount;

  // 3. Discrete-Event Rolling Renewal Simulation (Multi-Server Replenishment Horizon)
  // Evaluates dynamic inventory over 336 hours (2 full 168-hour cycles) with dt = 0.5h.
  // Staggered account renewals inject 100% fresh capacity at their exact scheduled timestamps.
  const HORIZON_HOURS = 336;
  const DT = 0.5;
  const totalFleetBurnRatePerHour = totalBurnRate; // aggregate percentage points consumed per hour

  const simQuota = accountItems.map((a) => a.quotaPct);
  const simNextReset = accountItems.map((a) => a.timeRemainingHours);

  let firstDepletionHour: number | null = null;
  let shortfallDurationHours = 0;

  if (totalFleetBurnRatePerHour > 0.005) {
    for (let t = 0; t <= HORIZON_HOURS; t += DT) {
      // Phase A: Replenishments (Discrete renewal impulse)
      for (let i = 0; i < validCount; i++) {
        if (t >= simNextReset[i]) {
          simQuota[i] = 100; // Account reaches reset timestamp: full 100% capacity renewed
          simNextReset[i] += 168; // Next weekly replenishment
        }
      }

      // Phase B: Total available capacity in the fleet pool
      let currentPoolQuota = 0;
      for (let i = 0; i < validCount; i++) {
        if (simQuota[i] > 0) {
          currentPoolQuota += simQuota[i];
        }
      }

      // Phase C: Detect simultaneous fleet exhaustion (outage)
      if (currentPoolQuota <= 0.05) {
        if (firstDepletionHour === null) {
          firstDepletionHour = t;
          const nextRecovery = Math.min(...simNextReset);
          shortfallDurationHours = Math.max(0.5, nextRecovery - t);
          break; // First outage found
        }
      }

      // Phase D: Drain pool proportionally across active accounts
      const drain = Math.min(currentPoolQuota, totalFleetBurnRatePerHour * DT);
      if (currentPoolQuota > 0) {
        for (let i = 0; i < validCount; i++) {
          if (simQuota[i] > 0) {
            const share = simQuota[i] / currentPoolQuota;
            simQuota[i] = Math.max(0, simQuota[i] - drain * share);
          }
        }
      }
    }
  }

  // 4. Synthesize Fleet Runway, Sustainability & Deficit Metrics
  let runwayHoursRemaining = 999;
  let isDepletedBeforeReset = false;
  let deficitHours = 0;
  let surplusHours = 0;
  let projectedDepletionDate: Date | null = null;
  let sustainabilityRatio = 1.0;

  if (avgBurnRate <= 0.005) {
    // Virtually zero consumption activity
    runwayHoursRemaining = 999;
    isDepletedBeforeReset = false;
    deficitHours = 0;
    surplusHours = Math.round(avgTimeRemHours);
    sustainabilityRatio = 2.0;
  } else if (firstDepletionHour !== null) {
    // Real fleet outage detected before subsequent renewal arrives
    runwayHoursRemaining = Math.max(0, Math.round(firstDepletionHour));
    isDepletedBeforeReset = true;
    deficitHours = Math.max(1, Math.round(shortfallDurationHours));
    surplusHours = 0;
    projectedDepletionDate = new Date(now + runwayHoursRemaining * 3600 * 1000);

    // Guaranteed mathematical consistency: S < 1.0 <=> isDepletedBeforeReset is true
    const recoveryHour = firstDepletionHour + shortfallDurationHours;
    const rawRatio = recoveryHour > 0 ? firstDepletionHour / recoveryHour : 0;
    sustainabilityRatio = Math.max(0.0, Math.min(0.99, rawRatio));
  } else {
    // Fleet is completely self-sustaining through staggered rolling renewals!
    // No depletion occurs anywhere within the multi-cycle simulation horizon.
    isDepletedBeforeReset = false;
    deficitHours = 0;
    runwayHoursRemaining = 999; // Perpetual runway past window
    projectedDepletionDate = null;
    surplusHours = Math.round(avgTimeRemHours);

    // Sustainability Ratio: Fleet generation capacity (N * 100% / 168h) vs consumption demand
    const renewalCapacityPerHour = validCount * (100 / 168);
    const capacityRatio = renewalCapacityPerHour / Math.max(0.01, totalFleetBurnRatePerHour);
    sustainabilityRatio = Math.max(1.05, Math.min(2.5, capacityRatio));
  }

  // Classification Zones & Speedometer Gauge Angle
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
    zoneColor = '#4ade9a';
  } else if (sustainabilityRatio <= 1.6) {
    zone = 'safe';
    zoneLabel = 'Healthy Fleet Buffer';
    zoneTag = 'BUY';
    zoneColor = '#93e9be';
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
    sustainabilityRatio: isNaN(sustainabilityRatio) ? 1.0 : Number(sustainabilityRatio.toFixed(2)),
    hourlyBurnRatePct: isNaN(avgBurnRate) ? 0 : Number(avgBurnRate.toFixed(2)),
    runwayHoursRemaining: isNaN(runwayHoursRemaining) ? 168 : Math.round(runwayHoursRemaining),
    projectedDepletionDate,
    isDepletedBeforeReset,
    deficitHours: isNaN(deficitHours) ? 0 : deficitHours,
    surplusHours: isNaN(surplusHours) ? 0 : surplusHours,
    zone,
    zoneLabel,
    zoneTag,
    zoneColor,
    gaugeAngle: isNaN(gaugeAngle) ? 90 : Math.round(gaugeAngle),
    timeRemainingHours: isNaN(avgTimeRemHours) ? 168 : Math.round(avgTimeRemHours),
    quotaRemainingPct: isNaN(avgQuotaRem) ? 100 : Math.round(avgQuotaRem),
    timeRemainingPct: isNaN(avgTimeRemPct) ? 100 : Math.round(avgTimeRemPct),
  };
}
