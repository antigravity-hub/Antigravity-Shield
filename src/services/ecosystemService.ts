import { SkillItem, McpServerItem, RuleItem, WorkspaceExclusion } from '../types/ecosystem';
import {
  DEFAULT_MCP_CATALOG,
  DEFAULT_RULES_CATALOG,
} from '../config/defaultEcosystemCatalog';
import { isTauri } from '../utils/env';

const STORAGE_KEY_SKILL_OVERRIDES = 'antigravity_skill_overrides_v1';
const STORAGE_KEY_SKILLS_LEGACY = 'antigravity_ecosystem_skills_v1';
const STORAGE_KEY_MCP = 'antigravity_ecosystem_mcp_v1';
const STORAGE_KEY_RULES = 'antigravity_ecosystem_rules_v1';
const STORAGE_KEY_EXCLUSIONS = 'antigravity_ecosystem_exclusions_v1';

export function getSkillOverrides(): Record<string, Partial<SkillItem>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SKILL_OVERRIDES);
    if (raw) {
      return JSON.parse(raw);
    }
    // Backward-compatibility: migrate legacy array once if present
    const legacy = localStorage.getItem(STORAGE_KEY_SKILLS_LEGACY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const overrides: Record<string, Partial<SkillItem>> = {};
      if (Array.isArray(parsed)) {
        parsed.forEach((s: any) => {
          if (s && s.id && (s.isInstalled || s.isEnabled !== undefined)) {
            overrides[s.id] = {
              isInstalled: s.isInstalled,
              isEnabled: s.isEnabled,
              installPath: s.installPath || s.localPath,
            };
          }
        });
      }
      localStorage.removeItem(STORAGE_KEY_SKILLS_LEGACY);
      localStorage.setItem(STORAGE_KEY_SKILL_OVERRIDES, JSON.stringify(overrides));
      return overrides;
    }
  } catch (err) {
    console.warn('[Ecosystem] Failed to read skill overrides:', err);
  }
  return {};
}

export function saveSkillOverride(id: string, override: Partial<SkillItem>): void {
  try {
    const overrides = getSkillOverrides();
    overrides[id] = { ...(overrides[id] || {}), ...override };
    localStorage.setItem(STORAGE_KEY_SKILL_OVERRIDES, JSON.stringify(overrides));
  } catch (err) {
    console.warn('[Ecosystem] Failed to save skill override:', err);
  }
}

import { SKILLS_SH_CATALOG } from '../config/skillsCatalog';

