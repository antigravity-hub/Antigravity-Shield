import { create } from 'zustand';
import {
  EcosystemEntityType,
  SkillCategory,
  SkillItem,
  McpServerItem,
  RuleItem,
  AgentPlatformId,
  SkillTopicId,
  SecurityAuditFilter,
} from '../types/ecosystem';
import * as ecosystemService from '../services/ecosystemService';
import { SKILLS_SH_CATALOG } from '../config/skillsCatalog';
import { DEFAULT_MCP_CATALOG, DEFAULT_RULES_CATALOG } from '../config/defaultEcosystemCatalog';

interface EcosystemState {
  activeTab: EcosystemEntityType;
  skills: SkillItem[];
  mcpServers: McpServerItem[];
  rules: RuleItem[];
  loading: boolean;
  searchQuery: string;
  selectedCategory: SkillCategory;
  skillSource: 'all' | 'local' | 'skills_sh';
  installingId: string | null;
  testingMcpId: string | null;
  isTestingAllMcp: boolean;

  // Advanced Multi-Dimensional Filters
  selectedAgent: AgentPlatformId;
  selectedTopic: SkillTopicId;
  verifiedOnly: boolean;
  auditFilter: SecurityAuditFilter;
  selectedAuditFilters: string[];

  // Live Telemetry Sync State (Progressive Streaming Hydration)
  isSyncingTelemetry: boolean;
  lastTelemetrySyncAt: number | null;
  reorderRequired: boolean;

  // Setters
  setActiveTab: (tab: EcosystemEntityType) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: SkillCategory) => void;
  setSkillSource: (source: 'all' | 'local' | 'skills_sh') => void;
  setSelectedAgent: (agent: AgentPlatformId) => void;
  setSelectedTopic: (topic: SkillTopicId) => void;
  setVerifiedOnly: (verified: boolean) => void;
  setAuditFilter: (filter: SecurityAuditFilter) => void;
  setSelectedAuditFilters: (filters: string[]) => void;

  // Actions
  loadAll: () => Promise<void>;
  syncTelemetry: () => Promise<boolean>;
  applyReorder: () => void;
  installSkill: (skill: SkillItem) => Promise<boolean>;
  uninstallSkill: (skillId: string) => Promise<boolean>;
  toggleSkill: (skillId: string, enabled: boolean) => Promise<void>;
  saveMcpServer: (server: McpServerItem) => Promise<boolean>;
  deleteMcpServer: (serverId: string) => Promise<boolean>;
  toggleMcpServer: (serverId: string, enabled: boolean) => Promise<void>;
  testMcpServer: (serverId: string) => Promise<{ success: boolean; latencyMs: number; message: string }>;
  testAllMcpServers: () => Promise<void>;
  saveRule: (rule: RuleItem) => Promise<boolean>;
  toggleRule: (ruleId: string, enabled: boolean) => Promise<void>;
}

