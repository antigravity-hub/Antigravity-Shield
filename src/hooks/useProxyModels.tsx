import { useMemo, useEffect, useState } from 'react';
import { MODEL_CONFIG } from '../config/modelConfig';
import { useAccountStore } from '../stores/useAccountStore';
import { Bot, Sparkles } from 'lucide-react';
import { request } from '../utils/request';

export interface CanonicalFamilyDto {
    canonical_id: string;
    display_name: string;
    match_ids: string[];
}

const ALIAS_TO_CANONICAL: Record<string, { id: string; name: string; group: string }> = {
    // Gemini 3
    'gemini-3.7-flash': { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', group: 'Gemini 3' },
    'gemini-3.7-flash-high': { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', group: 'Gemini 3' },
    'gemini-3.7-flash-medium': { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', group: 'Gemini 3' },
    'gemini-3.7-flash-low': { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', group: 'Gemini 3' },
    'gemini-3.7-flash-tiered': { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', group: 'Gemini 3' },
    'gemini-3.6-flash': { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', group: 'Gemini 3' },
    'gemini-3.6-flash-high': { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', group: 'Gemini 3' },
    'gemini-3.6-flash-medium': { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', group: 'Gemini 3' },
    'gemini-3.6-flash-low': { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', group: 'Gemini 3' },
    'gemini-3.6-flash-tiered': { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', group: 'Gemini 3' },
    'gemini-3.5-flash': { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', group: 'Gemini 3' },
    'gemini-3.5-flash-high': { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', group: 'Gemini 3' },
    'gemini-3.5-flash-medium': { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', group: 'Gemini 3' },
    'gemini-3.5-flash-low': { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', group: 'Gemini 3' },
    'gemini-3.5-flash-extra-low': { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', group: 'Gemini 3' },
    'gemini-3-flash-agent': { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', group: 'Gemini 3' },
    'gemini-3-flash': { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', group: 'Gemini 3' },
    'gemini-3.1-pro': { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', group: 'Gemini 3' },
    'gemini-3.1-pro-high': { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', group: 'Gemini 3' },
    'gemini-3.1-pro-low': { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', group: 'Gemini 3' },
    'gemini-3.1-pro-preview': { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', group: 'Gemini 3' },
    'gemini-3-pro-high': { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', group: 'Gemini 3' },
    'gemini-3-pro-low': { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', group: 'Gemini 3' },
    'gemini-3-pro': { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', group: 'Gemini 3' },
    'gemini-pro-agent': { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', group: 'Gemini 3' },
    'gemini-pro': { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', group: 'Gemini 3' },
    'gemini-3.1-flash-lite': { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', group: 'Gemini 3' },
    'gemini-flash-lite': { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', group: 'Gemini 3' },
    'gemini-3.1-flash-image': { id: 'gemini-3.1-flash-image', name: 'Gemini 3.1 Flash Image', group: 'Gemini 3' },
    'gemini-3-pro-image': { id: 'gemini-3.1-flash-image', name: 'Gemini 3.1 Flash Image', group: 'Gemini 3' },

    // Gemini 2.5
    'gemini-2.5-pro': { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', group: 'Gemini 2.5' },
    'gemini-2.5-flash': { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', group: 'Gemini 2.5' },
    'gemini-2.5-flash-lite': { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', group: 'Gemini 2.5' },
    'gemini-2.0-flash-lite': { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', group: 'Gemini 2.5' },
    'gemini-2.5-flash-thinking': { id: 'gemini-2.5-flash-thinking', name: 'Gemini 2.5 Flash (Thinking)', group: 'Gemini 2.5' },

    // Claude
    'claude-sonnet-4-6': { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', group: 'Claude' },
    'claude-sonnet-4-6-thinking': { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', group: 'Claude' },
    'claude-opus-4-6': { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', group: 'Claude' },
    'claude-opus-4-6-thinking': { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', group: 'Claude' },
    'claude-opus-4-6-20260201': { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', group: 'Claude' },
    'claude-opus-4.6': { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', group: 'Claude' },
    'claude-opus-4.6-thinking': { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', group: 'Claude' },
    'claude-sonnet-4-5': { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', group: 'Claude' },
    'claude-sonnet-4-5-thinking': { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', group: 'Claude' },
    'claude-sonnet-4-5-20250929': { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', group: 'Claude' },
    'claude-opus-4-5-thinking': { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', group: 'Claude' },
    'claude-opus-4-5-20251101': { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', group: 'Claude' },
    'claude-haiku-4-5': { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', group: 'Claude' },
    'claude-haiku-4-5-20251001': { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', group: 'Claude' },
};

export const useProxyModels = () => {
    const { accounts, fetchAccounts } = useAccountStore();
    const [canonicalFamilies, setCanonicalFamilies] = useState<CanonicalFamilyDto[]>([]);

    useEffect(() => {
        if (accounts.length === 0) {
            fetchAccounts();
        }

        let cancelled = false;
        request<CanonicalFamilyDto[]>('get_canonical_families')
            .then(data => {
                if (!cancelled && data) {
                    setCanonicalFamilies(data);
                }
            })
            .catch(err => console.error('Failed to fetch canonical families:', err));

        return () => { cancelled = true; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const models = useMemo(() => {
        const uniqueModelsMap = new Map<string, { id: string; name: string; group: string; icon: React.ReactNode }>();

        // 1. Process dynamic models reported by accounts
        for (const account of accounts) {
            for (const m of account.quota?.models ?? []) {
                const rawKey = m.name.toLowerCase();
                
                // Map sub-tier and legacy aliases to the primary canonical model
                const mapped = ALIAS_TO_CANONICAL[rawKey];
                const canonicalId = mapped ? mapped.id : (m.name || rawKey);
                const canonicalName = mapped ? mapped.name : (m.display_name || m.name);
                
                let group = mapped ? mapped.group : 'Dynamic';
                if (!mapped) {
                    if (canonicalName.toLowerCase().startsWith('gemini 3')) group = 'Gemini 3';
                    else if (canonicalName.toLowerCase().startsWith('gemini 2.5') || canonicalName.toLowerCase().startsWith('gemini 2')) group = 'Gemini 2.5';
                    else if (canonicalName.toLowerCase().includes('claude') || canonicalName.toLowerCase().includes('sonnet') || canonicalName.toLowerCase().includes('opus')) group = 'Claude';
                }

                const cfgEntry = Object.entries(MODEL_CONFIG).find(
                    ([cfgId, cfg]) => cfgId.toLowerCase() === canonicalId.toLowerCase() || cfg.protectedKey?.toLowerCase() === canonicalId.toLowerCase()
                );
                const CfgIcon = cfgEntry?.[1].Icon;
                const icon = CfgIcon ? <CfgIcon size={16} /> : (group === 'Claude' ? <Sparkles size={16} className="text-purple-400" /> : <Bot size={16} className="text-blue-400" />);

                if (!uniqueModelsMap.has(canonicalId)) {
                    uniqueModelsMap.set(canonicalId, {
                        id: canonicalId,
                        name: canonicalName,
                        group,
                        icon,
                    });
                }
            }
        }

        // 2. Supplement with built-in core models from MODEL_CONFIG
        for (const [id, config] of Object.entries(MODEL_CONFIG)) {
            const rawKey = id.toLowerCase();
            const mapped = ALIAS_TO_CANONICAL[rawKey];
            const canonicalId = mapped ? mapped.id : id;
            const canonicalName = mapped ? mapped.name : config.label;
            const group = mapped ? mapped.group : (config.group || 'Other');

            // Skip legacy marketing adjective labels
            if (['Melhor Raciocínio', 'Visualização Flash', 'Geração de Imagem (1:1)', 'Alto Desempenho', '最高推理', '快速响应'].includes(canonicalName)) {
                continue;
            }

            if (!uniqueModelsMap.has(canonicalId)) {
                uniqueModelsMap.set(canonicalId, {
                    id: canonicalId,
                    name: canonicalName,
                    group,
                    icon: <config.Icon size={16} />,
                });
            }
        }

        // 3. Order groups and models cleanly
        const groupOrder = ['Gemini 3', 'Gemini 2.5', 'Claude', 'Dynamic', 'Other'];
        
        return Array.from(uniqueModelsMap.values())
            .map(m => ({
                id: m.id,
                name: m.name,
                desc: m.name,
                group: m.group,
                icon: m.icon,
            }))
            .sort((a, b) => {
                const orderA = groupOrder.indexOf(a.group) !== -1 ? groupOrder.indexOf(a.group) : 99;
                const orderB = groupOrder.indexOf(b.group) !== -1 ? groupOrder.indexOf(b.group) : 99;
                if (orderA !== orderB) return orderA - orderB;
                return a.name.localeCompare(b.name);
            });
    }, [accounts, canonicalFamilies]);

    return { models, canonicalFamilies };
};