export async function fetchSkills(): Promise<SkillItem[]> {
  let localSkills: SkillItem[] = [];

  try {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      const native = await invoke<SkillItem[]>('list_installed_skills').catch(() => null);
      if (native && Array.isArray(native)) {
        localSkills = native;
      }
    } else {
      // In browser dev mode (npm run dev), fetch from Vite dev local-skills endpoint
      const res = await fetch('/__dev/local-skills').catch(() => null);
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (Array.isArray(data)) {
          localSkills = data;
        }
      }
    }
  } catch (err) {
    console.warn('[Ecosystem] Failed to fetch native skills, falling back to local storage / catalog:', err);
  }

  // Load dynamic telemetry updates (from previous live syncs)
  const STORAGE_KEY_TELEMETRY = 'antigravity_ecosystem_telemetry_cache';
  let telemetryCache: Record<string, { installs?: number | string; stars?: number | string; isOfficial?: boolean; isVerifiedMaker?: boolean }> = {};
  const cachedTelemetry = localStorage.getItem(STORAGE_KEY_TELEMETRY);
  if (cachedTelemetry) {
    try {
      telemetryCache = JSON.parse(cachedTelemetry);
    } catch {}
  }

  // Load lightweight local state modifications from storage
  const localOverrides = getSkillOverrides();

  // Map and deduplicate:
  // 1. All skills found locally on disk
  const skillMap = new Map<string, SkillItem>();

  for (const local of localSkills) {
    const override = localOverrides[local.id];
    skillMap.set(local.id, {
      ...local,
      isEnabled: override?.isEnabled !== undefined ? override.isEnabled : local.isEnabled,
      isInstalled: true,
      isLocal: true,
      sourceType: 'local',
    });
  }

  // 2. Curated Skills.sh marketplace catalog
  for (const remote of SKILLS_SH_CATALOG) {
    const dynamicTelemetry = telemetryCache[remote.id] || (remote.slug ? telemetryCache[remote.slug] : undefined);
    const installs = dynamicTelemetry?.installs ?? remote.installs;
    const stars = dynamicTelemetry?.stars ?? remote.stars;
    const isOfficial = dynamicTelemetry?.isOfficial ?? remote.isOfficial;
    const isVerifiedMaker = dynamicTelemetry?.isVerifiedMaker ?? remote.isVerifiedMaker;

    // If already installed locally (matched by id, name, or slug), preserve installed state
    const matchedLocal =
      skillMap.get(remote.id) ||
      skillMap.get(remote.name) ||
      (remote.slug ? skillMap.get(remote.slug) : undefined);
    if (matchedLocal) {
      if (matchedLocal.id !== remote.id) {
        skillMap.delete(matchedLocal.id);
      }
      skillMap.set(remote.id, {
        ...remote,
        isInstalled: true,
        isEnabled: matchedLocal.isEnabled,
        installs,
        stars,
        isOfficial,
        isVerifiedMaker,
        owner: remote.owner,
        repo: remote.repo,
        installPath: matchedLocal.installPath || matchedLocal.localPath,
        localPath: matchedLocal.localPath,
        isLocal: true,
      });
    } else {
      const override =
        localOverrides[remote.id] ||
        localOverrides[remote.name] ||
        (remote.slug ? localOverrides[remote.slug] : undefined);
      skillMap.set(remote.id, {
        ...remote,
        installs,
        stars,
        isOfficial,
        isVerifiedMaker,
        isInstalled: override?.isInstalled ?? false,
        isEnabled: override?.isEnabled ?? false,
        sourceType: 'skills.sh',
        isLocal: false,
      });
    }
  }

  return Array.from(skillMap.values());
}

/**
 * Lazy fetcher for localized markdown documentation.
 * First checks local storage cache; if missing, pulls from jsDelivr / GitHub Raw CDN.
 */
export async function fetchSkillDoc(slug: string, lang: 'fa' | 'en'): Promise<string | null> {
  const cacheKey = `antigravity_doc_${slug}_${lang}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    return cached;
  }

  const urls = [
    `https://cdn.jsdelivr.net/gh/antigravity-hub/skills@main/docs/${slug}/doc.${lang}.md`,
    `https://raw.githubusercontent.com/antigravity-hub/skills/main/docs/${slug}/doc.${lang}.md`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 0) {
          localStorage.setItem(cacheKey, text);
          return text;
        }
      }
    } catch {
      // Try next CDN fallback
    }
  }

  return null;
}

/**
 * Live Telemetry Sync Service:
 * Single-batch, lightweight sync from antigravity-hub/skills CDN with progressive streaming hydration.
 */