export const useEcosystemStore = create<EcosystemState>((set) => ({
  activeTab: 'skills',
  skills: SKILLS_SH_CATALOG,
  mcpServers: DEFAULT_MCP_CATALOG,
  rules: DEFAULT_RULES_CATALOG,
  loading: false,
  searchQuery: '',
  selectedCategory: 'all',
  skillSource: 'all',
  installingId: null,
  testingMcpId: null,
  isTestingAllMcp: false,

  selectedAgent: 'all',
  selectedTopic: 'all',
  verifiedOnly: false,
  auditFilter: 'all',
  selectedAuditFilters: [],

  isSyncingTelemetry: false,
  lastTelemetrySyncAt: (() => {
    const stored = localStorage.getItem('antigravity_last_telemetry_sync');
    return stored ? Number(stored) : null;
  })(),
  reorderRequired: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  setSkillSource: (source) => set({ skillSource: source }),
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  setSelectedTopic: (topic) => set({ selectedTopic: topic }),
  setVerifiedOnly: (verified) => set({ verifiedOnly: verified }),
  setAuditFilter: (filter) => set({ auditFilter: filter }),
  setSelectedAuditFilters: (filters) => set({ selectedAuditFilters: filters }),

  loadAll: async () => {
    set({ loading: true });
    try {
      const [skills, mcpServers, rules] = await Promise.all([
        ecosystemService.fetchSkills(),
        ecosystemService.fetchMcpServers(),
        ecosystemService.fetchRules(),
      ]);
      set({ skills, mcpServers, rules, loading: false });
    } catch (err) {
      console.error('[useEcosystemStore] Failed to load ecosystem:', err);
      set({ loading: false });
    }
  },

  syncTelemetry: async () => {
    set({ isSyncingTelemetry: true });
    try {
      const res = await ecosystemService.syncMarketplaceTelemetry((chunk) => {
        set((state) => {
          const chunkMap = new Map(chunk.map((item) => [item.id, item]));
          const updatedSkills = state.skills.map((s) => {
            const update = chunkMap.get(s.id) || (s.slug ? chunkMap.get(s.slug) : undefined);
            if (!update) return s;
            return {
              ...s,
              installs: update.installs ?? s.installs,
              stars: update.stars ?? s.stars,
              isOfficial: update.isOfficial ?? s.isOfficial,
              isVerifiedMaker: update.isVerifiedMaker ?? s.isVerifiedMaker,
            };
          });
          return { skills: updatedSkills, reorderRequired: true };
        });
      });
      set({ isSyncingTelemetry: false, lastTelemetrySyncAt: res.lastSyncedAt });
      return true;
    } catch (err) {
      console.warn('[useEcosystemStore] Telemetry sync failed:', err);
      set({ isSyncingTelemetry: false });
      return false;
    }
  },

  applyReorder: () => {
    set((state) => ({ skills: [...state.skills], reorderRequired: false }));
  },

  installSkill: async (skill) => {
    set({ installingId: skill.id });
    try {
      const updated = await ecosystemService.installSkill(skill);
      set((state) => ({
        skills: state.skills.map((s) => (s.id === skill.id ? updated : s)),
        installingId: null,
      }));
      return true;
    } catch (err) {
      console.error('[useEcosystemStore] Install skill failed:', err);
      set({ installingId: null });
      return false;
    }
  },

  uninstallSkill: async (skillId) => {
    set({ installingId: skillId });
    try {
      await ecosystemService.uninstallSkill(skillId);
      set((state) => ({
        skills: state.skills.map((s) => (s.id === skillId ? { ...s, isInstalled: false, isEnabled: false } : s)),
        installingId: null,
      }));
      return true;
    } catch (err) {
      console.error('[useEcosystemStore] Uninstall skill failed:', err);
      set({ installingId: null });
      return false;
    }
  },

  toggleSkill: async (skillId, enabled) => {
    await ecosystemService.toggleSkill(skillId, enabled);
    set((state) => ({
      skills: state.skills.map((s) => (s.id === skillId ? { ...s, isEnabled: enabled } : s)),
    }));
  },

  saveMcpServer: async (server) => {
    try {
      const saved = await ecosystemService.saveMcpServer(server);
      set((state) => {
        const existingIdx = state.mcpServers.findIndex((s) => s.id === server.id);
        if (existingIdx >= 0) {
          const next = [...state.mcpServers];
          next[existingIdx] = saved;
          return { mcpServers: next };
        }
        return { mcpServers: [saved, ...state.mcpServers] };
      });
      return true;
    } catch (err) {
      console.error('[useEcosystemStore] Save MCP server failed:', err);
      return false;
    }
  },

  deleteMcpServer: async (serverId) => {
    try {
      await ecosystemService.deleteMcpServer(serverId);
      set((state) => ({
        mcpServers: state.mcpServers.map((s) => (s.id === serverId ? { ...s, isInstalled: false, isEnabled: false } : s)),
      }));
      return true;
    } catch (err) {
      console.error('[useEcosystemStore] Delete MCP server failed:', err);
      return false;
    }
  },

  toggleMcpServer: async (serverId, enabled) => {
    await ecosystemService.toggleMcpServer(serverId, enabled);
    set((state) => ({
      mcpServers: state.mcpServers.map((s) => (s.id === serverId ? { ...s, isEnabled: enabled } : s)),
    }));
  },

  testMcpServer: async (serverId) => {
    set({ testingMcpId: serverId });
    try {
      const res = await ecosystemService.testMcpServer(serverId);
      set((state) => ({
        mcpServers: state.mcpServers.map((s) =>
          s.id === serverId
            ? {
                ...s,
                status: res.status,
                lastPingMs: res.latencyMs,
                lastChecked: Date.now(),
                errorMessage: res.success ? undefined : res.message,
              }
            : s
        ),
        testingMcpId: null,
      }));
      return res;
    } catch (err: any) {
      set((state) => ({
        mcpServers: state.mcpServers.map((s) =>
          s.id === serverId ? { ...s, status: 'error', errorMessage: String(err?.message || err), lastChecked: Date.now() } : s
        ),
        testingMcpId: null,
      }));
      return { success: false, latencyMs: 0, message: String(err) };
    }
  },

  testAllMcpServers: async () => {
    set({ isTestingAllMcp: true });
    const { mcpServers } = useEcosystemStore.getState();
    const updatedServers = [...mcpServers];

    for (let i = 0; i < updatedServers.length; i++) {
      const server = updatedServers[i];
      set({ testingMcpId: server.id });
      try {
        const res = await ecosystemService.testMcpServer(server.id);
        updatedServers[i] = {
          ...server,
          status: res.status,
          lastPingMs: res.latencyMs,
          lastChecked: Date.now(),
          errorMessage: res.success ? undefined : res.message,
        };
      } catch (err: any) {
        updatedServers[i] = {
          ...server,
          status: 'error',
          lastChecked: Date.now(),
          errorMessage: String(err?.message || err),
        };
      }
      set({ mcpServers: [...updatedServers] });
    }

    set({ isTestingAllMcp: false, testingMcpId: null });
  },

  saveRule: async (rule) => {
    try {
      const saved = await ecosystemService.saveRule(rule);
      set((state) => {
        const existingIdx = state.rules.findIndex((r) => r.id === rule.id);
        if (existingIdx >= 0) {
          const next = [...state.rules];
          next[existingIdx] = saved;
          return { rules: next };
        }
        return { rules: [saved, ...state.rules] };
      });
      return true;
    } catch (err) {
      console.error('[useEcosystemStore] Save Rule failed:', err);
      return false;
    }
  },

  toggleRule: async (ruleId, enabled) => {
    await ecosystemService.toggleRule(ruleId, enabled);
    set((state) => ({
      rules: state.rules.map((r) => (r.id === ruleId ? { ...r, isEnabled: enabled } : r)),
    }));
  },
}));
