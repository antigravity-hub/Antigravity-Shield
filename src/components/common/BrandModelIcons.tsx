interface IconProps {
    className?: string;
    size?: number;
}

/**
 * Official Google Gemini 4-Pointed Sparkle Star
 */
export function GeminiBrandIcon({ className = 'w-4 h-4', size }: IconProps) {
    const sizeProps = size ? { width: size, height: size } : {};
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            className={`shrink-0 ${className}`}
            {...sizeProps}
        >
            <path
                d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4772 12 22C12 16.4772 16.4772 12 22 12C16.4772 12 12 7.52285 12 2Z"
                fill="url(#gemini-adaptive-gradient)"
            />
            <defs>
                <linearGradient
                    id="gemini-adaptive-gradient"
                    x1="2"
                    y1="2"
                    x2="22"
                    y2="22"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop stopColor="#4E89FF" />
                    <stop offset="0.5" stopColor="#38BDF8" />
                    <stop offset="1" stopColor="#9C77FF" />
                </linearGradient>
            </defs>
        </svg>
    );
}

/**
 * Anthropic Claude Radiant Sunburst / Sparkle Icon
 */
export function ClaudeBrandIcon({ className = 'w-4 h-4', size }: IconProps) {
    const sizeProps = size ? { width: size, height: size } : {};
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            className={`shrink-0 ${className}`}
            {...sizeProps}
        >
            <circle cx="12" cy="12" r="4" fill="#D97757" />
            <path
                d="M12 2.5V5.5M12 18.5V21.5M2.5 12H5.5M18.5 12H21.5M5.28 5.28L7.4 7.4M16.6 16.6L18.72 18.72M5.28 18.72L7.4 16.6M16.6 7.4L18.72 5.28"
                stroke="#D97757"
                strokeWidth="2.2"
                strokeLinecap="round"
            />
        </svg>
    );
}
