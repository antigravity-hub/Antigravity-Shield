/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Repository: https://github.com/antigravity-hub/Antigravity-Shield
 */
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Download,
  Trash2,
  CheckCircle2,
  Check,
  Copy,
  Plus,
  Eye,
  Code2,
  Sliders,
  X,
  FileCode,
  Palette,
  Server,
  Database,
  Gauge,
  Send,
  Boxes,
  Flame,
  Star,
  ShieldCheck,
  Calendar,
  GitBranch,
  BadgeCheck,
  Bot,
  RefreshCw,
  Smartphone,
  TestTube,
  TrendingUp,
  Globe,
  Terminal,
} from 'lucide-react';
import { useEcosystemStore } from '../../stores/useEcosystemStore';
import {
  SkillItem,
  SkillCategory,
} from '../../types/ecosystem';
import { RichSkillDocViewer } from './RichSkillDocViewer';
import {
  isSkillUpstreamLive,
  parsePrerequisitesFromMarkdown,
} from '../../services/skillManifestResolver';
import {
  SKILLS_SH_CATALOG,
} from '../../config/skillsCatalog';
import { AgentPlatformDropdown } from './AgentPlatformDropdown';
import { SecurityAuditDropdown } from './SecurityAuditDropdown';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  all: Sliders,
  coding: Code2,
  data: Database,
  devops: Gauge,
  design: Palette,
  automation: Send,
  architecture: Server,
  marketing: TrendingUp,
  mobile: Smartphone,
  testing: TestTube,
  science: Boxes,
};

const CATEGORY_METADATA: Record<SkillCategory, { en: string; fa: string }> = {
  all: { en: 'All', fa: 'همه' },
  coding: { en: 'Coding', fa: 'کدنویسی' },
  data: { en: 'Data & DB', fa: 'داده و پایگاه‌داده' },
  devops: { en: 'DevOps', fa: 'دوآپس' },
  design: { en: 'Design & UI', fa: 'طراحی و UI' },
  automation: { en: 'Automation', fa: 'اتوماسیون' },
  architecture: { en: 'Architecture', fa: 'معماری سیستم' },
  marketing: { en: 'Marketing', fa: 'مارکتینگ' },
  mobile: { en: 'Mobile', fa: 'موبایل' },
  testing: { en: 'Testing', fa: 'تست و QA' },
  science: { en: 'Science', fa: 'علوم و پژوهش' },
};

const SKILL_ICONS: Record<string, React.ElementType> = {
  Palette,
  Sparkles,
  Server,
  Database,
  Gauge,
  Flame,
  Send,
  Boxes,
};

