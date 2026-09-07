interface IconProps {
    className?: string;
    size?: number;
}

/**
 * 🪐 Antigravity Classic Icon
 * Represents Google Antigravity core - Gravitational orbital rings and glowing nucleus.
 */
export function AntigravityClassicIcon({ className = "w-4 h-4", size }: IconProps) {
    const sizeStyle = size ? { width: size, height: size } : undefined;
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            style={sizeStyle}
        >
            <defs>
                <linearGradient id="ag-classic-core" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#38bdf8" />
                    <stop offset="0.5" stopColor="#6366f1" />
                    <stop offset="1" stopColor="#a855f7" />
                </linearGradient>
                <linearGradient id="ag-classic-ring" x1="4" y1="12" x2="20" y2="12" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#06b6d4" stopOpacity="0.9" />
                    <stop offset="1" stopColor="#818cf8" stopOpacity="0.9" />
                </linearGradient>
            </defs>
            {/* Orbital Ellipse 1 */}
            <ellipse
                cx="12"
                cy="12"
                rx="9.5"
                ry="3.8"
                transform="rotate(-30 12 12)"
                stroke="url(#ag-classic-ring)"
                strokeWidth="1.6"
                strokeDasharray="4 2"
            />
            {/* Orbital Ellipse 2 */}
            <ellipse
                cx="12"
                cy="12"
                rx="9.5"
                ry="3.8"
                transform="rotate(30 12 12)"
                stroke="url(#ag-classic-ring)"
                strokeWidth="1.6"
            />
            {/* Planetary Core */}
            <circle cx="12" cy="12" r="3.2" fill="url(#ag-classic-core)" />
            {/* Inner Singularity */}
            <circle cx="10.8" cy="10.8" r="1" fill="#ffffff" fillOpacity="0.95" />
            {/* Orbital Satellites */}
            <circle cx="19.5" cy="7.5" r="1.2" fill="#38bdf8" />
            <circle cx="4.5" cy="16.5" r="1" fill="#a855f7" />
        </svg>
    );
}

/**
 * 💻 Antigravity IDE Icon
 * Represents the Antigravity Integrated Development Environment - Sleek code editor frame with neon code glyphs.
 */
export function AntigravityIdeIcon({ className = "w-4 h-4", size }: IconProps) {
    const sizeStyle = size ? { width: size, height: size } : undefined;
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            style={sizeStyle}
        >
            <defs>
                <linearGradient id="ag-ide-frame" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#1e293b" />
                    <stop offset="1" stopColor="#0f172a" />
                </linearGradient>
                <linearGradient id="ag-ide-code" x1="7" y1="12" x2="17" y2="12" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#06b6d4" />
                    <stop offset="1" stopColor="#38bdf8" />
                </linearGradient>
            </defs>
            {/* IDE Window Frame */}
            <rect
                x="2.5"
                y="3.5"
                width="19"
                height="17"
                rx="3.5"
                fill="url(#ag-ide-frame)"
                stroke="#38bdf8"
                strokeWidth="1.5"
                strokeOpacity="0.8"
            />
            {/* Header bar divider */}
            <line x1="2.5" y1="8" x2="21.5" y2="8" stroke="#334155" strokeWidth="1" />
            {/* Window Controls */}
            <circle cx="5.5" cy="5.8" r="1" fill="#ef4444" />
            <circle cx="8" cy="5.8" r="1" fill="#f59e0b" />
            <circle cx="10.5" cy="5.8" r="1" fill="#10b981" />
            {/* Active Code / Antigravity Glyphs < / > */}
            <path
                d="M8.5 11.5L6 14L8.5 16.5"
                stroke="url(#ag-ide-code)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M15.5 11.5L18 14L15.5 16.5"
                stroke="url(#ag-ide-code)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M13 10.5L11 17.5"
                stroke="#818cf8"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

/**
 * ⚡ Antigravity CLI Icon (`agy`)
 * Represents the Antigravity Terminal / Command Line Interface (`agy`).
 */
export function AntigravityCliIcon({ className = "w-4 h-4", size }: IconProps) {
    const sizeStyle = size ? { width: size, height: size } : undefined;
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            style={sizeStyle}
        >
            <defs>
                <linearGradient id="ag-cli-border" x1="2" y1="4" x2="22" y2="20" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#10b981" />
                    <stop offset="1" stopColor="#059669" />
                </linearGradient>
                <linearGradient id="ag-cli-prompt" x1="5" y1="12" x2="11" y2="12" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#34d399" />
                    <stop offset="1" stopColor="#10b981" />
                </linearGradient>
            </defs>
            {/* Terminal Window Frame */}
            <rect
                x="2.5"
                y="4"
                width="19"
                height="16"
                rx="3"
                fill="#090d16"
                stroke="url(#ag-cli-border)"
                strokeWidth="1.5"
                strokeOpacity="0.85"
            />
            {/* Shell Prompt > */}
            <path
                d="M6.5 9L10 12L6.5 15"
                stroke="url(#ag-cli-prompt)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Active Cursor _ */}
            <line
                x1="12"
                y1="15"
                x2="16.5"
                y2="15"
                stroke="#34d399"
                strokeWidth="2"
                strokeLinecap="round"
            />
            {/* "agy" Monospace Tag */}
            <text
                x="12"
                y="11"
                fill="#6ee7b7"
                fontSize="6"
                fontFamily="monospace"
                fontWeight="bold"
                letterSpacing="0.5"
            >
                agy
            </text>
        </svg>
    );
}
