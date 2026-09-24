import React, { useEffect, useState, useRef, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTranslation } from 'react-i18next';
import { Zap, Clock, X, AlertTriangle, CheckCircle2, Loader2, Shield, Sparkles, Cpu } from 'lucide-react';
import { getFloatingOverlayPayload } from '../../services/overlayNotificationService';

export interface OverlayPayload {
    notification_type: 'countdown' | 'toast';
    title: string;
    message: string;
    model_name?: string;
    current_email?: string;
    target_email?: string;
    target_quota_score?: number;
    countdown_secs?: number;
    target_account_id?: string;
    target_env?: string;
}

export const NotificationOverlay: React.FC = () => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'fa' || i18n.language === 'ar' || i18n.language.startsWith('fa-');

    const [payload, setPayload] = useState<OverlayPayload | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(30);
    const totalTimeRef = useRef<number>(30);
    const timerRef = useRef<any>(null);
    const safetyTimerRef = useRef<any>(null);
    const payloadRef = useRef<OverlayPayload | null>(null);
    payloadRef.current = payload;

    // Guaranteed window hide function: backend invoke + direct client webview fallback
    const closeOverlay = useCallback(async () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (safetyTimerRef.current) {
            clearTimeout(safetyTimerRef.current);
            safetyTimerRef.current = null;
        }

        try {
            await invoke('hide_overlay_notification');
        } catch (err) {
            console.warn('[NotificationOverlay] Backend hide invoke failed:', err);
        }

        try {
            const win = getCurrentWindow();
            await win.hide();
        } catch (err) {
            console.warn('[NotificationOverlay] Direct window hide fallback failed:', err);
        }

        setPayload(null);
    }, []);

    const handleAction = useCallback(async (action: 'switch_now' | 'snooze' | 'cancel') => {
        const currentPayload = payloadRef.current;
        if (timerRef.current) {
            clearInterval(timerRef.current);
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (safetyTimerRef.current) {
            clearTimeout(safetyTimerRef.current);
            safetyTimerRef.current = null;
        }

        try {
            await emit('overlay-user-action', {
                action,
                target_account_id: currentPayload?.target_account_id,
                target_env: currentPayload?.target_env,
                target_email: currentPayload?.target_email,
            });
        } catch (err) {
            console.error('[NotificationOverlay] Error dispatching action:', err);
        }

        await closeOverlay();
    }, [closeOverlay]);

    const initTimer = useCallback((data: OverlayPayload) => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (safetyTimerRef.current) {
            clearTimeout(safetyTimerRef.current);
            safetyTimerRef.current = null;
        }

        const isCountdown = data.notification_type === 'countdown';
        const initialSecs = isCountdown
            ? (data.countdown_secs && data.countdown_secs > 0 ? data.countdown_secs : 30)
            : 5; // Toasts auto-dismiss after 5 seconds

        totalTimeRef.current = initialSecs;
        setTimeLeft(initialSecs);

        // 1. Live ticking interval for smooth real-time countdown & progress bar
        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    if (timerRef.current) {
                        clearInterval(timerRef.current);
                        clearTimeout(timerRef.current);
                        timerRef.current = null;
                    }
                    if (isCountdown) {
                        handleAction('switch_now');
                    } else {
                        closeOverlay();
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // 2. Secondary hard safety timer to guarantee auto-closing even if background throttling occurs
        safetyTimerRef.current = setTimeout(() => {
            if (isCountdown) {
                handleAction('switch_now');
            } else {
                closeOverlay();
            }
        }, (initialSecs * 1000) + 500);
    }, [handleAction, closeOverlay]);

    useEffect(() => {
        let isMounted = true;

        // 1. Immediately hydrate from backend if payload is already cached in Rust state
        getFloatingOverlayPayload().then((cached) => {
            if (isMounted && cached) {
                setPayload(cached as OverlayPayload);
                initTimer(cached as OverlayPayload);
            }
        }).catch((err) => {
            console.warn('[NotificationOverlay] Failed to fetch cached payload:', err);
        });

        // 2. Listen for push notification events from Tauri
        const unlistenPromise = listen<OverlayPayload>('overlay-notification-show', (event) => {
            if (!isMounted) return;
            const data = event.payload;
            setPayload(data);
            initTimer(data);
        });

        // 3. Safety auto-dismiss: If no payload is received within 3.5 seconds of initial mount, hide window
        const safetyTimer = setTimeout(() => {
            if (isMounted) {
                setPayload((current) => {
                    if (!current) {
                        closeOverlay();
                    }
                    return current;
                });
            }
        }, 3500);

        return () => {
            isMounted = false;
            clearTimeout(safetyTimer);
            unlistenPromise.then((unlisten) => unlisten());
            if (timerRef.current) {
                clearInterval(timerRef.current);
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            if (safetyTimerRef.current) {
                clearTimeout(safetyTimerRef.current);
                safetyTimerRef.current = null;
            }
        };
    }, [initTimer, closeOverlay]);

    // Keyboard navigation: Enter for Switch, Space for Snooze, Escape for Cancel/Dismiss
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const current = payloadRef.current;
            if (!current || current.notification_type !== 'countdown') {
                if (e.key === 'Escape' || e.key === 'Enter') {
                    closeOverlay();
                }
                return;
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                handleAction('switch_now');
            } else if (e.code === 'Space') {
                e.preventDefault();
                handleAction('snooze');
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handleAction('cancel');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleAction, closeOverlay]);

    const progressPercentage = Math.max(0, Math.min(100, (timeLeft / (totalTimeRef.current || 1)) * 100));
    const isUrgent = payload?.notification_type === 'countdown' ? timeLeft <= 7 : timeLeft <= 2;

    const formatModelName = (name?: string) => {
        if (!name) return t('notifications.overlay_default_model', { defaultValue: 'AI Model' });
        const lower = name.toLowerCase().trim();
        if (lower === 'claude') return t('notifications.family_claude', { defaultValue: 'Claude' });
        if (lower === 'gemini') return t('notifications.family_gemini', { defaultValue: 'Gemini' });
        return name;
    };

    return (
        <div
            className={`w-screen h-screen select-none overflow-hidden p-2 flex items-center justify-center font-sans ${isRtl ? 'rtl' : 'ltr'}`}
            style={{ background: 'transparent' }}
        >
            {/* Main Cyber-Glass Card */}
            <div
                className={`relative w-full h-full rounded-2xl flex flex-col justify-between p-3.5 shadow-2xl backdrop-blur-2xl transition-all duration-300 overflow-hidden border ${
                    isUrgent
                        ? 'bg-slate-950/95 border-rose-500/50 shadow-[0_8px_30px_rgba(244,63,94,0.3)]'
                        : 'bg-slate-950/95 border-cyan-500/30 shadow-[0_8px_30px_rgba(6,182,212,0.2)]'
                }`}
            >
                {/* Specular Ambient Glow Overlay */}
                <div
                    className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
                        isUrgent
                            ? 'bg-gradient-to-b from-rose-500/[0.08] via-transparent to-transparent'
                            : 'bg-gradient-to-b from-cyan-500/[0.07] via-transparent to-transparent'
                    }`}
                />

                {/* Top Specular Edge Highlight (Physical Glass Effect) */}
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

                {/* Drag Region & Header */}
                <div
                    data-tauri-drag-region
                    className="relative flex items-center justify-between cursor-move pb-2 border-b border-slate-800/80 flex-shrink-0 z-10"
                >
                    <div className="flex items-center gap-2 min-w-0">
                        {payload?.notification_type === 'countdown' ? (
                            <div className="relative flex items-center justify-center">
                                <div
                                    className={`p-1.5 rounded-xl flex-shrink-0 border ${
                                        isUrgent
                                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                                    }`}
                                >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                </div>
                                {isUrgent && (
                                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                                )}
                            </div>
                        ) : (
                            <div className="p-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.25)] flex-shrink-0">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 min-w-0">
                            <Shield className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                            <span className="text-[12px] font-bold tracking-wide text-slate-100 uppercase truncate">
                                {payload?.title || t('notifications.overlay_title', { defaultValue: 'Antigravity Shield' })}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        {payload?.notification_type === 'countdown' ? (
                            <div
                                className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-bold shadow-sm transition-colors ${
                                    isUrgent
                                        ? 'bg-rose-950/70 text-rose-300 border border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.35)] animate-pulse'
                                        : 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                                }`}
                            >
                                <Clock className="w-3 h-3 flex-shrink-0" />
                                <span>{timeLeft}s</span>
                            </div>
                        ) : (
                            <div className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900/80 text-cyan-300 border border-cyan-500/20 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5 text-cyan-400" />
                                <span>{timeLeft}s</span>
                            </div>
                        )}

                        <button
                            onClick={closeOverlay}
                            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
                            title={t('notifications.overlay_dismiss', { defaultValue: 'Dismiss (Esc)' })}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Content Body */}
                <div className="relative py-2 flex-1 flex flex-col justify-center min-h-0 z-10">
                    {!payload ? (
                        <div className="flex items-center justify-center gap-2 text-xs text-slate-400 py-3">
                            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                            <span>{t('notifications.overlay_waiting', { defaultValue: 'Waiting for Shield data...' })}</span>
                        </div>
                    ) : payload.notification_type === 'countdown' ? (
                        <div className="space-y-2">
                            {/* Row 1: Model Quota Depletion Notice */}
                            <div className="text-[11px] text-slate-300 flex items-center justify-between gap-1.5 leading-normal overflow-hidden whitespace-nowrap">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 text-[11px] font-semibold border border-amber-500/30 flex items-center gap-1 whitespace-nowrap flex-shrink-0 shadow-sm">
                                        <Cpu className="w-3 h-3 text-amber-400" />
                                        {formatModelName(payload.model_name)}
                                    </span>
                                    <span className="text-slate-400 font-medium whitespace-nowrap flex-shrink-0">
                                        {t('notifications.overlay_quota_for', { defaultValue: 'Quota depleted for' })}
                                    </span>
                                </div>
                                {payload.current_email && (
                                    <span
                                        className="text-slate-400 truncate text-[11px] font-mono min-w-0 max-w-[170px]"
                                        title={payload.current_email}
                                    >
                                        ({payload.current_email})
                                    </span>
                                )}
                            </div>

                            {/* Row 2: Inset Recommended Target Account Card */}
                            <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-slate-900/95 via-slate-900/80 to-slate-900/95 rounded-xl px-3 py-2 border border-emerald-500/25 shadow-inner">
                                <div className="flex items-center gap-2 min-w-0 truncate">
                                    <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium leading-none">
                                            {t('notifications.overlay_switch_to', { defaultValue: 'Switch to:' })}
                                        </span>
                                        <span
                                            className="text-emerald-300 font-semibold text-[12px] truncate min-w-0 leading-tight pt-0.5"
                                            title={payload.target_email}
                                        >
                                            {payload.target_email || '...'}
                                        </span>
                                    </div>
                                </div>
                                {payload.target_quota_score !== undefined && (
                                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-mono font-bold whitespace-nowrap flex-shrink-0 flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                                        <span>{payload.target_quota_score}% {t('notifications.overlay_quota_badge', { defaultValue: 'quota' })}</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col justify-center py-1">
                            <div className="flex items-center gap-3 bg-gradient-to-r from-slate-900/95 via-slate-900/80 to-slate-900/95 rounded-xl px-3.5 py-3 border border-cyan-500/25 shadow-inner">
                                <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 text-cyan-400">
                                    <Zap className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-[13px] font-semibold text-slate-100 leading-snug line-clamp-2">
                                        {payload.message}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Laser Progress Bar (Live countdown for both Countdown & Toast) */}
                {payload && (
                    <div className="w-full bg-slate-900/90 rounded-full h-1.5 overflow-hidden my-1 flex-shrink-0 border border-slate-800/80 shadow-inner relative">
                        <div
                            className={`h-full transition-all duration-300 ease-linear rounded-full ${
                                isUrgent
                                    ? 'bg-gradient-to-r from-rose-500 via-amber-400 to-rose-400 animate-pulse'
                                    : 'bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400'
                            }`}
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>
                )}

                {/* Action Buttons with Micro-Keyboard Hints */}
                {payload?.notification_type === 'countdown' ? (
                    <div className="flex items-center justify-between gap-2 pt-1 flex-shrink-0 z-10">
                        {/* Primary Action */}
                        <button
                            onClick={() => handleAction('switch_now')}
                            className="flex-1 py-1.5 px-3 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_18px_rgba(6,182,212,0.35)] hover:shadow-[0_0_24px_rgba(6,182,212,0.55)] transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap flex-shrink-0 cursor-pointer"
                        >
                            <Zap className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{t('notifications.overlay_switch_now', { defaultValue: 'Switch Now' })}</span>
                            <kbd className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/40 text-cyan-200 border border-cyan-300/30 ms-1 shadow-sm">
                                ↵
                            </kbd>
                        </button>

                        {/* Secondary Action */}
                        <button
                            onClick={() => handleAction('snooze')}
                            className="py-1.5 px-3 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 bg-slate-900/85 hover:bg-slate-800 text-slate-300 border border-slate-700/80 hover:text-white hover:border-slate-600 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap flex-shrink-0 cursor-pointer"
                        >
                            <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span>{t('notifications.overlay_snooze', { defaultValue: 'Snooze 5m' })}</span>
                            <kbd className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/40 text-slate-400 border border-slate-700 ms-1 shadow-sm">
                                ␣
                            </kbd>
                        </button>

                        {/* Tertiary Action */}
                        <button
                            onClick={() => handleAction('cancel')}
                            className="py-1.5 px-2.5 rounded-xl text-[11px] font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors whitespace-nowrap flex-shrink-0 cursor-pointer"
                        >
                            <span>{t('notifications.overlay_cancel', { defaultValue: 'Cancel' })}</span>
                            <kbd className="text-[9px] font-mono px-1 py-0.5 rounded bg-slate-900/60 text-slate-500 border border-slate-800 ms-1">
                                Esc
                            </kbd>
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between pt-1 flex-shrink-0 z-10 border-t border-slate-800/60">
                        <span className="text-[11px] text-slate-400 font-medium">
                            {t('notifications.overlay_auto_dismiss_timer', {
                                defaultValue: `Auto-closing in ${timeLeft}s`,
                                seconds: timeLeft,
                            })}
                        </span>
                        <button
                            onClick={closeOverlay}
                            className="py-1 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-200 transition-colors cursor-pointer"
                        >
                            {t('notifications.overlay_dismiss', { defaultValue: 'Dismiss' })}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationOverlay;
