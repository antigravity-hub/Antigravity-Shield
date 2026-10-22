/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Repository: https://github.com/antigravity-hub/Antigravity-Shield
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Gemini, Claude, OpenAI } from '@lobehub/icons';
import { Bot } from 'lucide-react';

export const AgentThumbnail: React.FC<{
  agentId: string;
  size?: number;
  className?: string;
}> = ({ agentId, size = 18, className = '' }) => {
  const { t } = useTranslation();
  const pixelSize = `${size}px`;

  switch (agentId) {
    case 'antigravity':
      return (
        <img
          src="/icon.png"
          alt={t('ecosystem.agent_logos.google_antigravity', 'Google Antigravity')}
          style={{ width: pixelSize, height: pixelSize }}
          className={`rounded-md shrink-0 object-contain shadow-xs ring-1 ring-sky-500/30 ${className}`}
        />
      );

    case 'gemini':
      return (
        <div
          style={{ width: pixelSize, height: pixelSize }}
          className={`flex items-center justify-center shrink-0 rounded-md bg-blue-500/10 ${className}`}
        >
          <Gemini.Color style={{ width: size - 2, height: size - 2 }} />
        </div>
      );

    case 'claude-code':
      return (
        <div
          style={{ width: pixelSize, height: pixelSize }}
          className={`flex items-center justify-center shrink-0 rounded-md bg-amber-500/10 ${className}`}
        >
          <Claude.Color style={{ width: size - 2, height: size - 2 }} />
        </div>
      );

    case 'codex':
      return (
        <div
          style={{ width: pixelSize, height: pixelSize }}
          className={`flex items-center justify-center shrink-0 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ${className}`}
        >
          <OpenAI style={{ width: size - 2, height: size - 2 }} />
        </div>
      );

    case 'cursor':
      return (
        <svg
          style={{ width: pixelSize, height: pixelSize }}
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 rounded-md ${className}`}
        >
          <rect width="24" height="24" rx="5" fill="#0E1117" />
          <path
            d="M5 5L19 12L12 14L9 19L5 5Z"
            fill="url(#cursorGrad)"
            stroke="#60A5FA"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <defs>
            <linearGradient id="cursorGrad" x1="5" y1="5" x2="19" y2="19" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38BDF8" />
              <stop offset="1" stopColor="#1E40AF" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'github-copilot':
      return (
        <svg
          style={{ width: pixelSize, height: pixelSize }}
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 rounded-md ${className}`}
        >
          <rect width="24" height="24" rx="5" fill="#181717" />
          <path
            d="M12 4C7.58 4 4 7.58 4 12C4 15.54 6.29 18.53 9.47 19.59C9.87 19.66 10.02 19.42 10.02 19.21V17.88C7.8 18.36 7.33 16.81 7.33 16.81C6.97 15.89 6.45 15.65 6.45 15.65C5.72 15.15 6.51 15.16 6.51 15.16C7.31 15.22 7.74 15.98 7.74 15.98C8.45 17.21 9.61 16.85 10.07 16.65C10.14 16.13 10.35 15.78 10.58 15.58C8.81 15.38 6.95 14.69 6.95 11.64C6.95 10.77 7.26 10.06 7.77 9.51C7.69 9.31 7.41 8.5 7.85 7.41C7.85 7.41 8.52 7.19 10.04 8.23C10.68 8.05 11.36 7.96 12.04 7.96C12.72 7.96 13.4 8.05 14.04 8.23C15.56 7.19 16.23 7.41 16.23 7.41C16.67 8.5 16.39 9.31 16.31 9.51C16.82 10.06 17.13 10.77 17.13 11.64C17.13 14.7 15.26 15.38 13.48 15.57C13.77 15.82 14.03 16.31 14.03 17.07V19.21C14.03 19.42 14.18 19.67 14.58 19.59C17.76 18.52 20.04 15.54 20.04 12C20.04 7.58 16.46 4 12 4Z"
            fill="#A78BFA"
          />
        </svg>
      );

    case 'windsurf':
      return (
        <svg
          style={{ width: pixelSize, height: pixelSize }}
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 rounded-md ${className}`}
        >
          <rect width="24" height="24" rx="5" fill="#0C4A6E" />
          <path
            d="M4 14C7 10 11 10 14 14C17 18 20 14 20 14"
            stroke="#38BDF8"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M4 18C7 14 11 14 14 18C17 22 20 18 20 18"
            stroke="#0284C7"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="12" cy="7" r="2.5" fill="#38BDF8" />
        </svg>
      );

    case 'cline':
      return (
        <svg
          style={{ width: pixelSize, height: pixelSize }}
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 rounded-md ${className}`}
        >
          <rect width="24" height="24" rx="5" fill="#1E293B" />
          <rect x="5" y="7" width="14" height="12" rx="3" fill="#0F172A" stroke="#38BDF8" strokeWidth="1.4" />
          <circle cx="9" cy="12" r="1.5" fill="#38BDF8" />
          <circle cx="15" cy="12" r="1.5" fill="#38BDF8" />
          <path d="M12 4V7" stroke="#38BDF8" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="12" cy="3.5" r="1" fill="#38BDF8" />
        </svg>
      );

    case 'amp':
      return (
        <svg
          style={{ width: pixelSize, height: pixelSize }}
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 rounded-md ${className}`}
        >
          <rect width="24" height="24" rx="5" fill="#0369A1" />
          <path d="M13 3L6 14H12L11 21L18 10H12L13 3Z" fill="#FDE047" stroke="#CA8A04" strokeWidth="0.8" />
        </svg>
      );

    case 'openclaw':
      return (
        <svg
          style={{ width: pixelSize, height: pixelSize }}
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 rounded-md ${className}`}
        >
          <rect width="24" height="24" rx="5" fill="#881337" />
          <path
            d="M7 16C5 13 6 8 9 7C11 6 13 8 13 10C13 8 15 6 17 7C20 8 21 13 19 16C17 19 14 17 13 15C12 17 9 19 7 16Z"
            fill="#FB7185"
          />
        </svg>
      );

    case 'droid':
      return (
        <svg
          style={{ width: pixelSize, height: pixelSize }}
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 rounded-md ${className}`}
        >
          <rect width="24" height="24" rx="5" fill="#14532D" />
          <rect x="5" y="8" width="14" height="10" rx="2" fill="#166534" stroke="#4ADE80" strokeWidth="1.2" />
          <rect x="7" y="11" width="10" height="3" rx="1.5" fill="#86EFAC" />
          <path d="M8 5L9.5 8M16 5L14.5 8" stroke="#4ADE80" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case 'goose':
      return (
        <svg
          style={{ width: pixelSize, height: pixelSize }}
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 rounded-md ${className}`}
        >
          <rect width="24" height="24" rx="5" fill="#1E1B4B" />
          <path
            d="M6 16C8 13 10 12 12 12H14C16 12 17 10 17 8C17 6 15.5 5 14 5C12.5 5 12 6 12 6L10 6C10 4 12 3 14 3C17 3 19 5 19 8C19 11 17 13 15 14V17C15 18.5 13 19 10 19C7 19 5 18 6 16Z"
            fill="#818CF8"
          />
          <circle cx="14.5" cy="7" r="1" fill="#FEF08A" />
        </svg>
      );

    case 'kilo':
      return (
        <svg
          style={{ width: pixelSize, height: pixelSize }}
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 rounded-md ${className}`}
        >
          <rect width="24" height="24" rx="5" fill="#312E81" />
          <path d="M7 6V18M7 12L16 6M10 12L17 18" stroke="#A5B4FC" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'kiro-cli':
      return (
        <svg
          style={{ width: pixelSize, height: pixelSize }}
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 rounded-md ${className}`}
        >
          <rect width="24" height="24" rx="5" fill="#18181B" />
          <path d="M6 8L10 12L6 16" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="16" x2="17" y2="16" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'nous-research':
      return (
        <svg
          style={{ width: pixelSize, height: pixelSize }}
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 rounded-md ${className}`}
        >
          <rect width="24" height="24" rx="5" fill="#4A044E" />
          <circle cx="12" cy="12" r="7" stroke="#F472B6" strokeWidth="1.8" />
          <path d="M12 5V19M5 12H19" stroke="#E879F9" strokeWidth="1.2" strokeDasharray="2 2" />
          <circle cx="12" cy="12" r="2.5" fill="#F472B6" />
        </svg>
      );

    case 'opencode':
      return (
        <svg
          style={{ width: pixelSize, height: pixelSize }}
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 rounded-md ${className}`}
        >
          <rect width="24" height="24" rx="5" fill="#1E293B" />
          <path d="M8 8L5 12L8 16M16 8L19 12L16 16" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="13" y1="7" x2="11" y2="17" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );

    case 'roo':
      return (
        <svg
          style={{ width: pixelSize, height: pixelSize }}
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 rounded-md ${className}`}
        >
          <rect width="24" height="24" rx="5" fill="#7C2D12" />
          <path
            d="M6 18C7 15 9 14 11 14H13C15 14 16 12 16 10C16 8 14.5 7 13 7C11.5 7 11 8 11 8M13 14V18M10 18H16"
            stroke="#FB923C"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="14" cy="8" r="1" fill="#FEF08A" />
        </svg>
      );

    case 'trae':
      return (
        <svg
          style={{ width: pixelSize, height: pixelSize }}
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 rounded-md ${className}`}
        >
          <rect width="24" height="24" rx="5" fill="#042F2E" />
          <path d="M6 7H18M12 7V18" stroke="#2DD4BF" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="12" cy="18" r="1.5" fill="#2DD4BF" />
        </svg>
      );

    case 'vscode':
      return (
        <svg
          style={{ width: pixelSize, height: pixelSize }}
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 rounded-md ${className}`}
        >
          <rect width="24" height="24" rx="5" fill="#1E1E1E" />
          <path
            d="M17.5 3.5L12 8.5L8 5L5 7.5V16.5L8 19L12 15.5L17.5 20.5L20 19V5L17.5 3.5Z"
            fill="#007ACC"
          />
          <path
            d="M17.5 3.5L12 8.5V15.5L17.5 20.5L20 19V5L17.5 3.5Z"
            fill="#1F8AD2"
          />
          <path
            d="M12 8.5L8 5L5 7.5L8.5 12L5 16.5L8 19L12 15.5V8.5Z"
            fill="#0065A9"
          />
        </svg>
      );

    case 'zed':
      return (
        <svg
          style={{ width: pixelSize, height: pixelSize }}
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 rounded-md ${className}`}
        >
          <rect width="24" height="24" rx="5" fill="#27272A" />
          <path d="M6 7H18L6 17H18" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    default:
      return (
        <div
          style={{ width: pixelSize, height: pixelSize }}
          className={`flex items-center justify-center shrink-0 rounded-md bg-slate-500/10 text-slate-500 dark:text-slate-400 ${className}`}
        >
          <Bot style={{ width: size - 4, height: size - 4 }} />
        </div>
      );
  }
};
