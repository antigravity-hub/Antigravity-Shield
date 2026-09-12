import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface CircularProgressRingProps {
    percentage: number;
    size?: number;
    strokeWidth?: number;
    children?: ReactNode;
    color?: string;
    trackColor?: string;
    title?: string;
    showTooltip?: boolean;
    className?: string;
}

/**
 * Circular progress ring component in theme color #93B93B
 * Perfectly sized for ultra-compact and micro-widget layouts
 */
export function CircularProgressRing({
    percentage,
    size = 40,
    strokeWidth = 3.5,
    children,
    color = '#93B93B',
    trackColor,
    title,
    showTooltip = true,
    className = '',
}: CircularProgressRingProps) {
    const radius = Math.max(1, (size - strokeWidth) / 2);
    const circumference = 2 * Math.PI * radius;
    const safePercentage = Math.max(0, Math.min(100, Math.round(percentage)));
    const strokeDashoffset = circumference - (safePercentage / 100) * circumference;

    return (
        <div
            className={`relative inline-flex items-center justify-center group select-none shrink-0 ${className}`}
            style={{ width: size, height: size }}
            title={title || `${safePercentage}%`}
        >
            <svg
                width={size}
                height={size}
                className="transform -rotate-90 origin-center overflow-visible block"
            >
                {/* Background track */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    className={trackColor || "text-gray-200/50 dark:text-white/10"}
                />
                {/* Active progress ring */}
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    strokeLinecap="round"
                    style={{
                        filter: `drop-shadow(0 0 4px ${color}80)`,
                    }}
                />
            </svg>

            {/* Centered Slot (Icon or Content) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {children}
            </div>

            {/* Hover tooltip for quick glance */}
            {showTooltip && (
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-gray-900/90 dark:bg-black/90 text-white text-[9px] font-mono font-bold tracking-tight opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-30 whitespace-nowrap shadow-lg border border-white/10">
                    {safePercentage}%
                </div>
            )}
        </div>
    );
}
