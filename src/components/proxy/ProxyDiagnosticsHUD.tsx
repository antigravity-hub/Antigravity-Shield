import React, { useState, useEffect } from 'react';
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
    // Live Probe State
    const [probeModel, setProbeModel] = useState('gemini-3.5-flash');
    const [probeProtocol, setProbeProtocol] = useState<'openai' | 'claude'>('openai');
    const [probePrompt, setProbePrompt] = useState('Verify Antigravity Shield API Proxy connection and latency.');
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
                <div className="bg-white dark:bg-base-200/60 p-4 rounded-xl border border-gray-100 dark:border-base-300 shadow-sm flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                            <Server size={15} style={{ color: 'var(--color-accent)' }} />
                            <span>Gateway Health</span>
                        </div>
                        <div className="text-lg font-bold text-gray-900 dark:text-base-content mt-1 flex items-center gap-2">
                            {healthStatus === 'ok' ? (
                                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Healthy &amp; Responsive
                                </span>
                            ) : (
                                <span className="text-gray-400 flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                                    Offline
                                </span>
                            )}
                        </div>
                    </div>
                    {healthLatency !== null && (
                        <div className="text-end">
                            <div className="text-[10px] text-gray-400 font-mono">Ping Latency</div>
                            <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {healthLatency}ms
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white dark:bg-base-200/60 p-4 rounded-xl border border-gray-100 dark:border-base-300 shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                        <Cpu size={15} style={{ color: 'var(--color-accent)' }} />
                        <span>Stream Engine</span>
                    </div>
                    <div className="text-xs font-semibold text-gray-900 dark:text-base-content mt-1.5 flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                            Non-Blocking Tokio
                        </span>
                        <span className="text-gray-400 font-normal">HTTP/2 Zero-Leak</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-base-200/60 p-4 rounded-xl border border-gray-100 dark:border-base-300 shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                        <Zap size={15} style={{ color: 'var(--color-accent)' }} />
                        <span>Failover Threshold</span>
                    </div>
                    <div className="text-xs font-semibold text-gray-900 dark:text-base-content mt-1.5">
                        Sub-50ms Fast Cooldown Rotation
                    </div>
                </div>
            </div>

            {/* Interactive "Test Connection" Live Probe Card */}
            <div className="bg-white dark:bg-base-200/60 rounded-2xl p-5 border border-gray-100 dark:border-base-300 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-base-content flex items-center gap-2">
                            <Activity size={16} style={{ color: 'var(--color-accent)' }} />
                            Interactive Live Diagnostic Probe
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Execute an actual inference request through the local gateway to verify end-to-end token routing and latency.
                        </p>
                    </div>

                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-base-300 p-1 rounded-xl">
                        <button
                            onClick={() => setProbeProtocol('openai')}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                                probeProtocol === 'openai'
                                    ? 'bg-white dark:bg-base-100 text-gray-900 dark:text-base-content shadow-xs'
                                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                        >
                            OpenAI Protocol
                        </button>
                        <button
                            onClick={() => setProbeProtocol('claude')}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                                probeProtocol === 'claude'
                                    ? 'bg-white dark:bg-base-100 text-gray-900 dark:text-base-content shadow-xs'
                                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                        >
                            Claude Protocol
                        </button>
                    </div>
                </div>

                {/* Configuration & Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1 block">
                            Target Model Alias
                        </label>
                        <select
                            value={probeModel}
                            onChange={(e) => setProbeModel(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-base-300 bg-white dark:bg-base-100 text-xs font-mono text-gray-900 dark:text-base-content focus:outline-none"
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
                                    <option value="gemini-3.5-flash">Gemini 3.5 Flash (gemini-3.5-flash)</option>
                                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (gemini-2.5-flash)</option>
                                    <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (claude-sonnet-4-6)</option>
                                </>
                            )}
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1 block">
                            Diagnostic Test Prompt
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={probePrompt}
                                onChange={(e) => setProbePrompt(e.target.value)}
                                placeholder="Enter diagnostic prompt..."
                                className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-base-300 bg-white dark:bg-base-100 text-xs text-gray-900 dark:text-base-content focus:outline-none"
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
                                        <span>Probing...</span>
                                    </>
                                ) : (
                                    <>
                                        <Play size={14} />
                                        <span>Test Connection</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Probe Result Box (4-State Display) */}
                {probeState === 'probing' && (
                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-base-300/40 border border-gray-200 dark:border-base-300 flex items-center justify-center gap-3 py-8">
                        <RotateCcw size={18} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                            Sending probe request through {probeProtocol === 'openai' ? '/v1/chat/completions' : '/v1/messages'}...
                        </span>
                    </div>
                )}

                {probeState === 'success' && (
                    <div className="p-4 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-emerald-500" />
                                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                    Probe Succeeded &bull; 200 OK
                                </span>
                            </div>

                            <div className="flex items-center gap-3 font-mono text-xs">
                                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                    Latency: {probeLatency}ms
                                </span>
                                <span className="text-gray-400">&bull;</span>
                                <span className="text-gray-500 dark:text-gray-400">
                                    Model: {probeModel}
                                </span>
                            </div>
                        </div>

                        <div className="relative group bg-gray-50 dark:bg-base-100 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                            <pre className="text-xs font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                                {probeResponse}
                            </pre>
                            <button
                                onClick={handleCopyResponse}
                                className="absolute top-2 right-2 p-1.5 rounded-lg bg-gray-100 dark:bg-base-200 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-base-300 transition-colors"
                                title="Copy Response"
                            >
                                {copiedResponse ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                            </button>
                        </div>
                    </div>
                )}

                {probeState === 'error' && (
                    <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-900/40 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <XCircle size={16} className="text-rose-500" />
                                <span className="text-xs font-bold text-rose-800 dark:text-rose-300">
                                    Probe Failed
                                </span>
                            </div>
                            {probeLatency !== null && (
                                <span className="font-mono text-xs text-rose-600 dark:text-rose-400">
                                    {probeLatency}ms
                                </span>
                            )}
                        </div>
                        <p className="text-xs font-mono text-rose-700 dark:text-rose-300 bg-white/70 dark:bg-base-100/60 p-2.5 rounded-lg border border-rose-200/50 dark:border-rose-900/30">
                            {probeError}
                        </p>
                    </div>
                )}
            </div>

            {/* Embedded Live Proxy Monitor (Real-Time Request Traffic) */}
            <div className="bg-white dark:bg-base-200/60 rounded-2xl border border-gray-100 dark:border-base-300 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 dark:border-base-300 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Terminal size={16} style={{ color: 'var(--color-accent)' }} />
                        <h4 className="text-xs font-bold text-gray-900 dark:text-base-content uppercase tracking-wider">
                            Live Gateway Traffic &amp; Request Logs
                        </h4>
                    </div>
                    <span className="text-[11px] font-mono text-gray-400">
                        SSE Real-Time Stream
                    </span>
                </div>

                <div className="p-2">
                    <ProxyMonitor className="min-h-[380px]" />
                </div>
            </div>
        </div>
    );
};