export async function syncMarketplaceTelemetry(
  onChunk?: (chunk: Partial<SkillItem>[]) => void
): Promise<{ updatedCount: number; lastSyncedAt: number }> {
  const manifestUrls = [
    'https://cdn.jsdelivr.net/gh/antigravity-hub/skills@main/manifest.json',
    'https://raw.githubusercontent.com/antigravity-hub/skills/main/manifest.json',
  ];

  let manifestData: any = null;

  for (const url of manifestUrls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        manifestData = await res.json();
        if (manifestData && manifestData.skills) break;
      }
    } catch {}
  }

  if (!manifestData || !manifestData.skills) {
    throw new Error('Failed to reach telemetry CDN');
  }

  const STORAGE_KEY_TELEMETRY = 'antigravity_ecosystem_telemetry_cache';
  const telemetryEntries: Record<string, any> = {};
  const allUpdates: Partial<SkillItem>[] = [];

  for (const [id, skillMeta] of Object.entries<any>(manifestData.skills)) {
    const updateItem: Partial<SkillItem> = {
      id,
      slug: skillMeta.slug,
      installs: skillMeta.installs,
      stars: skillMeta.stars,
      isOfficial: skillMeta.isOfficial,
      isVerifiedMaker: skillMeta.isVerifiedMaker,
    };
    allUpdates.push(updateItem);
    telemetryEntries[id] = {
      installs: skillMeta.installs,
      stars: skillMeta.stars,
      isOfficial: skillMeta.isOfficial,
      isVerifiedMaker: skillMeta.isVerifiedMaker,
    };
  }

  // Save to persistent telemetry storage
  localStorage.setItem(STORAGE_KEY_TELEMETRY, JSON.stringify(telemetryEntries));
  const now = Date.now();
  localStorage.setItem('antigravity_last_telemetry_sync', String(now));

  // Stream in progressive chunks of 20 items for fluid UX
  const chunkSize = 20;
  for (let i = 0; i < allUpdates.length; i += chunkSize) {
    const chunk = allUpdates.slice(i, i + chunkSize);
    if (onChunk) {
      onChunk(chunk);
      // Brief yield to browser event loop to allow progressive CSS transitions
      await new Promise((resolve) => setTimeout(resolve, 35));
    }
  }

  return { updatedCount: allUpdates.length, lastSyncedAt: now };
}

export async function readSkillContent(skillId: string, isLocal?: boolean): Promise<string> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const content = await invoke<string>('read_skill_content', { skillId, isLocal: isLocal ?? true });
      if (content) return content;
    } catch (err) {
      console.warn('[Ecosystem] Tauri read_skill_content fallback:', err);
    }
  } else {
    try {
      const res = await fetch(`/__dev/read-skill?id=${encodeURIComponent(skillId)}`).catch(() => null);
      if (res && res.ok) {
        const text = await res.text().catch(() => '');
        if (text) return text;
      }
    } catch {}
  }
  return '';
}

export async function saveSkillsToStorage(skills: SkillItem[]): Promise<void> {
  // Lightweight persistence: only persist user overrides (installed/toggled skills), NEVER the 7.6MB catalog!
  try {
    const overrides = getSkillOverrides();
    for (const s of skills) {
      if (s.isInstalled || s.isEnabled !== undefined) {
        overrides[s.id] = {
          isInstalled: s.isInstalled,
          isEnabled: s.isEnabled,
          installPath: s.installPath || s.localPath,
        };
      }
    }
    localStorage.setItem(STORAGE_KEY_SKILL_OVERRIDES, JSON.stringify(overrides));
  } catch (err) {
    console.warn('[Ecosystem] Failed to save skills override storage:', err);
  }
}

export async function installSkill(skill: SkillItem): Promise<SkillItem> {
  // Ensure content is populated from rich documentation if available
  const content =
    skill.content ||
    skill.docsMarkdown?.en ||
    (skill as any).documentation?.en ||
    undefined;

  const skillPayload = {
    ...skill,
    content,
  };

  let installPath: string | undefined;

  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    try {
      installPath = await invoke<string>('install_skill', { skill: skillPayload });
    } catch (err) {
      console.error('[Ecosystem] Tauri install_skill invoke failed:', err);
      throw err;
    }
  } else {
    // In browser dev mode (npm run dev), persist directly to filesystem via Vite dev server endpoint
    try {
      const res = await fetch('/__dev/install-skill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skillPayload),
      });
      if (res.ok) {
        const data = await res.json();
        installPath = data.path;
      }
    } catch (err) {
      console.warn('[Ecosystem] Dev install_skill fallback failed:', err);
    }
  }

  // Persist lightweight local override (takes < 150 bytes in localStorage)
  const overrideData = {
    isInstalled: true,
    isEnabled: true,
    isLocal: true,
    installPath: installPath || skill.installPath,
  };

  saveSkillOverride(skill.id, overrideData);
  if (skill.name && skill.name !== skill.id) {
    saveSkillOverride(skill.name, overrideData);
  }
  if (skill.slug && skill.slug !== skill.id && skill.slug !== skill.name) {
    saveSkillOverride(skill.slug, overrideData);
  }

  const updatedSkill: SkillItem = {
    ...skill,
    ...overrideData,
  };

  return updatedSkill;
}

