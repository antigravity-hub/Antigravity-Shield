import React, { useState, useMemo } from 'react';
import {
  Gauge,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  Zap,
  Calendar,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Account } from '../../types/account';
import {
  calculateAccountBurnVelocity,
  calculateFleetBurnVelocity,
  BurnVelocityMetrics,
} from '../../utils/predictiveBurn';
import { SpeedometerGauge } from '../common/SpeedometerGauge';

interface FleetVelocityGaugeProps {
  accounts: Account[];
  currentAccount?: Account | null;
  className?: string;
}

export const FleetVelocityGauge: React.FC<FleetVelocityGaugeProps> = ({
  accounts,
  currentAccount,
  className = '',
}) => {
  const { t, i18n } = useTranslation();
  const [viewMode, setViewMode] = useState<'fleet' | 'active'>('fleet');

  const metrics: BurnVelocityMetrics = useMemo(() => {
    if (viewMode === 'active' && currentAccount) {
      return calculateAccountBurnVelocity(currentAccount);
    }
    return calculateFleetBurnVelocity(accounts);
  }, [viewMode, accounts, currentAccount]);

  // Format projected date nicely with day of week & time
  const formattedProjectedDate = useMemo(() => {
    if (!metrics.projectedDepletionDate) return null;
    const locale = i18n.language.startsWith('fa') ? 'fa-IR' : 'en-US';
    try {
      return new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(metrics.projectedDepletionDate);
    } catch {
      return metrics.projectedDepletionDate.toLocaleString();
    }
  }, [metrics.projectedDepletionDate, i18n.language]);

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 p-5 shadow-sm hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-300 group ${className}`}>
      {/* Background ambient decorative glow */}
      <div
        className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-15 pointer-events-none transition-colors duration-700"
        style={{ backgroundColor: metrics.zoneColor }}
      />
      <div
        className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full blur-3xl opacity-10 pointer-events-none transition-colors duration-700"
        style={{ backgroundColor: metrics.zoneColor }}
      />

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-200/60 dark:border-slate-800/60 relative z-10">
        <div className="flex items-center gap-2.5">
          <div
            className="p-2 rounded-xl transition-colors duration-300"
            style={{
              backgroundColor: `${metrics.zoneColor}18`,
              color: metrics.zoneColor,
              border: `1px solid ${metrics.zoneColor}35`,
            }}
          >
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                {t('dashboard.velocity_gauge.title', 'Quota Consumption & Runway Forecast')}
              </h2>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-colors duration-300"
                style={{
                  backgroundColor: `${metrics.zoneColor}20`,
                  color: metrics.zoneColor,
                  border: `1px solid ${metrics.zoneColor}40`,
                }}
              >
                {metrics.zoneTag}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t(
                'dashboard.velocity_gauge.subtitle',
                'AI Burn Rate Velocity & Predictive Exhaustion Radar'
              )}
            </p>
          </div>
        </div>

        {/* View mode toggle (Fleet vs Active Account) */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
          <button
            type="button"
            onClick={() => setViewMode('fleet')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
              viewMode === 'fleet'
                ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {t('dashboard.velocity_gauge.fleet_view', 'Entire Fleet')}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('active')}
            disabled={!currentAccount}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
              viewMode === 'active'
                ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            } ${!currentAccount ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {t('dashboard.velocity_gauge.active_view', 'Active Account')}
          </button>
        </div>
      </div>

      {/* Main Grid: Left = Speedometer Gauge, Right = Predictive Analytics Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">
        {/* Left Column: Speedometer SVG (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center pt-2">
          <SpeedometerGauge
            value={metrics.sustainabilityRatio}
            unit="x"
            statusBadgeText={metrics.zoneLabel}
            caption={t(
              'dashboard.velocity_gauge.caption',
              'Ratio of remaining quota to remaining weekly window'
            )}
            trend={metrics.sustainabilityRatio >= 1.0 ? 'up' : 'down'}
            maxWidth={280}
          />
        </div>

        {/* Right Column: AI Predictive Runway & Forecasting Cards (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          {/* Main Predictive Horizon Alert Banner */}
          <div
            className="p-4 rounded-xl border transition-all duration-300 shadow-sm"
            style={{
              backgroundColor: metrics.isDepletedBeforeReset
                ? 'rgba(244, 63, 94, 0.08)'
                : 'rgba(16, 185, 129, 0.08)',
              borderColor: metrics.isDepletedBeforeReset
                ? 'rgba(244, 63, 94, 0.25)'
                : 'rgba(16, 185, 129, 0.25)',
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="p-2 rounded-xl shrink-0 mt-0.5"
                style={{
                  backgroundColor: metrics.isDepletedBeforeReset
                    ? 'rgba(244, 63, 94, 0.15)'
                    : 'rgba(16, 185, 129, 0.15)',
                  color: metrics.isDepletedBeforeReset ? '#f43f5e' : '#10b981',
                }}
              >
                {metrics.isDepletedBeforeReset ? (
                  <AlertTriangle className="w-5 h-5 animate-bounce" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                  <h3
                    className="text-sm font-black tracking-tight"
                    style={{
                      color: metrics.isDepletedBeforeReset ? '#f43f5e' : '#10b981',
                    }}
                  >
                    {metrics.isDepletedBeforeReset
                      ? t(
                          'dashboard.velocity_gauge.deficit_title',
                          `Projected Quota Deficit: ~${metrics.deficitHours}h Shortfall`
                        )
                      : t(
                          'dashboard.velocity_gauge.surplus_title',
                          'Sustainable Consumption — Quota Safe'
                        )}
                  </h3>
                  {formattedProjectedDate && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-white/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-cyan-500" />
                      {formattedProjectedDate}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {metrics.isDepletedBeforeReset ? (
                    <>
                      At your current velocity of{' '}
                      <strong>{metrics.hourlyBurnRatePct}% / hr</strong>, your quota will
                      deplete on <strong>{formattedProjectedDate}</strong> — approximately{' '}
                      <span className="font-bold underline text-rose-500">
                        {metrics.deficitHours} hours before
                      </span>{' '}
                      the weekly reset window refreshes.
                    </>
                  ) : (
                    <>
                      Your current pace (<strong>{metrics.hourlyBurnRatePct}% / hr</strong>)
                      is completely sustainable. You will retain approximately{' '}
                      <span className="font-bold text-emerald-500">
                        +{metrics.surplusHours}h of surplus runway
                      </span>{' '}
                      past the weekly reset mark.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* 3 Metric Mini-Tiles */}
          <div className="grid grid-cols-3 gap-2.5">
            {/* Tile 1: Consumption Burn Rate */}
            <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800/60">
              <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 mb-1">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Burn Rate</span>
              </div>
              <div className="text-base font-black text-slate-900 dark:text-white">
                {metrics.hourlyBurnRatePct}%
                <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400"> / hr</span>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate block mt-0.5">
                Current velocity
              </span>
            </div>

            {/* Tile 2: Runway Remaining */}
            <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800/60">
              <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 mb-1">
                <Clock className="w-3.5 h-3.5 text-cyan-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Runway</span>
              </div>
              <div className="text-base font-black text-slate-900 dark:text-white">
                {metrics.runwayHoursRemaining > 168 ? '> 7 Days' : `${metrics.runwayHoursRemaining}h`}
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate block mt-0.5">
                Hours to 0% quota
              </span>
            </div>

            {/* Tile 3: Weekly Window Left */}
            <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800/60">
              <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Reset In</span>
              </div>
              <div className="text-base font-black text-slate-900 dark:text-white">
                {metrics.timeRemainingHours}h
                <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                  {' '}
                  ({metrics.timeRemainingPct}%)
                </span>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate block mt-0.5">
                Weekly reset clock
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FleetVelocityGauge;
