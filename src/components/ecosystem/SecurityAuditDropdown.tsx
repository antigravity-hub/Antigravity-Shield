import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ChevronDown, Check, Shield, AlertTriangle, Lock, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface SecurityAuditOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

export const SECURITY_AUDIT_OPTIONS: SecurityAuditOption[] = [
  {
    id: 'passed_only',
    label: 'Shield Clean (All Passed)',
    icon: <Check className="w-3.5 h-3.5 text-emerald-500" />,
    badge: '100% Pass',
  },
  {
    id: 'gen_trust_hub_pass',
    label: 'Gen Agent Trust Hub: Pass',
    icon: <Shield className="w-3.5 h-3.5 text-sky-500" />,
  },
  {
    id: 'socket_pass',
    label: 'Socket: Pass',
    icon: <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />,
  },
  {
    id: 'snyk_pass',
    label: 'Snyk: Pass',
    icon: <Lock className="w-3.5 h-3.5 text-indigo-500" />,
  },
  {
    id: 'snyk_warn',
    label: 'Snyk: Warn',
    icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
  },
];

interface SecurityAuditDropdownProps {
  selectedAudits: string[];
  onChange: (selected: string[]) => void;
  className?: string;
}

export const SecurityAuditDropdown: React.FC<SecurityAuditDropdownProps> = ({
  selectedAudits,
  onChange,
  className = '',
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const isAllSelected = selectedAudits.length === 0;

  const toggleOption = (id: string) => {
    if (selectedAudits.includes(id)) {
      onChange(selectedAudits.filter((item) => item !== id));
    } else {
      onChange([...selectedAudits, id]);
    }
  };

  const handleSelectAll = () => {
    onChange([]);
  };

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl border text-xs font-medium transition-all active:scale-98 focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
          !isAllSelected
            ? 'bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 shadow-xs'
            : 'bg-white/90 dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-700/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 shadow-xs'
        }`}
      >
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span className="truncate">
          {isAllSelected
            ? t('ecosystem.all_security_audits', 'All Security Audits')
            : `${t('ecosystem.security_filtered', 'Security')}: ${selectedAudits.length}`}
        </span>

        {!isAllSelected && (
          <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 text-[10px] font-mono font-bold">
            {selectedAudits.length}
          </span>
        )}

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Checkbox Popover Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute left-0 mt-1.5 w-64 rounded-2xl bg-white/95 dark:bg-[#09120e]/95 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xl p-2 z-50 focus:outline-none"
          >
            {/* Header: All Security Audits (Reset) */}
            <button
              type="button"
              onClick={handleSelectAll}
              className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                isAllSelected
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/70'
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" style={{ color: 'var(--color-accent)' }} />
                <span>{t('ecosystem.all_security_audits', 'All Security Audits')}</span>
              </div>
              {isAllSelected && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
            </button>

            <div className="my-1.5 border-t border-slate-200/60 dark:border-slate-800/60" />

            {/* Checkbox Options List */}
            <div className="space-y-1">
              {SECURITY_AUDIT_OPTIONS.map((opt) => {
                const isChecked = selectedAudits.includes(opt.id);

                return (
                  <label
                    key={opt.id}
                    className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer select-none transition-colors ${
                      isChecked
                        ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Custom Checkbox */}
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOption(opt.id)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-500 shrink-0"
                      />
                      <span className="shrink-0">{opt.icon}</span>
                      <span className="truncate">{opt.label}</span>
                    </div>

                    {opt.badge && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono">
                        {opt.badge}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {/* Action Bar Footer */}
            {!isAllSelected && (
              <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between px-1">
                <span className="text-[10px] text-slate-400">
                  {selectedAudits.length} selected
                </span>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Reset to All
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