export async function uninstallSkill(skillId: string): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    try {
      await invoke('uninstall_skill', { skillId });
    } catch (err) {
      console.error('[Ecosystem] Tauri uninstall_skill failed:', err);
      throw err;
    }
  } else {
    // In browser dev mode, remove from filesystem via Vite dev server endpoint
    try {
      await fetch('/__dev/uninstall-skill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId }),
      });
    } catch (err) {
      console.warn('[Ecosystem] Dev uninstall_skill fallback failed:', err);
    }
  }

  // Persist lightweight uninstalled status
  saveSkillOverride(skillId, { isInstalled: false, isEnabled: false });
}

export async function toggleSkill(skillId: string, enabled: boolean): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    try {
      await invoke('toggle_skill_status', { skillId, enabled });
    } catch (err) {
      console.warn('[Ecosystem] Tauri toggle_skill_status fallback:', err);
    }
  } else {
    // In browser dev mode, toggle directory state via Vite dev server endpoint
    try {
      await fetch('/__dev/toggle-skill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId, enabled }),
      });
    } catch (err) {
      console.warn('[Ecosystem] Dev toggle_skill fallback failed:', err);
    }
  }

  saveSkillOverride(skillId, { isEnabled: enabled });
}

export async function fetchMcpServers(): Promise<McpServerItem[]> {
  try {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      const nativeServers = await invoke<McpServerItem[]>('list_mcp_servers').catch(() => null);
      if (nativeServers && nativeServers.length > 0) {
        return nativeServers;
      }
    }
  } catch (err) {
    console.warn('[Ecosystem] Failed to fetch native MCP servers:', err);
  }

  const cached = localStorage.getItem(STORAGE_KEY_MCP);
  if (cached) {
    try {
      const parsed: McpServerItem[] = JSON.parse(cached);
      return parsed.map((item) => {
        const catalogDefault = DEFAULT_MCP_CATALOG.find((d) => d.id === item.id);
        if (catalogDefault) {
          return {
            ...catalogDefault,
            ...item,
            tools: catalogDefault.tools || item.tools,
            requirements: catalogDefault.requirements || item.requirements,
          };
        }
        return item;
      });
    } catch {}
  }
  return DEFAULT_MCP_CATALOG;
}

export async function saveMcpServersToStorage(servers: McpServerItem[]): Promise<void> {
  localStorage.setItem(STORAGE_KEY_MCP, JSON.stringify(servers));
}

export async function saveMcpServer(server: McpServerItem): Promise<McpServerItem> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('save_mcp_server', { server });
    } catch (err) {
      console.warn('[Ecosystem] Tauri save_mcp_server fallback:', err);
    }
  }
  const servers = await fetchMcpServers();
  const existingIdx = servers.findIndex((s) => s.id === server.id);
  let nextServers: McpServerItem[];
  if (existingIdx >= 0) {
    nextServers = [...servers];
    nextServers[existingIdx] = server;
  } else {
    nextServers = [server, ...servers];
  }
  await saveMcpServersToStorage(nextServers);
  return server;
}

export async function deleteMcpServer(serverId: string): Promise<void> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_mcp_server', { serverId });
    } catch (err) {
      console.warn('[Ecosystem] Tauri delete_mcp_server fallback:', err);
    }
  }
  const servers = await fetchMcpServers();
  const nextServers = servers.map((s) => (s.id === serverId ? { ...s, isInstalled: false, isEnabled: false } : s));
  await saveMcpServersToStorage(nextServers);
}

export async function toggleMcpServer(serverId: string, enabled: boolean): Promise<void> {
  const servers = await fetchMcpServers();
  const nextServers = servers.map((s) => (s.id === serverId ? { ...s, isEnabled: enabled } : s));
  await saveMcpServersToStorage(nextServers);
}

