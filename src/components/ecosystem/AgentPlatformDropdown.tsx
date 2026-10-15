import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Zap } from 'lucide-react';
import { OFFICIAL_AGENTS } from '../../config/skillsCatalog';
import { AgentPlatformId } from '../../types/ecosystem';
import { AgentThumbnail } from './AgentLogos';

interface AgentPlatformDropdownProps {
  value: AgentPlatformId;
  onChange: (agentId: AgentPlatformId) => void;
  className?: string;
}

export const AgentPlatformDropdown: React.FC<AgentPlatformDropdownProps> = ({
  value,
  onChange,
  className = '',
}) => {
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

  const selectedAgentInfo = OFFICIAL_AGENTS.find((a) => a.id === value);

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 py-1.5 px-3 bg-white/90 dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 shadow-xs transition-all active:scale-98 focus:outline-none focus:ring-1 focus:ring-sky-500"
      >
        {value === 'all' ? (
          <div className="w-4 h-4 rounded flex items-center justify-center bg-amber-500/10 text-amber-500">
            <Zap className="w-3 h-3 fill-amber-500" />
          </div>
        ) : (
          <AgentThumbnail agentId={value} size={16} />
        )}

        <span className="truncate max-w-[150px]">
          {value === 'all'
            ? 'All 20 AI Agents'
            : value === 'antigravity'
            ? 'Google Antigravity'
            : selectedAgentInfo?.name || value}
        </span>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Popover Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute left-0 mt-1.5 w-64 max-h-80 overflow-y-auto rounded-2xl bg-white/95 dark:bg-[#0c1220]/95 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xl p-1.5 z-50 focus:outline-none custom-scrollbar"
          >
            {/* All Agents Option */}
            <button
              type="button"
              onClick={() => {
                onChange('all');
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                value === 'all'
                  ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/70'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md flex items-center justify-center bg-amber-500/15 text-amber-500 shrink-0">
                  <Zap className="w-3.5 h-3.5 fill-amber-500" />
                </div>
                <span>All 20 AI Agents</span>
              </div>
              {value === 'all' && <Check className="w-3.5 h-3.5 text-sky-500 shrink-0" />}
            </button>

            <div className="my-1 border-t border-slate-200/60 dark:border-slate-800/60" />

            {/* Antigravity (100% Native Highlighted) */}
            <button
              type="button"
              onClick={() => {
                onChange('antigravity');
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                value === 'antigravity'
                  ? 'bg-sky-500/15 text-sky-600 dark:text-sky-300 ring-1 ring-sky-500/30'
                  : 'text-slate-800 dark:text-slate-100 hover:bg-sky-500/10 dark:hover:bg-sky-500/10'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <AgentThumbnail agentId="antigravity" size={18} />
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-sky-600 dark:text-sky-400">Google Antigravity</span>
                  <span className="text-[10px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-500 font-normal">
                    100% Native
                  </span>
                </div>
              </div>
              {value === 'antigravity' && <Check className="w-3.5 h-3.5 text-sky-500 shrink-0" />}
            </button>

            {/* Other Agents with Thumbnail Logos */}
            {OFFICIAL_AGENTS.filter((a) => a.id !== 'antigravity').map((agent) => {
              const isSelected = value === agent.id;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => {
                    onChange(agent.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <AgentThumbnail agentId={agent.id} size={18} />
                    <span className="truncate">{agent.name}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-sky-500 shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
