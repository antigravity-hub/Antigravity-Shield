/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Repository: https://github.com/antigravity-hub/Antigravity-Shield
 */
import { useTranslation } from 'react-i18next';
import platformLogo from '../../assets/icons/antigravity-agentic.png';
import ideLogo from '../../assets/icons/antigravity-ide.png';
import cliLogo from '../../assets/icons/antigravity-cli.png';

interface IconProps {
    className?: string;
    size?: number;
}

/**
 * 🪐 Antigravity Platform Icon (formerly Classic / Agentic)
 * Uses official Antigravity Platform logo from assets.
 */
export function AntigravityPlatformIcon({ className = "w-4 h-4", size }: IconProps) {
    const { t } = useTranslation();
    const sizeStyle = size ? { width: size, height: size } : undefined;
    return (
        <img
            src={platformLogo}
            alt={t('accounts.target.platform', 'Antigravity Platform')}
            className={className}
            style={{ objectFit: 'contain', ...sizeStyle }}
            draggable={false}
        />
    );
}

export const AntigravityClassicIcon = AntigravityPlatformIcon;

/**
 * 💻 Antigravity IDE Icon
 * Uses official Antigravity IDE logo from assets.
 */
export function AntigravityIdeIcon({ className = "w-4 h-4", size }: IconProps) {
    const { t } = useTranslation();
    const sizeStyle = size ? { width: size, height: size } : undefined;
    return (
        <img
            src={ideLogo}
            alt={t('accounts.target.ide', 'Antigravity IDE')}
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
    const { t } = useTranslation();
    const sizeStyle = size ? { width: size, height: size } : undefined;
    return (
        <img
            src={cliLogo}
            alt={t('accounts.target.cli', 'Antigravity CLI')}
            className={className}
            style={{ objectFit: 'contain', ...sizeStyle }}
            draggable={false}
        />
    );
}
