import React, { useEffect, useState, useRef, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { emit } from '@tauri-apps/api/event';
import { request as invoke } from '../../utils/request';
import { useTranslation } from 'react-i18next';
import { Zap, Clock, X, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
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

    const handleAction = useCallback(async (action: 'switch_now' | 'snooze' | 'cancel') => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        try {
            await emit('overlay-user-action', {
                action,
                target_account_id: payload?.target_account_id,
                target_env: payload?.target_env,
                target_email: payload?.target_email,
            });
            await invoke('hide_overlay_notification');
        } catch (err) {
            console.error('[NotificationOverlay] Error dispatching action:', err);
        }
    }, [payload]);

    const initTimer = useCallback((data: OverlayPayload) => {
        const initialSecs = data.countdown_secs && data.countdown_secs > 0 ? data.countdown_secs : 30;
        totalTimeRef.current = initialSecs;
        setTimeLeft(initialSecs);

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if (data.notification_type === 'countdown') {
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        if (timerRef.current) clearInterval(timerRef.current);
                        handleAction('switch_now');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            // Auto dismiss toasts after 7 seconds
            timerRef.current = setTimeout(() => {
                invoke('hide_overlay_notification');
            }, 7000);
        }
    }, [handleAction]);

    useEffect(() => {
        let isMounted = true;

        // 1. Immediately hydrate from backend if payload is already cached in Rust state
        getFloatingOverlayPayload().then((cached) => {
            if (isMounted && cached) {
                setPayload(cached as OverlayPayload);
                initTimer(cached as OverlayPayload);
            }
        });

        // 2. Listen for push notification events from Tauri
        const unlistenPromise = listen<OverlayPayload>('overlay-notification-show', (event) => {
            if (!isMounted) return;
            const data = event.payload;
            setPayload(data);
            initTimer(data);
        });

        return () => {
            isMounted = false;
            unlistenPromise.then((unlisten) => unlisten());
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [initTimer]);

    // Keyboard navigation: Enter for Switch, Space for Snooze, Escape for Cancel
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!payload || payload.notification_type !== 'countdown') {
                if (e.key === 'Escape' || e.key === 'Enter') {
                    invoke('hide_overlay_notification');
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
    }, [handleAction, payload]);

    const progressPercentage = Math.max(0, Math.min(100, (timeLeft / (totalTimeRef.current || 30)) * 100));
    const isUrgent = timeLeft <= 7;

    const formatModelName = (name?: string) => {
        if (!name) return t('notifications.overlay_default_model', { defaultValue: 'AI Model' });
        const lower = name.toLowerCase().trim();
        if (lower === 'claude') return t('notifications.family_claude', { defaultValue: 'Claude' });
        if (lower === 'gemini') return t('notifications.family_gemini', { defaultValue: 'Gemini' });
        return name;
    };

    return (
        <div
            className={`w-screen h-screen select-none overflow-hidden p-1.5 flex items-center justify-center font-sans ${isRtl ? 'rtl' : 'ltr'}`}
            style={{ background: 'transparent' }}
        >
            <div
                className={`relative w-full h-full rounded-2xl flex flex-col justify-between p-3.5 shadow-2xl backdrop-blur-2xl transition-all duration-300 border ${
                    isUrgent
                        ? 'bg-slate-950/95 border-rose-500/60 shadow-rose-950/60'
                        : 'bg-slate-950/95 border-cyan-500/40 shadow-cyan-950/50'
                }`}
            >
                {/* Drag Region & Header */}
                <div
                    data-tauri-drag-region
                    className="flex items-center justify-between cursor-move pb-2 border-b border-slate-800/80 flex-shrink-0"
                >
                    <div className="flex items-center gap-2 min-w-0">
                        {payload?.notification_type === 'countdown' ? (
                            <div className={`p-1.5 rounded-lg flex-shrink-0 ${isUrgent ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'bg-amber-500/20 text-amber-400'}`}>
                                <AlertTriangle className="w-3.5 h-3.5" />
                            </div>
                        ) : (
                            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 flex-shrink-0">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                        )}
                        <span className="text-xs font-semibold tracking-wide text-slate-100 truncate">
                            {payload?.title || t('notifications.overlay_title', { defaultValue: 'Antigravity Shield' })}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        {payload?.notification_type === 'countdown' && (
                            <div
                                className={`text-[11px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 font-bold ${
                                    isUrgent
                                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                                        : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                                }`}
                            >
                                <Clock className="w-3 h-3 flex-shrink-0" />
                                <span>{timeLeft}s</span>
                            </div>
                        )}

                        <button
                            onClick={() => handleAction('cancel')}
                            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 rounded-md transition-colors"
                            title={t('notifications.overlay_dismiss', { defaultValue: 'Dismiss (Esc)' })}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Content Body */}
                <div className="py-1.5 flex-1 flex flex-col justify-center min-h-0">
                    {!payload ? (
                        <div className="flex items-center justify-center gap-2 text-xs text-slate-400 py-3">
                            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                            <span>{t('notifications.overlay_waiting', { defaultValue: 'Waiting for Shield data...' })}</span>
                        </div>
                    ) : payload.notification_type === 'countdown' ? (
                        <div className="space-y-2">
                            {/* Row 1: Model Quota Depletion Notice */}
                            <div className="text-[12px] text-slate-300 flex items-center gap-1.5 leading-normal overflow-hidden whitespace-nowrap">
                                <span className="text-slate-400 font-medium whitespace-nowrap flex-shrink-0">
                                    {t('notifications.overlay_quota_for', { defaultValue: 'Quota depleted for' })}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-slate-800/90 text-amber-300 text-[11px] font-semibold border border-amber-500/25 whitespace-nowrap flex-shrink-0 shadow-sm">
                                    {formatModelName(payload.model_name)}
                                </span>
                                {payload.current_email && (
                                    <span
                                        className="text-slate-400 truncate text-[11px] min-w-0"
                                        title={payload.current_email}
                                    >
                                        ({payload.current_email})
                                    </span>
                                )}
                            </div>

                            {/* Row 2: Target Account & Quota Badge */}
                            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300 bg-slate-900/70 rounded-xl px-2.5 py-1.5 border border-slate-800/70 shadow-inner">
                                <div className="flex items-center gap-1.5 min-w-0 truncate">
                                    <span className="text-slate-400 whitespace-nowrap flex-shrink-0">
                                        {t('notifications.overlay_switch_to', { defaultValue: 'Switch to:' })}
                                    </span>
                                    <strong
                                        className="text-emerald-400 font-medium truncate min-w-0"
                                        title={payload.target_email}
                                    >
                                        {payload.target_email || '...'}
                                    </strong>
                                </div>
                                {payload.target_quota_score !== undefined && (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-[10px] font-bold whitespace-nowrap flex-shrink-0">
                                        {payload.target_quota_score}% {t('notifications.overlay_quota_badge', { defaultValue: 'quota' })}
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="text-xs text-slate-200 py-1 leading-relaxed line-clamp-3">
                            {payload.message}
                        </div>
                    )}
                </div>

                {/* Live Progress Bar (Countdown Only) */}
                {payload?.notification_type === 'countdown' && (
                    <div className="w-full bg-slate-800/60 rounded-full h-1 overflow-hidden my-1 flex-shrink-0">
                        <div
                            className={`h-full transition-all duration-300 ${
                                isUrgent
                                    ? 'bg-gradient-to-r from-rose-500 to-amber-400 animate-pulse'
                                    : 'bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400'
                            }`}
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>
                )}

                {/* Action Buttons */}
                {payload?.notification_type === 'countdown' ? (
                    <div className="flex items-center justify-between gap-2 pt-1 flex-shrink-0">
                        <button
                            onClick={() => handleAction('switch_now')}
                            className="flex-1 py-1.5 px-3 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white shadow-md shadow-cyan-950/50 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap flex-shrink-0"
                            title="Enter"
                        >
                            <Zap className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{t('notifications.overlay_switch_now', { defaultValue: 'Switch Now' })}</span>
                        </button>

                        <button
                            onClick={() => handleAction('snooze')}
                            className="py-1.5 px-3 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60 hover:text-white transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap flex-shrink-0"
                            title="Space"
                        >
                            <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span>{t('notifications.overlay_snooze', { defaultValue: 'Snooze 5m' })}</span>
                        </button>

                        <button
                            onClick={() => handleAction('cancel')}
                            className="py-1.5 px-2.5 rounded-xl text-[11px] font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors whitespace-nowrap flex-shrink-0"
                            title="Esc"
                        >
                            <span>{t('notifications.overlay_cancel', { defaultValue: 'Cancel' })}</span>
                        </button>
                    </div>
                ) : (
                    <div className="flex justify-end pt-1 flex-shrink-0">
                        <button
                            onClick={() => invoke('hide_overlay_notification')}
                            className="py-1.5 px-4 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                        >
                            {t('notifications.overlay_dismiss', { defaultValue: 'OK' })}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationOverlay;
