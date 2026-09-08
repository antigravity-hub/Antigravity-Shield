import agenticLogo from '../../assets/icons/antigravity-agentic.png';
import ideLogo from '../../assets/icons/antigravity-ide.png';
import cliLogo from '../../assets/icons/antigravity-cli.png';

interface IconProps {
    className?: string;
    size?: number;
}

/**
 * 🪐 Antigravity Agentic / Classic Icon
 * Uses official Antigravity Agentic logo from assets.
 */
export function AntigravityClassicIcon({ className = "w-4 h-4", size }: IconProps) {
    const sizeStyle = size ? { width: size, height: size } : undefined;
    return (
        <img
            src={agenticLogo}
            alt="Antigravity Agentic"
            className={className}
            style={{ objectFit: 'contain', ...sizeStyle }}
            draggable={false}
        />
    );
}

/**
 * 💻 Antigravity IDE Icon
 * Uses official Antigravity IDE logo from assets.
 */
export function AntigravityIdeIcon({ className = "w-4 h-4", size }: IconProps) {
    const sizeStyle = size ? { width: size, height: size } : undefined;
    return (
        <img
            src={ideLogo}
            alt="Antigravity IDE"
            className={className}
            style={{ objectFit: 'contain', ...sizeStyle }}
            draggable={false}
        />
    );
}

/**
 * ⚡ Antigravity CLI Icon (`agy`)
 * Uses official Antigravity CLI logo from assets.
 */
export function AntigravityCliIcon({ className = "w-4 h-4", size }: IconProps) {
    const sizeStyle = size ? { width: size, height: size } : undefined;
    return (
        <img
            src={cliLogo}
            alt="Antigravity CLI"
            className={className}
            style={{ objectFit: 'contain', ...sizeStyle }}
            draggable={false}
        />
    );
}