function parseInstalls(val?: number | string): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const s = String(val).trim().toUpperCase();
  if (s.endsWith('M')) return (parseFloat(s) || 0) * 1_000_000;
  if (s.endsWith('K')) return (parseFloat(s) || 0) * 1_000;
  const parsed = parseFloat(s.replace(/,/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

export const SkillsTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const {
    skills,
    searchQuery,
    selectedCategory,
    setSelectedCategory,
    skillSource,
    setSkillSource,
    selectedAgent,
    setSelectedAgent,
    verifiedOnly,
    setVerifiedOnly,
    auditFilter,
    selectedAuditFilters,
    setSelectedAuditFilters,
    isSyncingTelemetry,
    lastTelemetrySyncAt,
    syncTelemetry,
    reorderRequired,
    applyReorder,
    installSkill,
    uninstallSkill,
    toggleSkill,
    installingId,
    installErrors,
  } = useEcosystemStore();

  // Self-healing: if skills list is empty on mount, trigger loadAll
  React.useEffect(() => {
    if (skills.length === 0) {
      useEcosystemStore.getState().loadAll();
    }
  }, [skills.length]);

  const [activeFirst, setActiveFirst] = useState(false);
  const [inspectingSkill, setInspectingSkill] = useState<SkillItem | null>(null);
  const [inspectingContent, setInspectingContent] = useState<string>('');
  const [copiedTrigger, setCopiedTrigger] = useState<string | null>(null);

  const handleCopyTrigger = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedTrigger(cmd);
    setTimeout(() => {
      setCopiedTrigger((prev) => (prev === cmd ? null : prev));
    }, 1500);
  };

  const getSanitizedTriggers = (triggers?: string[]): string[] => {
    if (!triggers || triggers.length === 0) return [];
    const result: string[] = [];
    const seen = new Set<string>();

    for (const raw of triggers) {
      const clean = raw.trim().replace(/^\/+/, '');
      if (!clean) continue;
      const slug = clean.toLowerCase().replace(/\s+/g, '-');
      if (!seen.has(slug)) {
        seen.add(slug);
        result.push(slug);
      }
    }

    return result;
  };

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSkill, setNewSkill] = useState<{
    id: string;
    title: string;
    description: string;
    category: SkillCategory;
    triggers: string;
    content: string;
  }>({
    id: '',
    title: '',
    description: '',
    category: 'coding',
    triggers: '',
    content: '# SKILL.md\nTeach the agent specialized instructions...',
  });

  const categories: SkillCategory[] = [
    'all',
    'coding',
    'data',
    'devops',
    'design',
    'automation',
    'architecture',
    'marketing',
    'mobile',
    'testing',
    'science',
  ];

  // Count metrics for category pills
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = { all: skills.length };
    for (const s of skills) {
      map[s.category] = (map[s.category] || 0) + 1;
    }
    return map;
  }, [skills]);

  // Count metrics for source tabs
  const localCount = skills.filter((s) => s.isLocal || s.isInstalled).length;
  const onlineCount = skills.filter((s) => s.sourceType === 'skills.sh' || !s.isLocal).length;

  const filteredSkills = skills.filter((item) => {
    // 1. Source filter
    if (skillSource === 'local' && !item.isLocal && !item.isInstalled) {
      return false;
    }
    if (skillSource === 'skills_sh' && (item.isLocal && !item.isOfficial && item.sourceType !== 'skills.sh')) {
      return false;
    }

    // 2. Category filter
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;

    // 3. Search query
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      q === '' ||
      item.title.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      (item.author && item.author.toLowerCase().includes(q)) ||
      (item.repo && item.repo.toLowerCase().includes(q)) ||
      (item.tags && item.tags.some((tag) => tag.toLowerCase().includes(q))) ||
      (item.triggers && item.triggers.some((tr) => tr.toLowerCase().includes(q) || tr.toLowerCase().replace(/^\//, '').includes(q)));

    if (!matchesCategory || !matchesQuery) return false;

    // 4. Verified Only Filter (Strict Official Technology Maker checkmark matching skills.sh)
    if (verifiedOnly) {
      const isVerified = Boolean(item.isVerifiedMaker) || Boolean(item.isOfficial);
      if (!isVerified) return false;
    }

    // 5. Security Audits Multi-select Filter (Item 1: Gen Agent Trust Hub, Socket, Snyk)
    if (selectedAuditFilters.length > 0) {
      const audits = item.audits || [];
      const matchesAnyAudit = selectedAuditFilters.some((filterKey) => {
        if (filterKey === 'passed_only') {
          return audits.length > 0 && audits.every((a) => a.status === 'pass');
        }
        if (filterKey === 'gen_trust_hub_pass') {
          return audits.some((a) => a.provider.toLowerCase().includes('gen') && a.status === 'pass');
        }
        if (filterKey === 'socket_pass') {
          return audits.some((a) => a.provider.toLowerCase().includes('socket') && a.status === 'pass');
        }
        if (filterKey === 'snyk_pass') {
          return audits.some((a) => a.provider.toLowerCase().includes('snyk') && a.status === 'pass');
        }
        if (filterKey === 'snyk_warn') {
          return audits.some((a) => a.provider.toLowerCase().includes('snyk') && a.status === 'warn');
        }
        return false;
      });
      if (!matchesAnyAudit) return false;
    } else if (auditFilter !== 'all') {
      const audits = item.audits || [];
      if (auditFilter === 'passed_only') {
        if (audits.length === 0 || audits.some((a) => a.status !== 'pass')) return false;
      } else if (auditFilter === 'gen_trust_hub_pass') {
        const hasPass = audits.some((a) => a.provider.toLowerCase().includes('gen') && a.status === 'pass');
        if (!hasPass) return false;
      } else if (auditFilter === 'socket_pass') {
        const hasPass = audits.some((a) => a.provider.toLowerCase().includes('socket') && a.status === 'pass');
        if (!hasPass) return false;
      } else if (auditFilter === 'snyk_pass') {
        const hasPass = audits.some((a) => a.provider.toLowerCase().includes('snyk') && a.status === 'pass');
        if (!hasPass) return false;
      } else if (auditFilter === 'snyk_warn') {
        const hasWarn = audits.some((a) => a.provider.toLowerCase().includes('snyk') && a.status === 'warn');
        if (!hasWarn) return false;
      }
    }

    // 6. AI Agent Platform Compatibility Filter (Item 2: 20 agents supported by SKILL.md)
    if (selectedAgent !== 'all') {
      // In Antigravity & Gemini, 100% of SKILL.md skills run natively
      if (selectedAgent !== 'antigravity' && selectedAgent !== 'gemini') {
        const agentKey = selectedAgent.toLowerCase();
        const hasExplicit = item.supportedAgents && item.supportedAgents.some((ag) => ag.toLowerCase() === agentKey);
        const inTags = item.tags && item.tags.some((tg) => tg.toLowerCase().includes(agentKey));
        if (item.supportedAgents && item.supportedAgents.length > 0 && !hasExplicit && !inTags) {
          return false;
        }
      }
    }

    return true;
  });

  const sortedSkills = useMemo(() => {
    return [...filteredSkills].sort((a, b) => {
      if (activeFirst) {
        const aActive = a.isEnabled ? 1 : 0;
        const bActive = b.isEnabled ? 1 : 0;
        if (aActive !== bActive) {
          return bActive - aActive; // Active skills first
        }
      }
      // Default: sort by installs count (downloads score) descending
      const aInstalls = parseInstalls(a.installs);
      const bInstalls = parseInstalls(b.installs);
      if (bInstalls !== aInstalls) {
        return bInstalls - aInstalls;
      }
      const aStars = parseInstalls(a.stars);
      const bStars = parseInstalls(b.stars);
      if (bStars !== aStars) {
        return bStars - aStars;
      }
      return a.title.localeCompare(b.title);
    });
  }, [filteredSkills, activeFirst]);

  // Progressive Windowing / Infinite Scroll for 1,000+ Skills (Instant initial render, 0ms tab latency)
  const [visibleCount, setVisibleCount] = useState<number>(36);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  // Reset window whenever user changes filter criteria
  React.useEffect(() => {
    setVisibleCount(36);
  }, [
    searchQuery,
    selectedCategory,
    skillSource,
    selectedAgent,
    verifiedOnly,
    auditFilter,
    activeFirst,
  ]);

  // Dynamically load next slice when sentinel enters viewport
  React.useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => {
            if (prev < sortedSkills.length) {
              return Math.min(prev + 36, sortedSkills.length);
            }
            return prev;
          });
        }
      },
      {
        rootMargin: '400px', // Pre-fetch 400px before user reaches bottom
        threshold: 0.05,
      }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [sortedSkills.length]);

  const visibleSkills = useMemo(() => {
    return sortedSkills.slice(0, visibleCount);
  }, [sortedSkills, visibleCount]);

  // Global download rank lookup: ranks all catalog and system skills by installs descending
  const downloadRankMap = useMemo(() => {
    const seen = new Set<string>();
    const rankedList: SkillItem[] = [];

    // Combine all currently loaded skills and official catalog to ensure 100% stable global ranks
    [...skills, ...SKILLS_SH_CATALOG].forEach((s) => {
      const key = s.id || s.slug || s.name;
      if (!seen.has(key) && parseInstalls(s.installs) > 0) {
        seen.add(key);
        rankedList.push(s);
      }
    });

    rankedList.sort((a, b) => {
      const diff = parseInstalls(b.installs) - parseInstalls(a.installs);
      if (diff !== 0) return diff;
      const bStars = parseInstalls(b.stars);
      const aStars = parseInstalls(a.stars);
      if (bStars !== aStars) return bStars - aStars;
      return a.title.localeCompare(b.title);
    });

    const map = new Map<string, number>();
    rankedList.forEach((s, idx) => {
      const rank = idx + 1;
      if (s.id) map.set(s.id, rank);
      if (s.slug) map.set(s.slug, rank);
      if (s.name) map.set(s.name, rank);
    });
    return map;
  }, [skills]);

  // Distinct multi-stop gradient styling with tactile inner shadows for download ranks (Top 10, 11-99, 100+)
  const getRankBadgeClasses = (rank: number) => {
    if (rank <= 10) {
      // Top 10 Tier: Fiery Amber-Orange-Rose Gradient with glass bevel highlight and deep inner shadow
      return 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 text-white border-y border-l border-amber-300/60 shadow-[inset_0_2px_3px_rgba(255,255,255,0.45),inset_0_-2.5px_5px_rgba(136,19,55,0.6),0_4px_12px_rgba(244,63,94,0.35)]';
    }
    if (rank <= 99) {
      // Rank 11-99 Tier: Electric Violet-Purple-Indigo Gradient with tactile inner shadow
      return 'bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-700 text-white border-y border-l border-purple-300/50 shadow-[inset_0_2px_3px_rgba(255,255,255,0.4),inset_0_-2.5px_5px_rgba(46,16,101,0.6),0_4px_12px_rgba(147,51,234,0.3)]';
    }
    // Rank 100+ Tier: Modern Cyber Cyan-Teal-Blue Gradient with tactile inner shadow
    return 'bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-700 text-white border-y border-l border-cyan-300/40 shadow-[inset_0_2px_3px_rgba(255,255,255,0.35),inset_0_-2.5px_5px_rgba(8,47,73,0.6),0_4px_12px_rgba(6,182,212,0.25)]';
  };

  // 3D folded triangular shadow that connects the protruding ribbon back behind the card edge
  const getRankFoldShadowClasses = (rank: number) => {
    if (rank <= 10) {
      return 'border-t-rose-950/80 dark:border-t-rose-950';
    }
    if (rank <= 99) {
      return 'border-t-indigo-950/80 dark:border-t-purple-950';
    }
    return 'border-t-blue-950/80 dark:border-t-sky-950';
  };


  const handleOpenInspector = async (skill: SkillItem) => {
    setInspectingSkill(skill);
    if (skill.content) {
      setInspectingContent(skill.content);
    } else {
      try {
        const { readSkillContent } = await import('../../services/ecosystemService');
        const content = await readSkillContent(skill.id, skill.isLocal);
        setInspectingContent(content || skill.description);
      } catch {
        setInspectingContent(skill.description);
      }
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkill.id || !newSkill.title) return;

    const payload: SkillItem = {
      id: newSkill.id.toLowerCase().replace(/\s+/g, '-'),
      name: newSkill.id.toLowerCase().replace(/\s+/g, '-'),
      title: newSkill.title,
      description: newSkill.description,
      category: newSkill.category,
      author: 'User Custom',
      version: '1.0.0',
      icon: 'Code2',
      triggers: newSkill.triggers.split(',').map((s) => s.trim()).filter(Boolean),
      scope: 'global',
      isInstalled: true,
      isEnabled: true,
      content: newSkill.content,
      tags: ['Custom', newSkill.category],
    };

    await installSkill(payload);
    setIsCreateOpen(false);
    setNewSkill({
      id: '',
      title: '',
      description: '',
      category: 'coding',
      triggers: '',
      content: '# SKILL.md\n',
    });
  };

  return (
    <div className="space-y-6">
      {/* Tri-Source Switcher (All / Local Skills / Skills.sh Catalog) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="relative flex items-center gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-900/80 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 backdrop-blur-xl shadow-inner">
          <button
            onClick={() => setSkillSource('all')}
            className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold select-none transition-colors ${
              skillSource === 'all'
                ? 'text-[var(--color-accent-secondary)] dark:text-[var(--color-accent)] font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {skillSource === 'all' && (
              <motion.div
                layoutId="activeSkillSourcePill"
                transition={{ type: 'spring', damping: 28, stiffness: 350, mass: 0.8 }}
                className="absolute inset-0 bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-slate-200/60 dark:border-slate-700/60"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <span>{t('ecosystem.source.all', 'All Skills')}</span>
              <span
                className="text-[10px] px-1.5 py-0.2 rounded-full font-mono transition-colors"
                style={
                  skillSource === 'all'
                    ? { backgroundColor: 'var(--color-badge-bg)', color: 'var(--color-accent)' }
                    : undefined
                }
              >
                {skills.length}
              </span>
            </span>
          </button>

          <button
            onClick={() => setSkillSource('local')}
            className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold select-none transition-colors ${
              skillSource === 'local'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {skillSource === 'local' && (
              <motion.div
                layoutId="activeSkillSourcePill"
                transition={{ type: 'spring', damping: 28, stiffness: 350, mass: 0.8 }}
                className="absolute inset-0 bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-emerald-500/20"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>{t('ecosystem.source.local', 'My Local Skills')}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">
                {localCount}
              </span>
            </span>
          </button>

          <button
            onClick={() => setSkillSource('skills_sh')}
            className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold select-none transition-colors ${
              skillSource === 'skills_sh'
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {skillSource === 'skills_sh' && (
              <motion.div
                layoutId="activeSkillSourcePill"
                transition={{ type: 'spring', damping: 28, stiffness: 350, mass: 0.8 }}
                className="absolute inset-0 bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-purple-500/20"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              <span>{t('ecosystem.source.skills_sh', 'Marketplace')}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono">
                {onlineCount}
              </span>
            </span>
          </button>
        </div>

        {/* Zero-Leak Security Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-medium self-start sm:self-auto">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{t('ecosystem.zero_leak_banner', 'Zero-Leak Shield: Local skills & keys are 100% isolated')}</span>
        </div>
      </div>

      {/* Category Filter Pills & Create Action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100/80 dark:bg-slate-900/80 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 backdrop-blur-md">
          {categories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat] || Sliders;
            const isSelected = selectedCategory === cat;
            const isFa = i18n.language?.startsWith('fa');
            const meta = CATEGORY_METADATA[cat] || { en: cat, fa: cat };
            const label = isFa ? meta.fa : meta.en;
            const count = categoryCounts[cat] ?? 0;

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors select-none whitespace-nowrap ${
                  isSelected
                    ? 'text-[var(--color-accent-secondary)] dark:text-[var(--color-accent)] font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {isSelected && (
                  <motion.div
                    layoutId="activeCategoryPill"
                    transition={{ type: 'spring', damping: 28, stiffness: 350, mass: 0.8 }}
                    className="absolute inset-0 bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-slate-200/60 dark:border-slate-700/60"
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{label}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full transition-colors ${
                      !isSelected ? 'bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400' : ''
                    }`}
                    style={
                      isSelected
                        ? { backgroundColor: 'var(--color-badge-bg)', color: 'var(--color-accent)' }
                        : undefined
                    }
                  >
                    {count}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5">
          {/* Active First Toggle */}
          <button
            type="button"
            onClick={() => setActiveFirst(!activeFirst)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
              activeFirst
                ? 'text-[var(--color-accent-secondary)] dark:text-[var(--color-accent)] font-semibold shadow-xs'
                : 'bg-slate-100/80 dark:bg-slate-900/80 border-slate-200/60 dark:border-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            style={
              activeFirst
                ? { backgroundColor: 'var(--color-badge-bg)', borderColor: 'var(--color-badge-border)' }
                : undefined
            }
            title={t('ecosystem.skills.sort_skills_to_show_active_ena', "Sort skills to show active/enabled ones first")}
          >
            <div
              className="w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors"
              style={
                activeFirst
                  ? { backgroundColor: 'var(--color-accent)', borderColor: 'var(--color-accent)', color: '#ffffff' }
                  : { borderColor: 'rgb(148 163 184)' }
              }
            >
              {activeFirst && <Check className="w-2.5 h-2.5" />}
            </div>
            <span>{t('ecosystem.active_first', 'Active First')}</span>
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-white font-medium text-xs shadow-md active:scale-95 transition-all"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary-btn), var(--color-accent))',
              boxShadow: '0 4px 12px var(--color-accent-glow)',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('ecosystem.skills.create', 'Create Skill')}</span>
          </button>
        </div>
      </div>

      {/* Advanced Secondary Controls: AI Agents Dropdown, Security Audits & Verified Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-slate-50/70 dark:bg-slate-900/50 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* 1. AI Agent Compatibility Dropdown with Logos */}
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              <Bot className="w-3.5 h-3.5" style={{ color: 'var(--color-accent)' }} />
              <span>{t('ecosystem.agent_filter_label', 'Agent')}:</span>
            </span>
            <AgentPlatformDropdown
              value={selectedAgent}
              onChange={setSelectedAgent}
            />
          </div>

          {/* 2. Security Audits Filter Dropdown with Checkboxes */}
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>{t('ecosystem.audit_filter_label', 'Security')}:</span>
            </span>
            <SecurityAuditDropdown
              selectedAudits={selectedAuditFilters}
              onChange={setSelectedAuditFilters}
            />
          </div>
        </div>

        {/* 4. Verified Only Toggle (Item 4: Rosette checkmark) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setVerifiedOnly(!verifiedOnly)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-semibold transition-all ${
              !verifiedOnly
                ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                : 'text-[var(--color-accent-secondary)] dark:text-[var(--color-accent)] shadow-xs'
            }`}
            style={
              verifiedOnly
                ? {
                    backgroundColor: 'var(--color-badge-bg)',
                    borderColor: 'var(--color-badge-border)',
                    boxShadow: '0 0 10px var(--color-accent-glow)',
                  }
                : undefined
            }
            title={t('ecosystem.skills.show_only_skills_from_verified', "Show only skills from verified official publishers with clean security audits")}
          >
            <BadgeCheck
              className={`w-3.5 h-3.5 ${verifiedOnly ? 'animate-pulse' : 'text-slate-400'}`}
              style={
                verifiedOnly
                  ? { color: 'var(--color-accent)', fill: 'var(--color-badge-bg)' }
                  : undefined
              }
            />
            <span>{t('ecosystem.verified_only', 'Verified Only')}</span>
            {verifiedOnly && (
              <span
                className="text-[10px] px-1 py-0.2 rounded-full font-mono"
                style={{ backgroundColor: 'var(--color-badge-bg)', color: 'var(--color-accent)' }}
              >
                {t('ecosystem.skills.active', "Active")}
              </span>
            )}
          </button>

          {/* 5. Live Telemetry Sync Button (Single-Batch Hub CDN with Progressive Streaming Hydration) */}
          <button
            type="button"
            onClick={() => syncTelemetry()}
            disabled={isSyncingTelemetry}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-semibold transition-all ${
              isSyncingTelemetry
                ? 'bg-purple-500/15 border-purple-500/40 text-purple-600 dark:text-purple-400 cursor-wait'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-purple-500/30'
            }`}
            title={
              lastTelemetrySyncAt
                ? `Last synced: ${new Date(lastTelemetrySyncAt).toLocaleTimeString()}`
                : t('ecosystem.skills.sync_latest_install_counts_and', "Sync latest install counts and leaderboard from Hub CDN")
            }
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingTelemetry ? 'animate-spin text-purple-500' : 'text-slate-400'}`} />
            <span>{isSyncingTelemetry ? t('ecosystem.syncing', 'Syncing...') : t('ecosystem.sync_telemetry', 'Sync Live')}</span>
          </button>
        </div>
      </div>

      {/* Anti-Layout-Thrashing Alert Banner */}
      {reorderRequired && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-500/10 border border-purple-500/25 text-xs text-purple-700 dark:text-purple-300 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500 shrink-0 animate-pulse" />
            <span>{t('ecosystem.reorder_prompt', 'Latest download numbers & ranks have been synchronized via Hub CDN.')}</span>
          </div>
          <button
            onClick={() => applyReorder()}
            className="px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-xs active:scale-95 transition-all"
          >
            {t('ecosystem.apply_reorder', 'Reorder Leaderboard')}
          </button>
        </div>
      )}

      {/* Skills Grid - Instant Progressive Virtualized Batching */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visibleSkills.map((skill) => {
          const IconComponent = SKILL_ICONS[skill.icon || 'Sparkles'] || Sparkles;
          const isBusy = installingId === skill.id;
          const installError = installErrors[skill.id] || (skill.slug ? installErrors[skill.slug] : undefined);
          const rank = downloadRankMap.get(skill.id) ?? (skill.slug ? downloadRankMap.get(skill.slug) : undefined) ?? (skill.name ? downloadRankMap.get(skill.name) : undefined);
          const isVerified = Boolean(skill.isVerifiedMaker) || Boolean(skill.isOfficial);

          return (
            <motion.div
              key={skill.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{
                type: 'spring',
                damping: 26,
                stiffness: 320,
                mass: 0.7,
              }}
              whileHover={{ y: -3, transition: { type: 'spring', damping: 22, stiffness: 380 } }}
              whileTap={{ scale: 0.985 }}
              className="group relative flex flex-col justify-between p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/75 dark:bg-slate-900/65 backdrop-blur-xl shadow-xs hover:shadow-lg hover:border-[var(--color-accent)] transition-all duration-200"
            >
              {/* 3D Protruding Rank Ribbon folded over the side edge */}
              {rank !== undefined && (
                <div className="absolute -right-2.5 top-3 z-10 select-none pointer-events-none">
                  <div className="relative pointer-events-auto">
                    {/* Ribbon Main Body */}
                    <div
                      title={t('ecosystem.skills.download_rank', { rank, defaultValue: 'Download Rank: #{{rank}}' })}
                      className={`relative z-10 flex items-center gap-1.5 px-3.5 py-1 text-xs font-mono font-black tracking-tight rounded-l-xl transition-all duration-200 group-hover:scale-105 group-hover:-translate-x-0.5 ${getRankBadgeClasses(rank)}`}
                    >
                      {rank <= 10 && (
                        <Flame className="w-4 h-4 fill-current shrink-0 animate-pulse drop-shadow-xs" />
                      )}
                      <span className="text-[13px] font-black drop-shadow-xs">#{rank}</span>
                    </div>

                    {/* 3D Folded Triangle tucked behind the card edge */}
                    <div
                      className={`absolute -bottom-2 right-0 w-0 h-0 border-t-[8px] border-r-[10px] border-r-transparent ${getRankFoldShadowClasses(rank)}`}
                    />
                  </div>
                </div>
              )}

              <div>
                {/* Header */}
                <div className={`flex items-start justify-between gap-3 mb-3 ${rank !== undefined ? 'pr-20' : ''}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: 'var(--color-badge-bg)',
                        color: 'var(--color-accent)',
                        borderColor: 'var(--color-badge-border)',
                      }}
                    >
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {skill.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>v{skill.version}</span>
                        <span>•</span>
                        <span className="truncate">{skill.author}</span>
                      </div>
                    </div>
                  </div>

                  {/* Active Status Pill */}
                  {skill.isInstalled && (
                    <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                      skill.isEnabled
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}>
                      <CheckCircle2 className={`w-3 h-3 ${skill.isEnabled ? 'text-emerald-500' : 'text-slate-400'}`} />
                      <span>{skill.isEnabled ? t('ecosystem.status.active', 'Active') : t('ecosystem.status.inactive', 'Inactive')}</span>
                    </span>
                  )}
                </div>

                {/* Telemetry Chips (Installs with Geist Verified Rosette Checkmark, Stars, Official) */}
                {(skill.installs || skill.stars || skill.isOfficial || isVerified) && (
                  <div className="flex items-center gap-2 mb-2.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {skill.installs && (
                      <span className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md text-slate-700 dark:text-slate-300">
                        {isVerified && (
                          <span title={t('ecosystem.skills.official_technology_maker_skil', "Official Technology Maker (skills.sh verified)")} className="flex items-center" style={{ color: 'var(--color-accent)' }}>
                            <BadgeCheck className="w-3.5 h-3.5" style={{ fill: 'var(--color-badge-bg)', color: 'var(--color-accent)' }} />
                          </span>
                        )}
                        <Download className="w-3 h-3" style={{ color: 'var(--color-accent)' }} />
                        <span>{typeof skill.installs === 'number' ? `${(skill.installs / 1000).toFixed(0)}K` : skill.installs}</span>
                      </span>
                    )}
                    {skill.stars && (
                      <span className="flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-md text-amber-600 dark:text-amber-400">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        <span>{skill.stars}</span>
                      </span>
                    )}
                    {skill.isOfficial && (
                      <span
                        className="text-[10px] font-sans px-1.5 py-0.5 rounded-sm border"
                        style={{
                          backgroundColor: 'var(--color-badge-bg)',
                          color: 'var(--color-accent)',
                          borderColor: 'var(--color-badge-border)',
                        }}
                      >
                        {t('ecosystem.skills.official', "Official")}
                      </span>
                    )}
                    {isSkillUpstreamLive(skill) && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-sm border"
                        style={{
                          backgroundColor: 'var(--color-badge-bg)',
                          color: 'var(--color-accent)',
                          borderColor: 'var(--color-badge-border)',
                        }}
                        title={t('ecosystem.skills.live_verified_upstream_git_rep', "Live verified upstream Git repository")}
                      >
                        <Globe className="w-2.5 h-2.5" />
                        {t('ecosystem.skills.live', "Live")}
                      </span>
                    )}
                  </div>
                )}

                {/* Description */}
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mb-3 leading-relaxed">
                  {skill.description}
                </p>

                {/* Triggers Tags */}
                {(() => {
                  const sanitized = getSanitizedTriggers(skill.triggers);
                  if (sanitized.length === 0) return null;

                  return (
                    <div className="flex flex-wrap items-center gap-1.5 mb-3">
                      {sanitized.slice(0, 2).map((slug) => {
                        const fullCmd = `/${slug}`;
                        const isCopied = copiedTrigger === fullCmd;
                        return (
                          <button
                            key={slug}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyTrigger(fullCmd);
                            }}
                            title={t('ecosystem.click_to_copy', 'Click to copy command')}
                            className={`group inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono rounded-md transition-all active:scale-95 cursor-pointer select-none ${
                              isCopied
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-100 hover:bg-[var(--color-badge-bg)] dark:bg-slate-800/80 dark:hover:bg-[var(--color-badge-bg)] text-slate-600 hover:text-[var(--color-accent)] dark:text-slate-400 dark:hover:text-[var(--color-accent)] border border-slate-200/40 dark:border-slate-700/40 hover:border-[var(--color-badge-border)]'
                            }`}
                          >
                            {isCopied ? (
                              <Check className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                            ) : (
                              <Copy className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 transition-opacity text-slate-400 group-hover:text-[var(--color-accent)] shrink-0" />
                            )}
                            <span>{fullCmd}</span>
                          </button>
                        );
                      })}
                      {sanitized.length > 2 && (
                        <span className="text-[10px] text-slate-400 px-1 py-0.5 font-mono">
                          +{sanitized.length - 2}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Actions & Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenInspector(skill)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title={t('ecosystem.inspect', 'View SKILL.md')}
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  {skill.isInstalled && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 select-none">
                        {skill.isEnabled ? t('ecosystem.status.active', 'Active') : t('ecosystem.status.inactive', 'Inactive')}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={skill.isEnabled}
                        onClick={() => toggleSkill(skill.id, !skill.isEnabled)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] ${
                          skill.isEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span className="sr-only">{t('ecosystem.skills.toggle', "Toggle")} {skill.title}</span>
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            skill.isEnabled ? 'ltr:translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  {skill.isInstalled ? (
                    <button
                      onClick={() => uninstallSkill(skill.id)}
                      disabled={isBusy}
                      className="flex items-center gap-1 px-2.5 py-1.2 rounded-lg text-rose-500 hover:bg-rose-500/10 text-xs font-medium transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('common.uninstall', 'Uninstall')}</span>
                    </button>
                  ) : installError ? (
                    <button
                      onClick={() => installSkill(skill)}
                      disabled={isBusy}
                      className="flex items-center gap-1.5 px-2.5 py-1.2 rounded-lg text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold border border-rose-500/30 transition-all active:scale-95"
                      title={installError}
                    >
                      {isBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      <span>{isBusy ? t('ecosystem.installing', 'Installing...') : t('common.retry', 'Retry')}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => installSkill(skill)}
                      disabled={isBusy}
                      className="flex items-center gap-1.5 px-3 py-1.2 rounded-lg text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
                      style={{
                        background: 'linear-gradient(135deg, var(--color-primary-btn), var(--color-accent))',
                        boxShadow: '0 2px 8px var(--color-accent-glow)',
                      }}
                    >
                      {isBusy ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>{isBusy ? t('ecosystem.installing', 'Installing...') : t('common.install', 'Install')}</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Progressive Infinite Scroll Sentinel & Counter */}
      {visibleSkills.length < sortedSkills.length ? (
        <div ref={sentinelRef} className="py-8 flex flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 shadow-xs text-xs font-medium text-slate-600 dark:text-slate-300 backdrop-blur-md">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--color-accent)' }} />
            <span>
              {t('ecosystem.loading_more', 'Loading more skills...')} ({visibleSkills.length} {t('ecosystem.skills.of', "of")} {sortedSkills.length})
            </span>
          </div>
          <p className="text-[11px] text-slate-400">{t('ecosystem.skills.scroll_down_to_load_more', "Scroll down to load more")}</p>
        </div>
      ) : sortedSkills.length > 0 ? (
        <div className="py-8 flex items-center justify-center">
          <span className="text-xs font-mono font-medium text-slate-400 dark:text-slate-500 px-3.5 py-1 rounded-full bg-slate-100/70 dark:bg-slate-900/70 border border-slate-200/50 dark:border-slate-800/50">
            {t('ecosystem.skills.all', "✓ All")} {sortedSkills.length} {t('ecosystem.skills.skills_rendered', "skills rendered")}
          </span>
        </div>
      ) : null}

      {sortedSkills.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
          <Sparkles className="w-8 h-8 text-slate-400 mb-2" />
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('ecosystem.no_skills', 'No skills match your search')}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('ecosystem.skills.try_adjusting_your_query_or_ca', "Try adjusting your query or category filters.")}
          </p>
        </div>
      )}

      {/* Inspect Skill Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {inspectingSkill && (
            <motion.div
              key={`inspect-backdrop-${inspectingSkill.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setInspectingSkill(null)}
            >
              <motion.div
                key={`inspect-modal-${inspectingSkill.id}`}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-3xl bg-white dark:bg-[#09120e] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[88vh]"
              >
              {/* Header */}
              <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center border shrink-0"
                    style={{
                      backgroundColor: 'var(--color-badge-bg)',
                      color: 'var(--color-accent)',
                      borderColor: 'var(--color-badge-border)',
                    }}
                  >
                    <FileCode className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {inspectingSkill.title}
                      </span>
                      {(() => {
                        const modalRank = downloadRankMap.get(inspectingSkill.id) ?? (inspectingSkill.slug ? downloadRankMap.get(inspectingSkill.slug) : undefined) ?? (inspectingSkill.name ? downloadRankMap.get(inspectingSkill.name) : undefined);
                        if (modalRank === undefined) return null;
                        return (
                          <span
                            title={t('ecosystem.skills.download_rank', { rank: modalRank, defaultValue: 'Download Rank: #{{rank}}' })}
                            className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-mono font-bold tracking-tight border shadow-xs whitespace-nowrap shrink-0 ${getRankBadgeClasses(modalRank)}`}
                          >
                            {modalRank <= 10 && <Flame className="w-2.5 h-2.5 fill-current shrink-0 animate-pulse" />}
                            <span>#{modalRank}</span>
                          </span>
                        );
                      })()}
                      {inspectingSkill.isOfficial && (
                        <span
                          className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-medium border whitespace-nowrap shrink-0 font-sans"
                          style={{
                            backgroundColor: 'var(--color-badge-bg)',
                            color: 'var(--color-accent)',
                            borderColor: 'var(--color-badge-border)',
                          }}
                        >
                          <BadgeCheck className="w-3 h-3 shrink-0" style={{ color: 'var(--color-accent)' }} />
                          <span>{t('ecosystem.official_maker', 'Official Maker')}</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                      {inspectingSkill.owner ? `${inspectingSkill.owner}/${inspectingSkill.repo}` : inspectingSkill.id}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {inspectingSkill.repository && (
                    <a
                      href={inspectingSkill.repository}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 transition-colors whitespace-nowrap"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      <span>{t('ecosystem.github_repo', 'GitHub Repo')}</span>
                    </a>
                  )}
                  <button
                    onClick={() => setInspectingSkill(null)}
                    className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs text-slate-800 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-950/40">
                {/* 1. Telemetry Metric Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
                    <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
                      <Download className="w-3 h-3" style={{ color: 'var(--color-accent)' }} />
                      {t('ecosystem.skills.installs', "Installs")}
                    </span>
                    <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                      {inspectingSkill.installs || '10K+'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
                    <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      {t('ecosystem.skills.github_stars', "GitHub Stars")}
                    </span>
                    <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                      {inspectingSkill.stars || 'N/A'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
                    <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
                      <GitBranch className="w-3 h-3 text-indigo-500" />
                      {t('ecosystem.skills.repository', "Repository")}
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white truncate">
                      {inspectingSkill.repo || (inspectingSkill.owner ? `${inspectingSkill.owner}/${inspectingSkill.repo}` : inspectingSkill.id)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
                    <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
                      <Calendar className="w-3 h-3 text-emerald-500" />
                      {t('ecosystem.skills.first_seen', "First Seen")}
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white">
                      {inspectingSkill.firstSeen || '2026-03-13'}
                    </span>
                  </div>
                </div>

                {/* 2. Security Audits Section */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs font-mono font-semibold uppercase text-slate-700 dark:text-slate-300 mb-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>{t('ecosystem.security_audits', 'Security Audits')}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                        {t('ecosystem.skills.gen_agent_trust_hub', "Gen Agent Trust Hub")}
                      </span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                        {t('ecosystem.skills.pass', "Pass")}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                        {t('ecosystem.skills.socket', "Socket")}
                      </span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                        {t('ecosystem.skills.pass_2', "Pass")}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                        {t('ecosystem.skills.snyk', "Snyk")}
                      </span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                        {t('ecosystem.skills.pass_3', "Pass")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2.5 Execution Prerequisites & Security Telemetry */}
                {(() => {
                  const prereqs =
                    inspectingSkill.prerequisites ||
                    parsePrerequisitesFromMarkdown(
                      inspectingSkill.content ||
                        (inspectingSkill.docsMarkdown as any)?.en ||
                        ''
                    );

                  const hasPrereqs =
                    prereqs &&
                    ((prereqs.allowedTools && prereqs.allowedTools.length > 0) ||
                      (prereqs.envVars && prereqs.envVars.length > 0) ||
                      (prereqs.cliCommands && prereqs.cliCommands.length > 0) ||
                      (inspectingSkill.companionFiles && inspectingSkill.companionFiles.length > 0) ||
                      isSkillUpstreamLive(inspectingSkill));

                  if (!hasPrereqs) return null;

                  return (
                    <div
                      className="p-3.5 rounded-xl border space-y-3"
                      style={{
                        backgroundColor: 'var(--color-badge-bg)',
                        borderColor: 'var(--color-badge-border)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div
                          className="flex items-center gap-1.5 text-xs font-mono font-semibold uppercase"
                          style={{ color: 'var(--color-accent)' }}
                        >
                          <Terminal className="w-4 h-4" />
                          <span>{t('ecosystem.skills.execution_prerequisites_tool_t', "Execution Prerequisites & Tool Telemetry")}</span>
                        </div>
                        {isSkillUpstreamLive(inspectingSkill) && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border"
                            style={{
                              backgroundColor: 'var(--color-badge-bg)',
                              color: 'var(--color-accent)',
                              borderColor: 'var(--color-badge-border)',
                            }}
                          >
                            <Globe className="w-3 h-3" />
                            {t('ecosystem.skills.live_github', "LIVE GITHUB")}
                          </span>
                        )}
                      </div>

                      {/* Allowed Tools */}
                      {prereqs.allowedTools && prereqs.allowedTools.length > 0 && (
                        <div>
                          <span className="text-[10px] font-mono text-slate-500 uppercase block mb-1">
                            {t('ecosystem.skills.allowed_tools_execution_permis', "Allowed Tools (Execution Permissions):")}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {prereqs.allowedTools.map((tool, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md font-mono text-[11px] border"
                                style={{
                                  backgroundColor: 'var(--color-badge-bg)',
                                  borderColor: 'var(--color-badge-border)',
                                  color: 'var(--color-accent)',
                                }}
                              >
                                {tool}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Required Environment Variables */}
                      {prereqs.envVars && prereqs.envVars.length > 0 && (
                        <div>
                          <span className="text-[10px] font-mono text-slate-500 uppercase block mb-1">
                            {t('ecosystem.skills.required_environment_variables', "Required Environment Variables (API Keys / Tokens):")}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {prereqs.envVars.map((envVar, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md font-mono text-[11px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-semibold"
                              >
                                {envVar}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* CLI Setup Commands */}
                      {prereqs.cliCommands && prereqs.cliCommands.length > 0 && (
                        <div>
                          <span className="text-[10px] font-mono text-slate-500 uppercase block mb-1">
                            {t('ecosystem.skills.cli_setup_commands', "CLI Setup Commands:")}
                          </span>
                          <div className="space-y-1.5">
                            {prereqs.cliCommands.map((cmd, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-black/20 border border-slate-700/50 font-mono text-[11px] text-slate-200"
                              >
                                <code>{cmd}</code>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(cmd);
                                    handleCopyTrigger(cmd);
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-white transition-colors"
                                  title={t('ecosystem.skills.copy_command', "Copy command")}
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Companion Files */}
                      {inspectingSkill.companionFiles && inspectingSkill.companionFiles.length > 0 && (
                        <div>
                          <span className="text-[10px] font-mono text-slate-500 uppercase block mb-1">
                            {t('ecosystem.skills.multi_file_companion_assets', "Multi-File Companion Assets (")}{inspectingSkill.companionFiles.length}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {inspectingSkill.companionFiles.map((file, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md font-mono text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
                              >
                                {file}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 3. 1-Click Install Banner for Online Skills */}
                {!inspectingSkill.isLocal && (
                  <div
                    className="p-3.5 rounded-xl border flex items-center justify-between"
                    style={{
                      background: 'linear-gradient(90deg, var(--color-badge-bg), transparent)',
                      borderColor: 'var(--color-badge-border)',
                    }}
                  >
                    <div>
                      <span className="text-xs font-semibold text-slate-900 dark:text-white block mb-0.5">
                        {t('ecosystem.install_instruction', 'Install via Terminal or 1-Click:')}
                      </span>
                      <code
                        className="text-[11px] font-mono px-2 py-0.5 rounded-md"
                        style={{
                          backgroundColor: 'var(--color-badge-bg)',
                          color: 'var(--color-accent)',
                        }}
                      >
                        {t('ecosystem.skills.npx_skills_add', "npx skills add")} {inspectingSkill.id}
                      </code>
                    </div>

                    {inspectingSkill.isInstalled ? (
                      <button
                        onClick={async () => {
                          const ok = await uninstallSkill(inspectingSkill.id);
                          if (ok) {
                            setInspectingSkill((prev) =>
                              prev ? { ...prev, isInstalled: false, isEnabled: false } : null
                            );
                          }
                        }}
                        disabled={installingId === inspectingSkill.id}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-rose-500 hover:bg-rose-500/10 text-xs font-semibold transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>{t('common.uninstall', 'Uninstall')}</span>
                      </button>
                    ) : installErrors[inspectingSkill.id] ? (
                      <button
                        onClick={async () => {
                          const ok = await installSkill(inspectingSkill);
                          if (ok) {
                            setInspectingSkill((prev) =>
                              prev ? { ...prev, isInstalled: true, isEnabled: true } : null
                            );
                          }
                        }}
                        disabled={installingId === inspectingSkill.id}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold border border-rose-500/30 transition-all active:scale-95"
                        title={installErrors[inspectingSkill.id]}
                      >
                        <RefreshCw className={`w-4 h-4 ${installingId === inspectingSkill.id ? 'animate-spin' : ''}`} />
                        <span>
                          {installingId === inspectingSkill.id
                            ? t('ecosystem.installing', 'Installing...')
                            : t('common.retry', 'Retry')}
                        </span>
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          const ok = await installSkill(inspectingSkill);
                          if (ok) {
                            setInspectingSkill((prev) =>
                              prev ? { ...prev, isInstalled: true, isEnabled: true } : null
                            );
                          }
                        }}
                        disabled={installingId === inspectingSkill.id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-semibold text-xs shadow-md active:scale-95 transition-all"
                        style={{
                          background: 'linear-gradient(135deg, var(--color-primary-btn), var(--color-accent))',
                          boxShadow: '0 4px 12px var(--color-accent-glow)',
                        }}
                      >
                        <Download className="w-4 h-4" />
                        <span>
                          {installingId === inspectingSkill.id
                            ? t('ecosystem.installing', 'Installing...')
                            : t('ecosystem.one_click_install', '1-Click Install')}
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {/* 4. Enriched Architecture & SKILL.md Content View */}
                <div>
                  <div className="text-[11px] font-mono uppercase text-slate-500 mb-1.5 flex items-center justify-between">
                    <span>{t('ecosystem.architecture_docs', 'Architecture & Documentation')}</span>
                    <span className="text-[10px] text-slate-400">{t('ecosystem.read_only', 'READ-ONLY MODE')}</span>
                  </div>
                  <RichSkillDocViewer skill={inspectingSkill} rawSkillContent={inspectingContent} />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-900/40">
                <button
                  onClick={() => setInspectingSkill(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
                >
                  {t('common.close', 'Close')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}

      {/* Create Skill Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isCreateOpen && (
            <motion.div
              key="create-skill-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsCreateOpen(false)}
            >
              <motion.div
                key="create-skill-modal"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-xl bg-white dark:bg-[#09120e] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
              >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60">
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  {t('ecosystem.skills.create_modal_title', 'Create New Agent Skill')}
                </span>
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="p-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                    {t('ecosystem.skills.identifier_slug', "Identifier (slug)")}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t('ecosystem.skills.my_custom_skill', "my-custom-skill")}
                    value={newSkill.id}
                    onChange={(e) => setNewSkill({ ...newSkill, id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[var(--color-accent)]"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                    {t('ecosystem.skills.title', "Title")}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t('ecosystem.skills.my_custom_skill_title', "My Custom Skill Title")}
                    value={newSkill.title}
                    onChange={(e) => setNewSkill({ ...newSkill, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[var(--color-accent)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                      {t('ecosystem.skills.category', "Category")}
                    </label>
                    <select
                      value={newSkill.category}
                      onChange={(e) => setNewSkill({ ...newSkill, category: e.target.value as SkillCategory })}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    >
                      {categories.filter((c) => c !== 'all').map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                      {t('ecosystem.skills.triggers_comma_separated', "Triggers (comma separated)")}
                    </label>
                    <input
                      type="text"
                      placeholder={t('ecosystem.skills.react_refactor_audit', "react, refactor, audit")}
                      value={newSkill.triggers}
                      onChange={(e) => setNewSkill({ ...newSkill, triggers: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                    {t('ecosystem.skills.description', "Description")}
                  </label>
                  <textarea
                    rows={2}
                    placeholder={t('ecosystem.skills.short_description_of_what_this', "Short description of what this skill enables the agent to do...")}
                    value={newSkill.description}
                    onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {t('ecosystem.skills.cancel', "Cancel")}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white shadow-xs transition-all active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg, var(--color-primary-btn), var(--color-accent))',
                      boxShadow: '0 2px 8px var(--color-accent-glow)',
                    }}
                  >
                    {t('ecosystem.skills.save_install', "Save & Install")}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}
    </div>
  );
};

export default SkillsTab;
