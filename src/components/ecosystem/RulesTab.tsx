import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Plus,
  Edit3,
  X,
  FileCode2,
  FolderGit2,
  Globe2,
  Zap,
} from 'lucide-react';
import { useEcosystemStore } from '../../stores/useEcosystemStore';
import { RuleItem } from '../../types/ecosystem';

export const RulesTab: React.FC = () => {
  const { t } = useTranslation();
  const { rules, searchQuery, saveRule, toggleRule } = useEcosystemStore();

  const [editingRule, setEditingRule] = useState<RuleItem | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newRule, setNewRule] = useState<{
    title: string;
    fileName: string;
    scope: 'global' | 'workspace';
    trigger: 'always_on' | 'model_decision';
    description: string;
    content: string;
  }>({
    title: '',
    fileName: 'GEMINI.md',
    scope: 'global',
    trigger: 'always_on',
    description: '',
    content: '# Custom Agent Rules\n- Maintain documentation integrity\n- High signal-to-noise ratio',
  });

  const filteredRules = rules.filter((item) => {
    return (
      searchQuery.trim() === '' ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.fileName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.title) return;

    const payload: RuleItem = {
      id: `rule-${Date.now()}`,
      title: newRule.title,
      fileName: newRule.fileName,
      path: newRule.scope === 'global' ? `~/.gemini/config/rules/${newRule.fileName}` : `./.agents/rules/${newRule.fileName}`,
      scope: newRule.scope,
      trigger: newRule.trigger,
      description: newRule.description,
      content: newRule.content,
      isEnabled: true,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    await saveRule(payload);
    setIsCreateOpen(false);
    setNewRule({
      title: '',
      fileName: 'GEMINI.md',
      scope: 'global',
      trigger: 'always_on',
      description: '',
      content: '# Custom Agent Rules\n',
    });
  };

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {rules.filter((r) => r.isEnabled).length} active rule guidelines applied
        </span>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-xs shadow-md shadow-sky-500/20 active:scale-95 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('ecosystem.rules.create', 'Add Instruction Rule')}</span>
        </button>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredRules.map((rule) => {
          return (
            <div
              key={rule.id}
              className="group relative flex flex-col justify-between p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-xs hover:shadow-md hover:border-sky-500/30 transition-all duration-200"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {rule.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        <span>{rule.fileName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        rule.scope === 'global'
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                          : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                      }`}
                    >
                      {rule.scope === 'global' ? (
                        <Globe2 className="w-2.5 h-2.5" />
                      ) : (
                        <FolderGit2 className="w-2.5 h-2.5" />
                      )}
                      <span className="capitalize">{rule.scope}</span>
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 mb-3 leading-relaxed">
                  {rule.description}
                </p>

                {/* Trigger pill */}
                <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 mb-3 font-mono">
                  <Zap className="w-3 h-3 text-amber-500" />
                  <span>Trigger: {rule.trigger}</span>
                </div>
              </div>

              {/* Actions & Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-2">
                <button
                  onClick={() => setEditingRule(rule)}
                  className="flex items-center gap-1.5 px-2.5 py-1.2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{t('common.edit', 'Edit Content')}</span>
                </button>

                <label className="flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rule.isEnabled}
                    onChange={(e) => toggleRule(rule.id, e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`w-8 h-4.5 rounded-full transition-colors relative ${
                      rule.isEnabled ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                        rule.isEnabled ? 'left-4' : 'left-0.5'
                      }`}
                    />
                  </div>
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Rule Modal */}
      <AnimatePresence>
        {editingRule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl bg-white dark:bg-[#09120e] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60">
                <div className="flex items-center gap-2">
                  <FileCode2 className="w-5 h-5 text-emerald-500" />
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    Edit Rule: {editingRule.title}
                  </span>
                </div>
                <button
                  onClick={() => setEditingRule(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto flex-1 space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                    Rule Title
                  </label>
                  <input
                    type="text"
                    value={editingRule.title}
                    onChange={(e) => setEditingRule({ ...editingRule, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                    Rule Content (Markdown)
                  </label>
                  <textarea
                    rows={12}
                    value={editingRule.content}
                    onChange={(e) => setEditingRule({ ...editingRule, content: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl font-mono text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white leading-relaxed"
                  />
                </div>
              </div>

              <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  onClick={() => setEditingRule(null)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await saveRule(editingRule);
                    setEditingRule(null);
                  }}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white shadow-xs"
                >
                  Save Rule
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Rule Modal */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-xl bg-white dark:bg-[#09120e] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60">
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  Add New Agent Rule
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
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. Strict Error Handling Guidelines"
                    value={newRule.title}
                    onChange={(e) => setNewRule({ ...newRule, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                      File Target
                    </label>
                    <select
                      value={newRule.fileName}
                      onChange={(e) => setNewRule({ ...newRule, fileName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="GEMINI.md">GEMINI.md</option>
                      <option value="AGENTS.md">AGENTS.md</option>
                      <option value="RULE[user_global]">RULE[user_global]</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                      Scope
                    </label>
                    <select
                      value={newRule.scope}
                      onChange={(e) => setNewRule({ ...newRule, scope: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="global">Global (System)</option>
                      <option value="workspace">Workspace Only</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                      Trigger
                    </label>
                    <select
                      value={newRule.trigger}
                      onChange={(e) => setNewRule({ ...newRule, trigger: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="always_on">Always On</option>
                      <option value="model_decision">Model Decision</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                    Instructions / Guidelines Content
                  </label>
                  <textarea
                    rows={6}
                    placeholder="# Rule Details..."
                    value={newRule.content}
                    onChange={(e) => setNewRule({ ...newRule, content: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
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
                    className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white shadow-xs"
                  >
                    Create Rule
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

export default RulesTab;
