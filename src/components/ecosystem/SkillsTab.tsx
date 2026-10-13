import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Download,
  Trash2,
  CheckCircle2,
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
} from 'lucide-react';
import { useEcosystemStore } from '../../stores/useEcosystemStore';
import { SkillItem, SkillCategory } from '../../types/ecosystem';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  all: Sliders,
  coding: Code2,
  design: Palette,
  devops: Gauge,
  data: Database,
  automation: Send,
  science: Boxes,
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

export const SkillsTab: React.FC = () => {
  const { t } = useTranslation();
  const {
    skills,
    searchQuery,
    selectedCategory,
    setSelectedCategory,
    skillSource,
    setSkillSource,
    installSkill,
    uninstallSkill,
    toggleSkill,
    installingId,
  } = useEcosystemStore();

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
      item.tags.some((tag) => tag.toLowerCase().includes(q)) ||
      (item.triggers && item.triggers.some((tr) => tr.toLowerCase().includes(q) || tr.toLowerCase().replace(/^\//, '').includes(q)));

    return matchesCategory && matchesQuery;
  });

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
            <span>{t('ecosystem.source.all', 'همه مهارت‌ها')}</span>
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
            <span>{t('ecosystem.source.local', 'مهارت‌های محلی من (Local)')}</span>
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
            <span>{t('ecosystem.source.skills_sh', 'مارکت‌پلیس Skills.sh')}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono">
              {onlineCount}
            </span>
          </button>
        </div>

        {/* Zero-Leak Security Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-medium self-start sm:self-auto">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Zero-Leak Shield: کلیدها و اسکیل‌های محلی ۱۰۰٪ ایزوله هستند</span>
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

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-xs shadow-md shadow-sky-500/20 active:scale-95 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('ecosystem.skills.create', 'Create Skill')}</span>
        </button>
      </div>

      {/* Skills Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredSkills.map((skill) => {
          const IconComponent = SKILL_ICONS[skill.icon || 'Sparkles'] || Sparkles;
          const isBusy = installingId === skill.id;

          return (
            <div
              key={skill.id}
              className="group relative flex flex-col justify-between p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-xs hover:shadow-md hover:border-sky-500/30 transition-all duration-200"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
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

                  {skill.isInstalled && (
                    <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                      skill.isEnabled
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}>
                      <CheckCircle2 className={`w-3 h-3 ${skill.isEnabled ? 'text-emerald-500' : 'text-slate-400'}`} />
                      <span>{skill.isEnabled ? 'فعال (Active)' : 'غیرفعال'}</span>
                    </span>
                  )}
                </div>

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
                        {skill.isEnabled ? 'فعال' : 'غیرفعال'}
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

      {filteredSkills.length === 0 && (
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
              className="w-full max-w-2xl bg-white dark:bg-[#0c1220] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60">
                <div className="flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-sky-500" />
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    {inspectingSkill.title} - SKILL.md
                  </span>
                </div>
                <button
                  onClick={() => setInspectingSkill(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto flex-1 font-mono text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-950/50 space-y-3">
                {inspectingSkill.installPath && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="truncate">مسیر محلی: {inspectingSkill.installPath}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-sans">ایزوله (Zero-Leak)</span>
                  </div>
                )}
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 whitespace-pre-wrap leading-relaxed">
                  {inspectingContent || inspectingSkill.content || (
`---
name: ${inspectingSkill.name}
description: ${inspectingSkill.description}
category: ${inspectingSkill.category}
version: ${inspectingSkill.version}
triggers: [${(inspectingSkill.triggers || []).join(', ')}]
---

# ${inspectingSkill.title}

${inspectingSkill.description}`
                  )}
                </div>
              </div>

              <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => setInspectingSkill(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold"
                >
                  Close
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
