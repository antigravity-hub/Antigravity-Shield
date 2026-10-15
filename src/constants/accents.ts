export type AccentColorId = 
    | 'seafoam'   // Seafoam Green / زمرد دریایی (دیفالت)
    | 'amber'     // Amber Gold / کهربایی
    | 'cyan'      // Azure Sky / آبی آسمانی
    | 'violet'    // Lavender Violet / یاسی
    | 'rose'      // Crimson Rose / رز یاقوتی
    | 'emerald'   // Jade Emerald / یشم درخشان
    | 'sunset';   // Sunset Coral / مرجانی غروب

export interface AccentColorDefinition {
    id: AccentColorId;
    nameKey: string;
    descKey: string;
    hex: string;
    secondaryHex: string;
    lightTextHex: string;
    cssVars: {
        accent: string;
        accentRgb: string;
        accentGlow: string;
        accentHover: string;
        primaryButton: string;
        primaryButtonHover: string;
        badgeBg: string;
        badgeText: string;
        badgeBorder: string;
    };
}

export const ACCENT_COLORS: AccentColorDefinition[] = [
    {
        id: 'seafoam',
        nameKey: 'theme.accents.seafoam.name',
        descKey: 'theme.accents.seafoam.desc',
        hex: '#93e9be',
        secondaryHex: '#129a5f',
        lightTextHex: '#0f794c',
        cssVars: {
            accent: '#93e9be',
            accentRgb: '147, 233, 190',
            accentGlow: 'rgba(147, 233, 190, 0.25)',
            accentHover: 'rgba(147, 233, 190, 0.15)',
            primaryButton: '#129a5f',
            primaryButtonHover: '#15b36e',
            badgeBg: 'rgba(147, 233, 190, 0.15)',
            badgeText: '#93e9be',
            badgeBorder: 'rgba(147, 233, 190, 0.35)',
        },
    },
    {
        id: 'cyan',
        nameKey: 'theme.accents.cyan.name',
        descKey: 'theme.accents.cyan.desc',
        hex: '#38bdf8',
        secondaryHex: '#0284c7',
        lightTextHex: '#0369a1',
        cssVars: {
            accent: '#38bdf8',
            accentRgb: '56, 189, 248',
            accentGlow: 'rgba(56, 189, 248, 0.25)',
            accentHover: 'rgba(56, 189, 248, 0.15)',
            primaryButton: '#0284c7',
            primaryButtonHover: '#0ea5e9',
            badgeBg: 'rgba(56, 189, 248, 0.15)',
            badgeText: '#38bdf8',
            badgeBorder: 'rgba(56, 189, 248, 0.35)',
        },
    },
    {
        id: 'violet',
        nameKey: 'theme.accents.violet.name',
        descKey: 'theme.accents.violet.desc',
        hex: '#c084fc',
        secondaryHex: '#7e22ce',
        lightTextHex: '#6b21a8',
        cssVars: {
            accent: '#c084fc',
            accentRgb: '192, 132, 252',
            accentGlow: 'rgba(192, 132, 252, 0.25)',
            accentHover: 'rgba(192, 132, 252, 0.15)',
            primaryButton: '#7e22ce',
            primaryButtonHover: '#9333ea',
            badgeBg: 'rgba(192, 132, 252, 0.15)',
            badgeText: '#c084fc',
            badgeBorder: 'rgba(192, 132, 252, 0.35)',
        },
    },
    {
        id: 'amber',
        nameKey: 'theme.accents.amber.name',
        descKey: 'theme.accents.amber.desc',
        hex: '#fbbf24',
        secondaryHex: '#d97706',
        lightTextHex: '#b45309',
        cssVars: {
            accent: '#fbbf24',
            accentRgb: '251, 191, 36',
            accentGlow: 'rgba(251, 191, 36, 0.25)',
            accentHover: 'rgba(251, 191, 36, 0.15)',
            primaryButton: '#d97706',
            primaryButtonHover: '#f59e0b',
            badgeBg: 'rgba(251, 191, 36, 0.15)',
            badgeText: '#fbbf24',
            badgeBorder: 'rgba(251, 191, 36, 0.35)',
        },
    },
    {
        id: 'rose',
        nameKey: 'theme.accents.rose.name',
        descKey: 'theme.accents.rose.desc',
        hex: '#fb7185',
        secondaryHex: '#e11d48',
        lightTextHex: '#be123c',
        cssVars: {
            accent: '#fb7185',
            accentRgb: '251, 113, 133',
            accentGlow: 'rgba(251, 113, 133, 0.25)',
            accentHover: 'rgba(251, 113, 133, 0.15)',
            primaryButton: '#e11d48',
            primaryButtonHover: '#f43f5e',
            badgeBg: 'rgba(251, 113, 133, 0.15)',
            badgeText: '#fb7185',
            badgeBorder: 'rgba(251, 113, 133, 0.35)',
        },
    },
    {
        id: 'emerald',
        nameKey: 'theme.accents.emerald.name',
        descKey: 'theme.accents.emerald.desc',
        hex: '#34d399',
        secondaryHex: '#059669',
        lightTextHex: '#047857',
        cssVars: {
            accent: '#34d399',
            accentRgb: '52, 211, 153',
            accentGlow: 'rgba(52, 211, 153, 0.25)',
            accentHover: 'rgba(52, 211, 153, 0.15)',
            primaryButton: '#059669',
            primaryButtonHover: '#10b981',
            badgeBg: 'rgba(52, 211, 153, 0.15)',
            badgeText: '#34d399',
            badgeBorder: 'rgba(52, 211, 153, 0.35)',
        },
    },
    {
        id: 'sunset',
        nameKey: 'theme.accents.sunset.name',
        descKey: 'theme.accents.sunset.desc',
        hex: '#f97316',
        secondaryHex: '#c2410c',
        lightTextHex: '#9a3412',
        cssVars: {
            accent: '#f97316',
            accentRgb: '249, 115, 22',
            accentGlow: 'rgba(249, 115, 22, 0.25)',
            accentHover: 'rgba(249, 115, 22, 0.15)',
            primaryButton: '#c2410c',
            primaryButtonHover: '#ea580c',
            badgeBg: 'rgba(249, 115, 22, 0.15)',
            badgeText: '#f97316',
            badgeBorder: 'rgba(249, 115, 22, 0.35)',
        },
    },
];

export const DEFAULT_ACCENT_COLOR: AccentColorId = 'seafoam';

export function getAccentColor(id?: string): AccentColorDefinition {
    const found = ACCENT_COLORS.find(c => c.id === id);
    return found || ACCENT_COLORS[0];
}
