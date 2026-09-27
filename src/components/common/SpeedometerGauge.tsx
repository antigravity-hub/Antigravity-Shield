import React, { useId, useMemo } from 'react';

export interface GaugeZone {
  id: string;
  label: string; // e.g. 'CRITICAL', 'HIGH', 'BALANCED', 'SAFE', 'SURPLUS'
  color: string; // Hex or CSS color, e.g. '#f43f5e'
  from: number; // Value start (inclusive)
  to: number; // Value end (inclusive)
  statusLabel?: string; // e.g. 'Balanced Sustainability'
  trend?: 'up' | 'down' | 'neutral';
}

export interface SpeedometerGaugeProps {
  /**
   * The current numeric value to display on the gauge.
   * e.g., 0.88
   */
  value: number;

  /**
   * Minimum value of the gauge range.
   * @default 0
   */
  min?: number;

  /**
   * Maximum value of the gauge range.
   * @default 2
   */
  max?: number;

  /**
   * Unit suffix displayed next to the value (e.g. 'x', '%', 'km/h', 'MB/s').
   * @default 'x'
   */
  unit?: string;

  /**
   * Optional custom zones. If not provided, defaults to the 5 standard zones:
   * CRITICAL (red), HIGH (orange), BALANCED (sky blue), SAFE (cyan), SURPLUS (emerald).
   */
  zones?: GaugeZone[];

  /**
   * Custom label for the status badge below the value.
   * If not provided, it will use the active zone's `statusLabel` or `label`.
   */
  statusBadgeText?: string;

  /**
   * Trend direction for the badge icon ('up' | 'down' | 'neutral' | 'none').
   * If not provided, it is deduced automatically from value comparison or active zone.
   */
  trend?: 'up' | 'down' | 'neutral' | 'none';

  /**
   * Custom caption or subtitle text displayed below the status badge.
   * @default 'Ratio of remaining quota to remaining weekly window'
   */
  caption?: string;

  /**
   * Custom value formatter function (e.g. (val) => val.toFixed(2)).
   */
  valueFormatter?: (value: number) => string;

  /**
   * Whether to show tick marks dividing the zones.
   * @default true
   */
  showTicks?: boolean;

  /**
   * Whether to show zone labels (CRITICAL, HIGH, BALANCED, etc.) along the arc.
   * @default true
   */
  showZoneLabels?: boolean;

  /**
   * Whether to display the central numeric value.
   * @default true
   */
  showValue?: boolean;

  /**
   * Whether to display the status badge.
   * @default true
   */
  showBadge?: boolean;

  /**
   * Whether to display the subtitle / caption.
   * @default true
   */
  showCaption?: boolean;

  /**
   * Optional custom className for the outermost container.
   */
  className?: string;

  /**
   * Gauge maximum width in pixels or CSS string.
   * @default 320
   */
  maxWidth?: number | string;

  /**
   * Custom color override for the needle and value text.
   * If omitted, dynamically adapts to the current zone color.
   */
  accentColor?: string;

  /**
   * Optional click handler for interactivity.
   */
  onClick?: () => void;
}

/**
 * Default 5-Zone Gauge Configuration matching the predictive sustainability meter
 */
export const DEFAULT_GAUGE_ZONES: GaugeZone[] = [
  {
    id: 'critical',
    label: 'CRITICAL',
    color: '#f43f5e', // Crimson / Red
    from: 0,
    to: 0.5,
    statusLabel: 'Critical Deficit',
    trend: 'down',
  },
  {
    id: 'high',
    label: 'HIGH',
    color: '#f59e0b', // Amber / Orange
    from: 0.5,
    to: 0.85,
    statusLabel: 'Over-Burning',
    trend: 'down',
  },
  {
    id: 'balanced',
    label: 'BALANCED',
    color: '#38bdf8', // Sky Blue
    from: 0.85,
    to: 1.15,
    statusLabel: 'Balanced Sustainability',
    trend: 'down',
  },
  {
    id: 'safe',
    label: 'SAFE',
    color: '#06b6d4', // Cyan
    from: 1.15,
    to: 1.6,
    statusLabel: 'Safe Reserve',
    trend: 'up',
  },
  {
    id: 'surplus',
    label: 'SURPLUS',
    color: '#10b981', // Emerald / Green
    from: 1.6,
    to: 2.0,
    statusLabel: 'Full Surplus',
    trend: 'up',
  },
];

/**
 * Helper to compute cartesian coordinates (x, y) along a semi-circular arc.
 * angleDeg = 0 is far-left (180 deg in standard polar),
 * angleDeg = 90 is top-center (90 deg in standard polar),
 * angleDeg = 180 is far-right (0 deg in standard polar).
 */
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx - r * Math.cos(rad),
    y: cy - r * Math.sin(rad),
  };
}

/**
 * Universal Speedometer Gauge Component
 *
 * An independent, modular, and responsive semi-circle radial gauge.
 * Designed with glowing gradient arcs, precision tick marks, dynamic needle
 * physics, and an interactive status badge.
 */