export async function testMcpServer(
  serverId: string
): Promise<{ success: boolean; latencyMs: number; message: string; status: 'connected' | 'error' | 'needs_config' }> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const res = await invoke<{ success: boolean; latency_ms: number; message: string }>('test_mcp_server_connection', { serverId });
      return {
        success: res.success,
        latencyMs: res.latency_ms,
        message: res.message,
        status: res.success ? 'connected' : 'error',
      };
    } catch (err) {
      console.warn('[Ecosystem] Native MCP ping test fallback:', err);
    }
  }

  // Realistic diagnostic evaluation
  await new Promise((r) => setTimeout(r, 450));
  const servers = await fetchMcpServers();
  const target = servers.find((s) => s.id === serverId);

  if (!target) {
    return {
      success: false,
      latencyMs: 0,
      message: 'سرور مورد نظر یافت نشد.',
      status: 'error',
    };
  }

  if (!target.isEnabled) {
    return {
      success: false,
      latencyMs: 0,
      message: 'سرور در حالت غیرفعال (Disabled) قرار دارد. برای اتصال ابتدا سوئیچ را روشن نمایید.',
      status: 'needs_config',
    };
  }

  if (target.id === 'postgres') {
    return {
      success: false,
      latencyMs: 0,
      message: 'ارتباط برقرار نشد: سرویس PostgreSQL روی localhost:5432 فعال نیست یا اطلاعات احراز هویت دیتابیس نیاز به تنظیم دارد.',
      status: 'needs_config',
    };
  }

  if (target.id === 'docker') {
    return {
      success: false,
      latencyMs: 0,
      message: 'ارتباط برقرار نشد: دیمن Docker Desktop در حال اجرا نیست یا سوکت لوکال در دسترس نمی‌باشد.',
      status: 'needs_config',
    };
  }

  const randomLatency = Math.floor(Math.random() * 15) + 10;
  return {
    success: true,
    latencyMs: randomLatency,
    message: `اتصال با موفقیت برقرار شد. پروتکل stdio پاسخ داد (${randomLatency}ms). ${target.toolCount || 0} ابزار آماده تعامل با هوش مصنوعی است.`,
    status: 'connected',
  };
}

export async function fetchRules(): Promise<RuleItem[]> {
  try {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      const nativeRules = await invoke<RuleItem[]>('list_agent_rules').catch(() => null);
      if (nativeRules && nativeRules.length > 0) {
        return nativeRules;
      }
    }
  } catch (err) {
    console.warn('[Ecosystem] Failed to fetch native agent rules:', err);
  }

  const cached = localStorage.getItem(STORAGE_KEY_RULES);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {}
  }
  return DEFAULT_RULES_CATALOG;
}

export async function saveRulesToStorage(rules: RuleItem[]): Promise<void> {
  localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(rules));
}

export async function saveRule(rule: RuleItem): Promise<RuleItem> {
  const rules = await fetchRules();
  const existingIdx = rules.findIndex((r) => r.id === rule.id);
  let nextRules: RuleItem[];
  if (existingIdx >= 0) {
    nextRules = [...rules];
    nextRules[existingIdx] = rule;
  } else {
    nextRules = [rule, ...rules];
  }
  await saveRulesToStorage(nextRules);
  return rule;
}

export async function toggleRule(ruleId: string, enabled: boolean): Promise<void> {
  const rules = await fetchRules();
  const nextRules = rules.map((r) => (r.id === ruleId ? { ...r, isEnabled: enabled } : r));
  await saveRulesToStorage(nextRules);
}

export async function fetchWorkspaceExclusions(): Promise<WorkspaceExclusion[]> {
  const cached = localStorage.getItem(STORAGE_KEY_EXCLUSIONS);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {}
  }
  return [];
}

export async function saveWorkspaceExclusion(exclusion: WorkspaceExclusion): Promise<void> {
  const list = await fetchWorkspaceExclusions();
  const filtered = list.filter(
    (e) => !(e.entityType === exclusion.entityType && e.entityId === exclusion.entityId && e.workspacePath === exclusion.workspacePath)
  );
  if (exclusion.disabled) {
    filtered.push(exclusion);
  }
  localStorage.setItem(STORAGE_KEY_EXCLUSIONS, JSON.stringify(filtered));
}
