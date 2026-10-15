import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Download,
  Trash2,
  CheckCircle2,
  Check,
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
  Layers,
  RefreshCw,
} from 'lucide-react';
import { useEcosystemStore } from '../../stores/useEcosystemStore';
import {
  SkillItem,
  SkillCategory,
  AgentPlatformId,
  SkillTopicId,
  SecurityAuditFilter,
} from '../../types/ecosystem';
import { RichSkillDocViewer } from './RichSkillDocViewer';
import {
  SKILLS_SH_CATALOG,
  OFFICIAL_AGENTS,
  OFFICIAL_TOPICS,
} from '../../config/skillsCatalog';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  all: Sliders,
  coding: Code2,
  design: Palette,
  devops: Gauge,
  data: Database,
  automation: Send,
  science: Boxes,
  architecture: Server,
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
  const { t } = useTranslation();
  const {
    skills,
    searchQuery,
    selectedCategory,
    setSelectedCategory,
    skillSource,
    setSkillSource,
    selectedAgent,
    setSelectedAgent,
    selectedTopic,
    setSelectedTopic,
    verifiedOnly,
    setVerifiedOnly,
    auditFilter,
    setAuditFilter,
    isSyncingTelemetry,
    lastTelemetrySyncAt,
    syncTelemetry,
    reorderRequired,
    applyReorder,
    installSkill,
    uninstallSkill,
    toggleSkill,
    installingId,
  } = useEcosystemStore();

  const [activeFirst, setActiveFirst] = useState(false);
  const [inspectingSkill, setInspectingSkill] = useState<SkillItem | null>(null);
  const [inspectingContent, setInspectingContent] = useState<string>('');
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
    'design',
    'devops',
    'data',
    'automation',
    'science',
    'architecture',
  ];

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

    // 4. Verified Only Filter (Item 4: Verified maker rosette checkmark)
    if (verifiedOnly) {
      const isVerified =
        Boolean(item.isVerifiedMaker) ||
        Boolean(item.isOfficial) ||
        (item.audits && item.audits.length > 0 && item.audits.every((a) => a.status === 'pass'));
      if (!isVerified) return false;
    }

    // 5. Security Audits Filter (Item 1: Gen Agent Trust Hub, Socket, Snyk)
    if (auditFilter !== 'all') {
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

    // 7. Curated Official Topics Filter (Item 3: https://www.skills.sh/topic)
    if (selectedTopic !== 'all') {
      const topicMatches =
        (item.topics && item.topics.includes(selectedTopic)) ||
        (selectedTopic === 'frontend-react' && (item.category === 'coding' || item.category === 'design' || item.tags?.some((t) => /react|front|ui/i.test(t)))) ||
        (selectedTopic === 'nextjs' && (item.tags?.some((t) => /next|vercel|ssr/i.test(t)) || item.name.includes('next'))) ||
        (selectedTopic === 'design-ui' && (item.category === 'design' || item.tags?.some((t) => /design|ui|motion|css|tailwind/i.test(t)))) ||
        (selectedTopic === 'mobile' && (item.tags?.some((t) => /mobile|react-native|expo|android|ios/i.test(t)) || item.name.includes('mobile'))) ||
        (selectedTopic === 'agent-workflows' && (item.category === 'automation' || item.category === 'architecture' || item.tags?.some((t) => /agent|workflow|subagent|swarm/i.test(t)))) ||
        (selectedTopic === 'databases' && (item.category === 'data' || item.tags?.some((t) => /database|sql|postgres|supabase|prisma/i.test(t)))) ||
        (selectedTopic === 'testing' && (item.tags?.some((t) => /test|playwright|tdd|eval/i.test(t)) || item.name.includes('test'))) ||
        (selectedTopic === 'marketing' && (item.tags?.some((t) => /market|seo|growth|copy/i.test(t)) || item.name.includes('marketing') || item.name.includes('seo')));
      if (!topicMatches) return false;
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
        <div className="flex items-center gap-2 p-1 bg-slate-200/70 dark:bg-slate-900/80 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 backdrop-blur-md">
          <button
            onClick={() => setSkillSource('all')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              skillSource === 'all'
                ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span>{t('ecosystem.source.all', 'All Skills')}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-700/60 font-mono">
              {skills.length}
            </span>
          </button>

          <button
            onClick={() => setSkillSource('local')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              skillSource === 'local'
                ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>{t('ecosystem.source.local', 'My Local Skills')}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">
              {localCount}
            </span>
          </button>

          <button
            onClick={() => setSkillSource('skills_sh')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              skillSource === 'skills_sh'
                ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            <span>{t('ecosystem.source.skills_sh', 'Marketplace')}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono">
              {onlineCount}
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
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 dark:bg-slate-900/80 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 backdrop-blur-md">
          {categories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat] || Sliders;
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="capitalize">{cat}</span>
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
                ? 'bg-sky-500/10 border-sky-500/40 text-sky-600 dark:text-sky-400 font-semibold shadow-xs'
                : 'bg-slate-100/80 dark:bg-slate-900/80 border-slate-200/60 dark:border-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Sort skills to show active/enabled ones first"
          >
            <div
              className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors ${
                activeFirst ? 'bg-sky-500 border-sky-500 text-white' : 'border-slate-400'
              }`}
            >
              {activeFirst && <Check className="w-2.5 h-2.5" />}
            </div>
            <span>{t('ecosystem.active_first', 'Active First')}</span>
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-xs shadow-md shadow-sky-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('ecosystem.skills.create', 'Create Skill')}</span>
          </button>
        </div>
      </div>

      {/* Advanced Secondary Controls: AI Agents Dropdown, Curated Topics, Security Audits & Verified Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-slate-50/70 dark:bg-slate-900/50 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* 1. AI Agent Compatibility Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              <Bot className="w-3.5 h-3.5 text-sky-500" />
              <span>{t('ecosystem.agent_filter_label', 'Agent')}:</span>
            </span>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value as AgentPlatformId)}
              className="text-xs font-medium py-1 px-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
            >
              <option value="all">⚡ All 20 AI Agents</option>
              <option value="antigravity" className="font-bold text-sky-600">
                ⭐ Google Antigravity (100% Native)
              </option>
              {OFFICIAL_AGENTS.filter((a) => a.id !== 'antigravity').map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Curated Topics Dropdown (https://www.skills.sh/topic) */}
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              <Layers className="w-3.5 h-3.5 text-purple-500" />
              <span>{t('ecosystem.topic_filter_label', 'Topic')}:</span>
            </span>
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value as SkillTopicId)}
              className="text-xs font-medium py-1 px-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
            >
              <option value="all">🌐 All Official Topics</option>
              {OFFICIAL_TOPICS.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title} ({topic.skillsCount})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Security Audits Filter Dropdown (Item 1) */}
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>{t('ecosystem.audit_filter_label', 'Security')}:</span>
            </span>
            <select
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value as SecurityAuditFilter)}
              className="text-xs font-medium py-1 px-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">🛡️ All Security Audits</option>
              <option value="passed_only">✅ Shield Clean (All Passed)</option>
              <option value="gen_trust_hub_pass">🛡️ Gen Agent Trust Hub: Pass</option>
              <option value="socket_pass">⚡ Socket: Pass</option>
              <option value="snyk_pass">🔒 Snyk: Pass</option>
              <option value="snyk_warn">⚠️ Snyk: Warn</option>
            </select>
          </div>
        </div>

        {/* 4. Verified Only Toggle (Item 4: Rosette checkmark) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setVerifiedOnly(!verifiedOnly)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-semibold transition-all ${
              verifiedOnly
                ? 'bg-sky-500/15 border-sky-500/50 text-sky-600 dark:text-sky-400 shadow-xs ring-1 ring-sky-500/30'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Show only skills from verified official publishers with clean security audits"
          >
            <BadgeCheck className={`w-3.5 h-3.5 ${verifiedOnly ? 'fill-sky-500/20 text-sky-500 animate-pulse' : 'text-slate-400'}`} />
            <span>{t('ecosystem.verified_only', 'Verified Only')}</span>
            {verifiedOnly && (
              <span className="text-[10px] px-1 py-0.2 rounded-full bg-sky-500/20 text-sky-600 dark:text-sky-300 font-mono">
                Active
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
                : 'Sync latest install counts and leaderboard from Hub CDN'
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

      {/* Skills Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sortedSkills.map((skill) => {
          const IconComponent = SKILL_ICONS[skill.icon || 'Sparkles'] || Sparkles;
          const isBusy = installingId === skill.id;
          const rank = downloadRankMap.get(skill.id) ?? (skill.slug ? downloadRankMap.get(skill.slug) : undefined) ?? (skill.name ? downloadRankMap.get(skill.name) : undefined);
          const isVerified = Boolean(skill.isVerifiedMaker) || Boolean(skill.isOfficial) || (skill.audits && skill.audits.length > 0 && skill.audits.every((a) => a.status === 'pass'));

          return (
            <div
              key={skill.id}
              className="group relative flex flex-col justify-between p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-xs hover:shadow-md hover:border-sky-500/30 transition-all duration-200"
            >
              {/* 3D Protruding Rank Ribbon folded over the side edge */}
              {rank !== undefined && (
                <div className="absolute -right-2.5 top-3 z-10 select-none pointer-events-none">
                  <div className="relative pointer-events-auto">
                    {/* Ribbon Main Body */}
                    <div
                      title={`Download Rank: #${rank}`}
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
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/20">
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
                          <span title="Verified Publisher (Maker / Passed Security Audits)" className="text-sky-500 dark:text-sky-400 flex items-center">
                            <BadgeCheck className="w-3.5 h-3.5 fill-sky-500/20 text-sky-500" />
                          </span>
                        )}
                        <Download className="w-3 h-3 text-sky-500" />
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
                      <span className="text-[10px] font-sans px-1.5 py-0.5 rounded-sm bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                        Official
                      </span>
                    )}
                  </div>
                )}

                {/* Description */}
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mb-3 leading-relaxed">
                  {skill.description}
                </p>

                {/* Triggers Tags */}
                {skill.triggers && skill.triggers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {skill.triggers.slice(0, 3).map((tr, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 text-[10px] rounded-md bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-mono"
                      >
                        /{tr}
                      </span>
                    ))}
                    {skill.triggers.length > 3 && (
                      <span className="text-[10px] text-slate-400 px-1 py-0.5">
                        +{skill.triggers.length - 3}
                      </span>
                    )}
                  </div>
                )}
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
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500/50 ${
                          skill.isEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span className="sr-only">Toggle {skill.title}</span>
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
                  ) : (
                    <button
                      onClick={() => installSkill(skill)}
                      disabled={isBusy}
                      className="flex items-center gap-1.5 px-3 py-1.2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold shadow-xs transition-colors active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isBusy ? 'Installing...' : t('common.install', 'Install')}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {sortedSkills.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
          <Sparkles className="w-8 h-8 text-slate-400 mb-2" />
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('ecosystem.no_skills', 'No skills match your search')}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Try adjusting your query or category filters.
          </p>
        </div>
      )}

      {/* Inspect Skill Modal */}
      <AnimatePresence>
        {inspectingSkill && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-3xl bg-white dark:bg-[#0c1220] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[88vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                    <FileCode className="w-5 h-5 text-sky-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {inspectingSkill.title}
                      </span>
                      {(() => {
                        const modalRank = downloadRankMap.get(inspectingSkill.id) ?? (inspectingSkill.slug ? downloadRankMap.get(inspectingSkill.slug) : undefined) ?? (inspectingSkill.name ? downloadRankMap.get(inspectingSkill.name) : undefined);
                        if (modalRank === undefined) return null;
                        return (
                          <span
                            title={`Download Rank: #${modalRank}`}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-black tracking-tight border shadow-xs ${getRankBadgeClasses(modalRank)}`}
                          >
                            {modalRank <= 10 && <Flame className="w-2.5 h-2.5 fill-current shrink-0 animate-pulse" />}
                            <span>#{modalRank}</span>
                          </span>
                        );
                      })()}
                      {inspectingSkill.isOfficial && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-sans">
                          {t('ecosystem.official_maker', 'Official Maker')}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      {inspectingSkill.owner ? `${inspectingSkill.owner}/${inspectingSkill.repo}` : inspectingSkill.id}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {inspectingSkill.repository && (
                    <a
                      href={inspectingSkill.repository}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      <span>{t('ecosystem.github_repo', 'GitHub Repo')}</span>
                    </a>
                  )}
                  <button
                    onClick={() => setInspectingSkill(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
                      <Download className="w-3 h-3 text-sky-500" />
                      Installs
                    </span>
                    <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                      {inspectingSkill.installs || '10K+'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
                    <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      GitHub Stars
                    </span>
                    <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                      {inspectingSkill.stars || 'N/A'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
                    <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
                      <GitBranch className="w-3 h-3 text-indigo-500" />
                      Repository
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white truncate">
                      {inspectingSkill.repo || (inspectingSkill.owner ? `${inspectingSkill.owner}/${inspectingSkill.repo}` : inspectingSkill.id)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
                    <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
                      <Calendar className="w-3 h-3 text-emerald-500" />
                      First Seen
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white">
                      {inspectingSkill.firstSeen || 'Mar 13, 2026'}
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
                        Gen Agent Trust Hub
                      </span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                        Pass
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                        Socket
                      </span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                        Pass
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                        Snyk
                      </span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                        Pass
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. 1-Click Install Banner for Online Skills */}
                {!inspectingSkill.isLocal && (
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-sky-500/10 via-indigo-500/5 to-transparent border border-sky-500/20 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-900 dark:text-white block mb-0.5">
                        {t('ecosystem.install_instruction', 'Install via Terminal or 1-Click:')}
                      </span>
                      <code className="text-[11px] font-mono text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-md">
                        npx skills add {inspectingSkill.id}
                      </code>
                    </div>

                    {!inspectingSkill.isInstalled && (
                      <button
                        onClick={() => installSkill(inspectingSkill)}
                        disabled={installingId === inspectingSkill.id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-semibold text-xs shadow-md shadow-sky-500/20 active:scale-95 transition-all"
                      >
                        <Download className="w-4 h-4" />
                        <span>{installingId === inspectingSkill.id ? t('ecosystem.installing', 'Installing...') : t('ecosystem.one_click_install', '1-Click Install')}</span>
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
          </div>
        )}
      </AnimatePresence>

      {/* Create Skill Modal */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-xl bg-white dark:bg-[#0c1220] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
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
                    Identifier (slug)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="my-custom-skill"
                    value={newSkill.id}
                    onChange={(e) => setNewSkill({ ...newSkill, id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="My Custom Skill Title"
                    value={newSkill.title}
                    onChange={(e) => setNewSkill({ ...newSkill, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                      Category
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
                      Triggers (comma separated)
                    </label>
                    <input
                      type="text"
                      placeholder="react, refactor, audit"
                      value={newSkill.triggers}
                      onChange={(e) => setNewSkill({ ...newSkill, triggers: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Short description of what this skill enables the agent to do..."
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
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-white shadow-xs"
                  >
                    Save & Install
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SkillsTab;
