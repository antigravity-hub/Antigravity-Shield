import React, { useState, useMemo } from 'react';
import {
  Gauge,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  Zap,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';
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
    const locale = i18n.language.startsWith('fa') ? 'fa-IR' : (i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US');
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

  const sessionDepletionTimeFormatted = useMemo(() => {
    if (!metrics.sessionDepletionDate) return '';
    const locale = i18n.language.startsWith('fa') ? 'fa-IR' : (i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US');
    try {
      return metrics.sessionDepletionDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return metrics.sessionDepletionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }, [metrics.sessionDepletionDate, i18n.language]);

  const sessionResetTimeFormatted = useMemo(() => {
    if (!metrics.sessionResetTimeMs) return '';
    const date = new Date(metrics.sessionResetTimeMs);
    const locale = i18n.language.startsWith('fa') ? 'fa-IR' : (i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US');
    try {
      return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }, [metrics.sessionResetTimeMs, i18n.language]);

  const durationFormatted = useMemo(() => {
    if (metrics.sessionRunwayMinutes === undefined) return '';
    const hours = Math.floor(metrics.sessionRunwayMinutes / 60);
    const mins = metrics.sessionRunwayMinutes % 60;
    if (hours > 0) {
      return t('dashboard.velocity_gauge.duration_hours_mins', { hours, mins, defaultValue: `${hours}h ${mins}m` });
    }
    return t('dashboard.velocity_gauge.duration_mins', { mins, defaultValue: `${mins}m` });
  }, [metrics.sessionRunwayMinutes, t]);

  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={`relative overflow-hidden rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 px-3.5 py-2 sm:px-4 sm:py-2.5 shadow-sm hover:border-cyan-500/40 transition-all duration-300 group ${className}`}>
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
      <div className={`flex items-center justify-between gap-2 border-slate-200/60 dark:border-slate-800/60 relative z-10 ${isCollapsed ? '' : 'pb-1.5 mb-2 border-b'}`}>
        <div className="flex items-center gap-2">
          <div
            className="p-1 rounded-lg transition-colors duration-300"
            style={{
              backgroundColor: `${metrics.zoneColor}18`,
              color: metrics.zoneColor,
              border: `1px solid ${metrics.zoneColor}35`,
            }}
          >
            <Gauge className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs sm:text-sm font-black tracking-tight text-slate-900 dark:text-white">
              {t('dashboard.velocity_gauge.title', 'Quota Consumption & Runway Forecast')}
            </h2>
            <span
              className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-colors duration-300"
              style={{
                backgroundColor: `${metrics.zoneColor}20`,
                color: metrics.zoneColor,
                border: `1px solid ${metrics.zoneColor}40`,
              }}
            >
              {t(`dashboard.velocity_gauge.tag_${metrics.zoneTag.toLowerCase().replace(/\s+/g, '_')}`, metrics.zoneTag)}
            </span>
            {isCollapsed && (
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-400 ml-2 hidden sm:inline">
                ({metrics.sustainabilityRatio}x • {t('dashboard.velocity_gauge.runway', 'Runway')}: {metrics.runwayHoursRemaining > 168 ? t('dashboard.velocity_gauge.more_than_7d', '>7d') : `${metrics.runwayHoursRemaining}h`} • {t('dashboard.velocity_gauge.reset_short', 'Reset')}: {metrics.timeRemainingHours}h)
              </span>
            )}
          </div>
        </div>

        {/* View mode toggle & collapse button */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
            <button
              type="button"
              onClick={() => setViewMode('fleet')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all duration-200 cursor-pointer ${
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
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all duration-200 cursor-pointer ${
                viewMode === 'active'
                  ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              } ${!currentAccount ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {t('dashboard.velocity_gauge.active_view', 'Active Account')}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:bg-slate-800/60 transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            title={isCollapsed ? t('dashboard.velocity_gauge.expand', 'Expand Radar') : t('dashboard.velocity_gauge.collapse', 'Collapse Radar')}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`} />
          </button>
        </div>
      </div>

      {/* Main Grid: Left = Speedometer Gauge, Right = Predictive Analytics Card */}
      {!isCollapsed && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center relative z-10">
          {/* Left Column: Speedometer SVG (4 cols) */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center">
            <SpeedometerGauge
              value={metrics.sustainabilityRatio}
              unit="x"
              statusBadgeText={t(`dashboard.velocity_gauge.zone_${metrics.zone}`, metrics.zoneLabel)}
              caption={t(
                'dashboard.velocity_gauge.caption',
                'Ratio of remaining quota to remaining weekly window'
              )}
              subCaption={
                viewMode === 'active' && metrics.sessionResetTimeMs !== undefined
                  ? metrics.sessionRemainingPct === 0
                    ? t('dashboard.velocity_gauge.session_exhausted_badge', '⏳ 5H Quota Exhausted (0%)')
                    : metrics.isSessionAtRisk
                    ? t('dashboard.velocity_gauge.session_depletion_badge', {
                        duration: durationFormatted,
                        time: sessionDepletionTimeFormatted,
                        defaultValue: `⏳ Depletion in ${durationFormatted} (${sessionDepletionTimeFormatted})`,
                      })
                    : t('dashboard.velocity_gauge.session_sustainable_badge', {
                        time: sessionResetTimeFormatted,
                        defaultValue: `⏳ Sustainable until Reset (${sessionResetTimeFormatted})`,
                      })
                  : undefined
              }
              trend={metrics.sustainabilityRatio >= 1.0 ? 'up' : 'down'}
              maxWidth={185}
            />
          </div>

          {/* Right Column: AI Predictive Runway & Forecasting Cards (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-2">
            {/* Main Predictive Horizon Alert Banner */}
            <div
              className="py-1.5 px-3 rounded-lg border transition-all duration-300 shadow-sm"
              style={{
                backgroundColor: (metrics.isSessionAtRisk || metrics.isDepletedBeforeReset)
                  ? 'rgba(244, 63, 94, 0.08)'
                  : 'rgba(16, 185, 129, 0.08)',
                borderColor: (metrics.isSessionAtRisk || metrics.isDepletedBeforeReset)
                  ? 'rgba(244, 63, 94, 0.25)'
                  : 'rgba(16, 185, 129, 0.25)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="p-1.5 rounded-lg shrink-0"
                  style={{
                    backgroundColor: (metrics.isSessionAtRisk || metrics.isDepletedBeforeReset)
                      ? 'rgba(244, 63, 94, 0.15)'
                      : 'rgba(16, 185, 129, 0.15)',
                    color: (metrics.isSessionAtRisk || metrics.isDepletedBeforeReset) ? '#f43f5e' : '#10b981',
                  }}
                >
                  {(metrics.isSessionAtRisk || metrics.isDepletedBeforeReset) ? (
                    <AlertTriangle className="w-4 h-4 animate-bounce" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3
                      className="text-xs font-black tracking-tight"
                      style={{
                        color: (metrics.isSessionAtRisk || metrics.isDepletedBeforeReset) ? '#f43f5e' : '#10b981',
                      }}
                    >
                      {viewMode === 'active' && metrics.sessionResetTimeMs !== undefined ? (
                        metrics.sessionRemainingPct === 0
                          ? t('dashboard.velocity_gauge.session_exhausted_title', '5-Hour Session Quota Exhausted (0% Remaining)')
                          : metrics.isSessionAtRisk
                          ? t('dashboard.velocity_gauge.session_risk_title', {
                              duration: durationFormatted,
                              defaultValue: `Projected Session Depletion: ~${durationFormatted} Shortfall`,
                            })
                          : t('dashboard.velocity_gauge.session_safe_title', {
                              time: sessionResetTimeFormatted,
                              defaultValue: `Session Quota Sustainable until Reset (${sessionResetTimeFormatted})`,
                            })
                      ) : (
                        metrics.isDepletedBeforeReset
                          ? t(
                              'dashboard.velocity_gauge.deficit_title',
                              {
                                hours: metrics.deficitHours,
                                defaultValue: `Projected Quota Deficit: ~${metrics.deficitHours}h Shortfall`,
                              }
                            )
                          : t(
                              'dashboard.velocity_gauge.surplus_title',
                              'Sustainable Consumption — Quota Safe'
                            )
                      )}
                    </h3>
                    {formattedProjectedDate && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50 flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5 text-cyan-500" />
                        {formattedProjectedDate}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug mt-0.5">
                    {viewMode === 'active' && metrics.sessionResetTimeMs !== undefined ? (
                      metrics.isSessionAtRisk ? (
                        <Trans
                          i18nKey="dashboard.velocity_gauge.session_risk_desc"
                          values={{ duration: durationFormatted, time: sessionDepletionTimeFormatted }}
                          components={{ strong: <strong /> }}
                          defaults="Based on current burn rate, the 5-hour quota will deplete in <strong>{{duration}}</strong> (around <strong>{{time}}</strong>)."
                        />
                      ) : (
                        <Trans
                          i18nKey="dashboard.velocity_gauge.session_safe_desc"
                          values={{ time: sessionResetTimeFormatted }}
                          components={{ strong: <strong /> }}
                          defaults="Session consumption is steady and will safely reach the next reset at <strong>{{time}}</strong>."
                        />
                      )
                    ) : metrics.isDepletedBeforeReset ? (
                      <Trans
                        i18nKey="dashboard.velocity_gauge.deficit_desc"
                        values={{
                          burnRate: metrics.hourlyBurnRatePct,
                          date: formattedProjectedDate,
                          hours: metrics.deficitHours,
                        }}
                        components={{
                          strong: <strong />,
                          span: <span className="font-bold underline text-rose-500" />,
                        }}
                        defaults="At velocity <strong>{{burnRate}}% / hr</strong>, quota depletes on <strong>{{date}}</strong> — approximately <span className='font-bold underline text-rose-500'>{{hours}}h before reset</span>."
                      />
                    ) : (
                      <Trans
                        i18nKey="dashboard.velocity_gauge.surplus_desc"
                        values={{
                          burnRate: metrics.hourlyBurnRatePct,
                          hours: metrics.surplusHours,
                        }}
                        components={{
                          strong: <strong />,
                          span: <span className="font-bold text-emerald-500" />,
                        }}
                        defaults="Current pace (<strong>{{burnRate}}% / hr</strong>) is sustainable with <span className='font-bold text-emerald-500'>+{{hours}}h surplus runway</span> past reset."
                      />
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* 3 Metric Mini-Tiles */}
            <div className="grid grid-cols-3 gap-2">
              {/* Tile 1: Consumption Burn Rate */}
              <div className="py-1 px-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800/60">
                <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 mb-0.5">
                  <Zap className="w-3 h-3 text-amber-500" />
                  <span className="text-[9.5px] font-bold uppercase tracking-wider">
                    {t('dashboard.velocity_gauge.burn_rate', 'Burn Rate')}
                  </span>
                </div>
                <div className="text-sm font-black text-slate-900 dark:text-white">
                  {metrics.hourlyBurnRatePct}%
                  <span className="text-[9.5px] font-normal text-slate-500 dark:text-slate-400">
                    {' '}{t('dashboard.velocity_gauge.per_hour', '/ hr')}
                  </span>
                </div>
              </div>

              {/* Tile 2: Runway Remaining */}
              <div className="py-1 px-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800/60">
                <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 mb-0.5">
                  <Clock className="w-3 h-3 text-cyan-500" />
                  <span className="text-[9.5px] font-bold uppercase tracking-wider">
                    {t('dashboard.velocity_gauge.runway', 'Runway')}
                  </span>
                </div>
                <div className="text-sm font-black text-slate-900 dark:text-white">
                  {viewMode === 'active' && metrics.sessionRunwayMinutes !== undefined
                    ? (metrics.sessionRunwayMinutes < 60
                        ? `${metrics.sessionRunwayMinutes}m ${t('dashboard.velocity_gauge.session_suffix', '(Session)')}`
                        : `${Math.floor(metrics.sessionRunwayMinutes / 60)}h ${metrics.sessionRunwayMinutes % 60}m ${t('dashboard.velocity_gauge.session_suffix', '(Session)')}`)
                    : (metrics.runwayHoursRemaining > 168 ? t('dashboard.velocity_gauge.more_than_7_days', '> 7 Days') : `${metrics.runwayHoursRemaining}h`)}
                </div>
              </div>

              {/* Tile 3: Weekly Window Left */}
              <div className="py-1 px-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800/60">
                <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 mb-0.5">
                  <Sparkles className="w-3 h-3 text-purple-500" />
                  <span className="text-[9.5px] font-bold uppercase tracking-wider">
                    {t('dashboard.velocity_gauge.reset_in', 'Reset In')}
                  </span>
                </div>
                <div className="text-sm font-black text-slate-900 dark:text-white">
                  {metrics.timeRemainingHours}h
                  <span className="text-[9.5px] font-normal text-slate-500 dark:text-slate-400">
                    {' '}
                    ({metrics.timeRemainingPct}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FleetVelocityGauge;