export const SpeedometerGauge: React.FC<SpeedometerGaugeProps> = ({
  value,
  min = 0,
  max = 2,
  unit = 'x',
  zones = DEFAULT_GAUGE_ZONES,
  statusBadgeText,
  trend,
  caption = 'Ratio of remaining quota to remaining weekly window',
  valueFormatter,
  showTicks = true,
  showZoneLabels = true,
  showValue = true,
  showBadge = true,
  showCaption = true,
  className = '',
  maxWidth = 320,
  accentColor,
  onClick,
}) => {
  // Generate unique IDs for SVG defs to avoid collisions when multiple gauges are rendered
  const uniqueId = useId().replace(/:/g, '_');
  const gradientId = `speedometer-gradient-${uniqueId}`;
  const glowFilterId = `speedometer-glow-${uniqueId}`;

  // Clamped value within [min, max]
  const clampedValue = Math.max(min, Math.min(max, value));

  // Value percentage in range [0, 1]
  const normalizedFraction = max > min ? (clampedValue - min) / (max - min) : 0;

  // Active Zone Detection
  const activeZone = useMemo(() => {
    if (!zones || zones.length === 0) {
      return DEFAULT_GAUGE_ZONES[2];
    }
    const found = zones.find(
      (z) => clampedValue >= z.from && clampedValue <= z.to
    );
    if (found) return found;

    // Fallback if below minimum or above maximum
    if (clampedValue < zones[0].from) return zones[0];
    return zones[zones.length - 1];
  }, [zones, clampedValue]);

  // Determine active color
  const currentColor = accentColor || activeZone.color;

  // Compute Gauge Angle: 0 deg (far left) to 180 deg (far right)
  // 90 deg is dead center (pointing straight up)
  const gaugeAngle = useMemo(() => {
    // If user is using default zones and max is 2 (sustainability ratio mode)
    // 1.0 is calibrated at 90 deg center
    if (min === 0 && max === 2) {
      if (clampedValue <= 1.0) {
        return Math.max(0, Math.min(90, (clampedValue / 1.0) * 90));
      }
      return Math.min(180, 90 + ((clampedValue - 1.0) / 1.0) * 90);
    }
    // Generic linear normalization across any min/max
    return normalizedFraction * 180;
  }, [min, max, clampedValue, normalizedFraction]);

  // Needle Rotation from vertical (90 deg):
  // 0 deg (far left) -> -90 deg rotation
  // 90 deg (center)  -> 0 deg rotation
  // 180 deg (right)  -> +90 deg rotation
  const needleRotation = gaugeAngle - 90;

  // Format displayed value
  const displayValue = useMemo(() => {
    if (valueFormatter) {
      return valueFormatter(clampedValue);
    }
    // Format float nicely (e.g. 0.88 or 100)
    return Number.isInteger(clampedValue)
      ? clampedValue.toString()
      : clampedValue.toFixed(2);
  }, [clampedValue, valueFormatter]);

  // Determine badge text
  const badgeLabel = statusBadgeText || activeZone.statusLabel || activeZone.label;

  // Determine trend direction
  const effectiveTrend = useMemo(() => {
    if (trend) return trend;
    if (activeZone.trend) return activeZone.trend;
    return clampedValue >= (min + max) / 2 ? 'up' : 'down';
  }, [trend, activeZone, clampedValue, min, max]);

  // SVG Geometry Dimensions - Ultra-Compact & Low Profile
  const cx = 130;
  const cy = 115;
  const radius = 86;

  // Ticks at boundary between zones
  const tickAngles = useMemo(() => {
    if (!showTicks || zones.length <= 1) return [];
    const span = max - min;
    if (span <= 0) return [];

    return zones.slice(0, -1).map((z) => {
      // Fraction of the boundary
      let frac = (z.to - min) / span;
      // In default mode, align boundary cleanly
      if (min === 0 && max === 2) {
        if (z.to <= 1.0) {
          frac = (z.to / 1.0) * 0.5;
        } else {
          frac = 0.5 + ((z.to - 1.0) / 1.0) * 0.5;
        }
      }
      return frac * 180;
    });
  }, [showTicks, zones, min, max]);

  // Pre-calculated or dynamic positions for zone labels
  const zoneLabelItems = useMemo(() => {
    if (!showZoneLabels) return [];

    // If using the standard 5 zones, position identically to design
    if (zones === DEFAULT_GAUGE_ZONES || zones.length === 5) {
      return [
        { label: zones[0].label, color: zones[0].color, x: 24, y: 106, anchor: 'middle' },
        { label: zones[1].label, color: zones[1].color, x: 52, y: 52, anchor: 'middle' },
        { label: zones[2].label, color: zones[2].color, x: 130, y: 16, anchor: 'middle' },
        { label: zones[3].label, color: zones[3].color, x: 208, y: 52, anchor: 'middle' },
        { label: zones[4].label, color: zones[4].color, x: 236, y: 106, anchor: 'middle' },
      ];
    }

    // Dynamic label placement along arc for custom zone arrays
    const span = max - min;
    return zones.map((z) => {
      const midVal = (z.from + z.to) / 2;
      const frac = span > 0 ? (midVal - min) / span : 0.5;
      const angle = frac * 180;
      // Label slightly above the arc radius
      const pt = polarToCartesian(cx, cy, radius + 15, angle);
      return {
        label: z.label,
        color: z.color,
        x: pt.x,
        y: pt.y,
        anchor: 'middle',
      };
    });
  }, [showZoneLabels, zones, min, max, cx, cy, radius]);

  return (
    <div
      onClick={onClick}
      className={`flex flex-col items-center justify-center select-none text-slate-100 ${className}`}
      style={{
        maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
        width: '100%',
      }}
    >
      {/* SVG Speedometer Gauge */}
      <div className="relative w-full aspect-[260/118] flex items-center justify-center">
        <svg
          viewBox="0 0 260 118"
          className="w-full h-auto overflow-visible select-none drop-shadow-md"
        >
          <defs>
            {/* Multi-Stop Dynamic Gradient */}
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              {zones.map((zone, idx) => {
                const offsetPct = Math.round((idx / (zones.length - 1 || 1)) * 100);
                return (
                  <stop
                    key={zone.id || idx}
                    offset={`${offsetPct}%`}
                    stopColor={zone.color}
                  />
                );
              })}
            </linearGradient>

            {/* Neon Glow Filter */}
            <filter id={glowFilterId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Track Arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="currentColor"
            className="text-slate-800/80 dark:text-slate-800/90"
            strokeWidth="15"
            strokeLinecap="round"
          />

          {/* Glowing Gradient Foreground Arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="13"
            strokeLinecap="round"
            filter={`url(#${glowFilterId})`}
            className="opacity-95"
          />

          {/* Zone Separation Ticks */}
          {showTicks &&
            tickAngles.map((angle, idx) => {
              const inner = polarToCartesian(cx, cy, radius - 7, angle);
              const outer = polarToCartesian(cx, cy, radius + 7, angle);
              return (
                <line
                  key={idx}
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke="rgba(255, 255, 255, 0.75)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              );
            })}

          {/* Zone Legend Labels */}
          {showZoneLabels &&
            zoneLabelItems.map((item, idx) => (
              <text
                key={idx}
                x={item.x}
                y={item.y}
                textAnchor={item.anchor as any}
                fill={item.color}
                className="text-[8.5px] font-black tracking-tight uppercase drop-shadow-sm pointer-events-none"
                style={{
                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
                  letterSpacing: '0.04em',
                }}
              >
                {item.label}
              </text>
            ))}

          {/* Analog Needle Indicator with Spring Dynamics */}
          <g
            transform={`translate(${cx}, ${cy}) rotate(${needleRotation})`}
            style={{
              transition: 'transform 1.1s cubic-bezier(0.34, 1.56, 0.64, 1)',
              willChange: 'transform',
            }}
          >
            {/* Needle Blade (Tapered) */}
            <polygon
              points="-3,0 0,-76 3,0"
              className="fill-slate-100 drop-shadow-md"
              filter={`url(#${glowFilterId})`}
            />

            {/* Needle Center Base Cap */}
            <circle
              cx="0"
              cy="0"
              r="7"
              className="fill-white dark:fill-slate-100 drop-shadow-sm"
            />
            {/* Glowing Active Center Dot */}
            <circle
              cx="0"
              cy="0"
              r="3.5"
              fill={currentColor}
              className="animate-pulse"
              style={{
                filter: `drop-shadow(0 0 4px ${currentColor})`,
              }}
            />
          </g>
        </svg>
      </div>

      {/* Central Value & Status Display */}
      {(showValue || showBadge) && (
        <div className="flex flex-col items-center mt-1">
          <div className="flex items-center gap-2">
            {/* Big Numeric Value */}
            {showValue && (
              <span
                className="text-3xl font-black tracking-tight transition-colors duration-500"
                style={{
                  color: currentColor,
                  textShadow: `0 0 16px ${currentColor}33`,
                }}
              >
                {displayValue}
                {unit && (
                  <span className="text-2xl font-bold ml-0.5 opacity-90">
                    {unit}
                  </span>
                )}
              </span>
            )}

            {/* Status Pill Badge */}
            {showBadge && badgeLabel && (
              <div
                className="px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all duration-300"
                style={{
                  backgroundColor: `${currentColor}18`,
                  color: currentColor,
                  border: `1px solid ${currentColor}40`,
                }}
              >
                {effectiveTrend === 'down' && (
                  <svg
                    className="w-3.5 h-3.5 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                    <polyline points="17 18 23 18 23 12" />
                  </svg>
                )}
                {effectiveTrend === 'up' && (
                  <svg
                    className="w-3.5 h-3.5 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                )}
                {effectiveTrend === 'neutral' && (
                  <svg
                    className="w-3.5 h-3.5 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                )}
                <span>{badgeLabel}</span>
              </div>
            )}
          </div>

          {/* Subtitle / Caption */}
          {showCaption && caption && (
            <p className="text-xs text-slate-400 dark:text-slate-400/90 mt-1 font-medium tracking-normal text-center">
              {caption}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default SpeedometerGauge;
