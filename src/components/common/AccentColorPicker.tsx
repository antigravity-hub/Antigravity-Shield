/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Repository: https://github.com/antigravity-hub/Antigravity-Shield
 */
import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACCENT_COLORS, DEFAULT_ACCENT_COLOR } from '../../constants/accents';
import { useConfigStore } from '../../stores/useConfigStore';

interface AccentColorPickerProps {
    compact?: boolean;
    dropUp?: boolean;
}

export const AccentColorPicker: React.FC<AccentColorPickerProps> = ({ compact = false, dropUp = false }) => {
    const { t } = useTranslation();
    const { config, updateAccentColor } = useConfigStore();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentAccentId = config?.accent_color || DEFAULT_ACCENT_COLOR;
    const activeAccent = ACCENT_COLORS.find(c => c.id === currentAccentId) || ACCENT_COLORS[0];

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleSelect = (colorId: string) => {
        updateAccentColor(colorId);
        setIsOpen(false);
    };

    return (
        <div className="relative inline-block" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`relative rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer group active:scale-95 ${
                    compact
                        ? 'p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-white/5'
                        : 'w-10 h-10 bg-gray-100 dark:bg-base-200 hover:bg-gray-200 dark:hover:bg-base-100 rounded-full'
                }`}
                title={t('theme.accent_palette')}
            >
                <Palette className="w-4 h-4 transition-transform group-hover:rotate-12" style={{ color: activeAccent.hex }} />
                
                {/* Active indicator dot */}
                <span
                    className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full border border-white dark:border-[#0c100e] shadow-xs"
                    style={{ backgroundColor: activeAccent.hex }}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div
                    className={`absolute rtl:right-auto rtl:left-0 w-72 rounded-2xl bg-white/95 dark:bg-[#0c100e]/95 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150 ${
                        dropUp || compact
                            ? 'bottom-full mb-2 left-0'
                            : 'top-full mt-2 right-0'
                    }`}
                >
                    <div className="px-2 py-1.5 mb-2 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                        <span className="text-xs font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Palette className="w-3.5 h-3.5" style={{ color: activeAccent.hex }} />
                            {t('theme.accent_palette')}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                            {t('common.accent.7_palettes', "7 PALETTES")}
                        </span>
                    </div>

                    <div className="space-y-1">
                        {ACCENT_COLORS.map((accent) => {
                            const isSelected = accent.id === currentAccentId;
                            return (
                                <button
                                    key={accent.id}
                                    type="button"
                                    onClick={() => handleSelect(accent.id)}
                                    className={`w-full flex items-center justify-between p-2 rounded-xl transition-all duration-150 text-left rtl:text-right cursor-pointer group ${
                                        isSelected
                                            ? 'bg-slate-100/90 dark:bg-white/10 shadow-xs'
                                            : 'hover:bg-slate-50 dark:hover:bg-white/5'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div
                                            className="w-5 h-5 rounded-lg shrink-0 flex items-center justify-center shadow-xs transition-transform group-hover:scale-110"
                                            style={{ backgroundColor: accent.hex }}
                                        >
                                            {isSelected && <Check className="w-3 h-3 text-slate-950 stroke-[3]" />}
                                        </div>
                                        <div className="truncate">
                                            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                                <span>{t(accent.nameKey)}</span>
                                            </div>
                                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                                {t(accent.descKey)}
                                            </div>
                                        </div>
                                    </div>

                                    {isSelected && (
                                        <span
                                            className="w-1.5 h-1.5 rounded-full shrink-0 shadow-xs ml-2 rtl:mr-2 rtl:ml-0"
                                            style={{ backgroundColor: accent.hex }}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
