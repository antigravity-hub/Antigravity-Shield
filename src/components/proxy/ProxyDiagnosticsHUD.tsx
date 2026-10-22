/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Repository: https://github.com/antigravity-hub/Antigravity-Shield
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Activity,
    Zap,
    Play,
    CheckCircle2,
    XCircle,
    RotateCcw,
    Terminal,
    Server,
    Cpu,
    Copy,
    Check
} from 'lucide-react';
import { AppConfig } from '../../types/config';
import { ProxyMonitor } from './ProxyMonitor';
import { request } from '../../utils/request';

interface ProxyStatus {
    running: boolean;
    port: number;
    base_url: string;
    active_accounts: number;
}

interface DiagnosticProbeResult {
    success: boolean;
    status_code: number;
    latency_ms: number;
    content: string;
    error?: string;
}

interface ProxyDiagnosticsHUDProps {
    status: ProxyStatus;
    appConfig: AppConfig;
    models?: any[];
}

export const ProxyDiagnosticsHUD: React.FC<ProxyDiagnosticsHUDProps> = ({
    status,
    appConfig: _appConfig,
    models = [],
}) => {
    const { t } = useTranslation();
    // Live Probe State
    const [probeModel, setProbeModel] = useState('gemini-3.8-flash');
    const [probeProtocol, setProbeProtocol] = useState<'openai' | 'claude'>('openai');
    const [probePrompt, setProbePrompt] = useState('Ping! Please respond with: Antigravity Shield API Proxy is operational.');
    const [probeState, setProbeState] = useState<'idle' | 'probing' | 'success' | 'error'>('idle');
    const [probeLatency, setProbeLatency] = useState<number | null>(null);
    const [probeResponse, setProbeResponse] = useState<string | null>(null);
    const [probeError, setProbeError] = useState<string | null>(null);
    const [copiedResponse, setCopiedResponse] = useState(false);

    // Health Telemetry
    const [healthLatency, setHealthLatency] = useState<number | null>(null);
    const [healthStatus, setHealthStatus] = useState<'ok' | 'down'>('down');

    // Group models by family/group for ergonomic dropdown navigation
    const groupedModels = React.useMemo(() => {
        if (!models || models.length === 0) return {};
        const map: Record<string, any[]> = {};
        for (const m of models) {
            const group = m.group || 'Models';
            if (!map[group]) map[group] = [];
            map[group].push(m);
        }
        return map;
    }, [models]);

    // Auto-select valid model when models list is available
    useEffect(() => {
        if (models && models.length > 0 && !models.some((m: any) => m.id === probeModel)) {
            setProbeModel(models[0].id);
        }
    }, [models]); // eslint-disable-line react-hooks/exhaustive-deps

    // Periodic Health Ping via Native IPC (bypasses WebView2 Mixed Content / Loopback isolation)
    const pingHealth = async () => {
        if (!status.running) {
            setHealthStatus('down');
            setHealthLatency(null);
            return;
        }

        try {
            const res = await request<DiagnosticProbeResult>('proxy_execute_diagnostic_probe', {
                protocol: 'health',
            });
            if (res && res.success) {
                setHealthStatus('ok');
                setHealthLatency(res.latency_ms);
            } else {
                setHealthStatus('down');
            }
        } catch {
            setHealthStatus('down');
        }
    };

    useEffect(() => {
        pingHealth();
        const interval = setInterval(pingHealth, 4000);
        return () => clearInterval(interval);
    }, [status.running]); // eslint-disable-line react-hooks/exhaustive-deps

    // Live Probe Execution via Native IPC Command
    const executeLiveProbe = async () => {
        if (!status.running) {
            setProbeState('error');
            setProbeError('Proxy service is not running. Please start the gateway first.');
            return;
        }

        setProbeState('probing');
        setProbeError(null);
        setProbeResponse(null);
        setProbeLatency(null);

        try {
            const res = await request<DiagnosticProbeResult>('proxy_execute_diagnostic_probe', {
                protocol: probeProtocol,
                model: probeModel,
                prompt: probePrompt,
            });

            setProbeLatency(res.latency_ms);

            if (res.success) {
                setProbeResponse(res.content);
                setProbeState('success');
            } else {
                setProbeError(res.error || 'Diagnostic probe returned an error.');
                setProbeState('error');
            }
        } catch (err: any) {
            setProbeLatency(0);
            setProbeState('error');
            setProbeError(err?.message || err?.toString() || 'Unknown IPC error during diagnostic probe.');
        }
    };

    const handleCopyResponse = async () => {
        if (!probeResponse) return;
        await navigator.clipboard.writeText(probeResponse);
        setCopiedResponse(true);
        setTimeout(() => setCopiedResponse(false), 2000);
    };

    return (
        <div className="space-y-5 animate-in fade-in duration-200">
            {/* Top Diagnostics Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white dark:bg-[#0c100e] p-4 rounded-xl border border-gray-100 dark:border-slate-800/80 shadow-sm flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                            <Server size={15} style={{ color: 'var(--color-accent)' }} />
                            <span>{t('proxy.diagnostics.gateway_health', "Gateway Health")}</span>
                        </div>
                        <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1 flex items-center gap-2">
                            {healthStatus === 'ok' ? (
                                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                    {t('proxy.diagnostics.healthy_amp_responsive', "Healthy &amp; Responsive")}
                                </span>
                            ) : (
                                <span className="text-gray-400 flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                                    {t('proxy.diagnostics.offline', "Offline")}
                                </span>
                            )}
                        </div>
                    </div>
                    {healthLatency !== null && (
                        <div className="text-end">
                            <div className="text-[10px] text-gray-400 font-mono">{t('proxy.diagnostics.ping_latency', "Ping Latency")}</div>
                            <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {healthLatency}ms
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white dark:bg-[#0c100e] p-4 rounded-xl border border-gray-100 dark:border-slate-800/80 shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                        <Cpu size={15} style={{ color: 'var(--color-accent)' }} />
                        <span>{t('proxy.diagnostics.stream_engine', "Stream Engine")}</span>
                    </div>
                    <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 mt-1.5 flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                            {t('proxy.diagnostics.non_blocking_tokio', "Non-Blocking Tokio")}
                        </span>
                        <span className="text-gray-400 font-normal">{t('proxy.diagnostics.http_2_zero_leak', "HTTP/2 Zero-Leak")}</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#0c100e] p-4 rounded-xl border border-gray-100 dark:border-slate-800/80 shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                        <Zap size={15} style={{ color: 'var(--color-accent)' }} />
                        <span>{t('proxy.diagnostics.failover_threshold', "Failover Threshold")}</span>
                    </div>
                    <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 mt-1.5">
                        {t('proxy.diagnostics.sub_50ms_fast_cooldown_rotatio', "Sub-50ms Fast Cooldown Rotation")}
                    </div>
                </div>
            </div>

            {/* Interactive "Test Connection" Live Probe Card */}
            <div className="bg-white dark:bg-[#0c100e] rounded-2xl p-5 border border-gray-100 dark:border-slate-800/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <Activity size={16} style={{ color: 'var(--color-accent)' }} />
                            {t('proxy.diagnostics.interactive_live_diagnostic_pr', "Interactive Live Diagnostic Probe")}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t('proxy.diagnostics.execute_an_actual_inference_re', "Execute an actual inference request through the local gateway to verify end-to-end token routing and latency.")}
                        </p>
                    </div>

                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#141916] p-1 rounded-xl">
                        <button
                            onClick={() => setProbeProtocol('openai')}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                                probeProtocol === 'openai'
                                    ? 'bg-white dark:bg-[#0c100e] text-gray-900 dark:text-gray-100 shadow-xs'
                                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                        >
                            {t('proxy.diagnostics.openai_protocol', "OpenAI Protocol")}
                        </button>
                        <button
                            onClick={() => setProbeProtocol('claude')}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                                probeProtocol === 'claude'
                                    ? 'bg-white dark:bg-[#0c100e] text-gray-900 dark:text-gray-100 shadow-xs'
                                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                        >
                            {t('proxy.diagnostics.claude_protocol', "Claude Protocol")}
                        </button>
                    </div>
                </div>

                {/* Configuration & Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1 block">
                            {t('proxy.diagnostics.target_model_alias', "Target Model Alias")}
                        </label>
                        <select
                            value={probeModel}
                            onChange={(e) => setProbeModel(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-800 bg-white dark:bg-[#0c100e] text-xs font-mono text-gray-900 dark:text-gray-100 focus:outline-none"
                            style={{ borderColor: 'var(--color-accent)' }}
                        >
                            {models && models.length > 0 ? (
                                Object.entries(groupedModels).map(([group, groupList]) => (
                                    <optgroup key={group} label={group}>
                                        {groupList.map((m: any) => (
                                            <option key={m.id} value={m.id}>
                                                {m.name && m.name !== m.id ? `${m.name} (${m.id})` : m.id}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))
                            ) : (
                                <>
                                    <option value="gemini-4-argon">{t('proxy.diagnostics.gemini_4_argon_gemini_4_argon', "Gemini 4 Argon (gemini-4-argon)")}</option>
                                    <option value="gemini-3.8-flash">{t('proxy.diagnostics.gemini_3_8_flash_gemini_3_8_fl', "Gemini 3.8 Flash (gemini-3.8-flash)")}</option>
                                    <option value="gemini-3.5-flash">{t('proxy.diagnostics.gemini_3_5_flash_gemini_3_5_fl', "Gemini 3.5 Flash (gemini-3.5-flash)")}</option>
                                    <option value="gemini-2.5-flash">{t('proxy.diagnostics.gemini_2_5_flash_gemini_2_5_fl', "Gemini 2.5 Flash (gemini-2.5-flash)")}</option>
                                    <option value="claude-sonnet-4-6">{t('proxy.diagnostics.claude_sonnet_4_6_claude_sonne', "Claude Sonnet 4.6 (claude-sonnet-4-6)")}</option>
                                </>
                            )}
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1 block">
                            {t('proxy.diagnostics.diagnostic_test_prompt', "Diagnostic Test Prompt")}
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={probePrompt}
                                onChange={(e) => setProbePrompt(e.target.value)}
                                placeholder={t('proxy.diagnostics.enter_diagnostic_prompt', "Enter diagnostic prompt...")}
                                className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-800 bg-white dark:bg-[#0c100e] text-xs text-gray-900 dark:text-gray-100 focus:outline-none"
                            />
                            <button
                                onClick={executeLiveProbe}
                                disabled={probeState === 'probing' || !status.running}
                                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-opacity flex items-center gap-1.5 disabled:opacity-50"
                                style={{ backgroundColor: 'var(--color-primary-btn)' }}
                            >
                                {probeState === 'probing' ? (
                                    <>
                                        <RotateCcw size={14} className="animate-spin" />
                                        <span>{t('proxy.diagnostics.probing', "Probing...")}</span>
                                    </>
                                ) : (
                                    <>
                                        <Play size={14} />
                                        <span>{t('proxy.diagnostics.test_connection', "Test Connection")}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Probe Result Box (4-State Display) */}
                {probeState === 'probing' && (
                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#141916] border border-gray-200 dark:border-slate-800/80 flex items-center justify-center gap-3 py-8">
                        <RotateCcw size={18} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                            {t('proxy.diagnostics.sending_probe_request_through', "Sending probe request through")} {probeProtocol === 'openai' ? t('proxy.diagnostics.v1_chat_completions', "/v1/chat/completions") : t('proxy.diagnostics.v1_messages', "/v1/messages")}...
                        </span>
                    </div>
                )}

                {probeState === 'success' && (
                    <div className="p-4 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-emerald-500" />
                                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                    {t('proxy.diagnostics.probe_succeeded_bull_200_ok', "Probe Succeeded &bull; 200 OK")}
                                </span>
                            </div>

                            <div className="flex items-center gap-3 font-mono text-xs">
                                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                    {t('proxy.diagnostics.latency', "Latency:")} {probeLatency}ms
                                </span>
                                <span className="text-gray-400">{t('proxy.diagnostics.bull', "&bull;")}</span>
                                <span className="text-gray-500 dark:text-gray-400">
                                    {t('proxy.diagnostics.model', "Model:")} {probeModel}
                                </span>
                            </div>
                        </div>

                        <div className="relative group bg-gray-50 dark:bg-[#141916] p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                            <pre className="text-xs font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                                {probeResponse && probeResponse.trim() ? (
                                    probeResponse
                                ) : (
                                    <span className="text-gray-400 italic">{t('proxy.diagnostics.no_text_content_returned', "No text content returned.")}</span>
                                )}
                            </pre>
                            {probeResponse && probeResponse.trim() && (
                                <button
                                    onClick={handleCopyResponse}
                                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-gray-100 dark:bg-[#0c100e] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#141916] transition-colors"
                                    title={t('proxy.diagnostics.copy_response', "Copy Response")}
                                >
                                    {copiedResponse ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {probeState === 'error' && (
                    <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-900/40 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <XCircle size={16} className="text-rose-500" />
                                <span className="text-xs font-bold text-rose-800 dark:text-rose-300">
                                    {t('proxy.diagnostics.probe_failed', "Probe Failed")}
                                </span>
                            </div>
                            {probeLatency !== null && (
                                <span className="font-mono text-xs text-rose-600 dark:text-rose-400">
                                    {probeLatency}ms
                                </span>
                            )}
                        </div>
                        <p className="text-xs font-mono text-rose-700 dark:text-rose-300 bg-white/70 dark:bg-[#141916] p-2.5 rounded-lg border border-rose-200/50 dark:border-rose-900/30">
                            {probeError}
                        </p>
                    </div>
                )}
            </div>

            {/* Embedded Live Proxy Monitor (Real-Time Request Traffic) */}
            <div className="bg-white dark:bg-[#0c100e] rounded-2xl border border-gray-100 dark:border-slate-800/80 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 dark:border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Terminal size={16} style={{ color: 'var(--color-accent)' }} />
                        <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                            {t('proxy.diagnostics.live_gateway_traffic_amp_reque', "Live Gateway Traffic &amp; Request Logs")}
                        </h4>
                    </div>
                    <span className="text-[11px] font-mono text-gray-400">
                        {t('proxy.diagnostics.sse_real_time_stream', "SSE Real-Time Stream")}
                    </span>
                </div>

                <div className="p-2">
                    <ProxyMonitor className="min-h-[380px]" />
                </div>
            </div>
        </div>
    );
};
