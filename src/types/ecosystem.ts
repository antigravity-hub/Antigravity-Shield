export type EcosystemEntityType = 'skills' | 'mcp' | 'rules';

export type SkillCategory =
  | 'all'
  | 'coding'
  | 'design'
  | 'mobile'
  | 'data'
  | 'devops'
  | 'testing'
  | 'automation'
  | 'architecture'
  | 'marketing'
  | 'science';

export type SkillDomain = Exclude<SkillCategory, 'all'>;
export type SkillCategoryFilter = SkillCategory;

export type SkillSourceType = 'skills.sh' | 'github' | 'local';
export type SkillSource = SkillSourceType;

export type SkillRiskLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SkillAuditStatus = 'pass' | 'warn' | 'fail' | 'unverified';

export type SkillSortOption = 'popular' | 'trending' | 'name' | 'recent' | 'stars';
export type SkillStatusFilter = 'all' | 'installed' | 'available' | 'official' | 'local';

export interface SkillFileEntry {
  path: string;            // Relative path, e.g. "SKILL.md", "scripts/test.py"
  contents?: string;       // File contents (when downloaded)
  sizeBytes?: number;      // File size in bytes
  sha256?: string;         // SHA-256 hash of this file
}

export interface SkillAuditEntry {
  provider: string;        // e.g. "Socket", "Snyk", "Gen Agent Trust Hub", "Runlayer", "ZeroLeaks"
  status: 'pass' | 'warn' | 'fail';
  riskLevel: SkillRiskLevel;
  summary: string;
  auditedAt: string;       // ISO 8601 timestamp
}

export type AgentPlatformId =
  | 'all'
  | 'antigravity'
  | 'claude-code'
  | 'cursor'
  | 'codex'
  | 'github-copilot'
  | 'windsurf'
  | 'gemini'
  | 'cline'
  | 'amp'
  | 'openclaw'
  | 'droid'
  | 'goose'
  | 'kilo'
  | 'kiro-cli'
  | 'nous-research'
  | 'opencode'
  | 'roo'
  | 'trae'
  | 'vscode'
  | 'zed';

export interface AgentPlatformInfo {
  id: AgentPlatformId;
  name: string;
  tagline: string;
  description: string;
  isAntigravityTarget?: boolean;
}

export type SkillTopicId =
  | 'all'
  | 'frontend-react'
  | 'nextjs'
  | 'design-ui'
  | 'mobile'
  | 'agent-workflows'
  | 'databases'
  | 'testing'
  | 'marketing';

export interface SkillTopicInfo {
  id: SkillTopicId;
  title: string;
  description: string;
  skillsCount: number;
}

export type SecurityAuditFilter =
  | 'all'
  | 'passed_only'
  | 'gen_trust_hub_pass'
  | 'socket_pass'
  | 'snyk_pass'
  | 'snyk_warn';

export interface SkillPrerequisites {
  envVars?: string[];       // e.g. ["TAVILY_API_KEY"]
  cliCommands?: string[];   // e.g. ["npm i -g @tavily/cli", "tvly login"]
  allowedTools?: string[];  // e.g. ["Bash(agent-browser:*)", "Bash(tvly *)"]
  dependencies?: string[];  // e.g. ["@tavily/core", "playwright"]
  notes?: string;           // Brief human guidance
}

export interface SkillManifestMetadata {
  repoUrl?: string;          // e.g. "https://github.com/vercel-labs/skills"
  rawManifestUrl?: string;   // e.g. "https://raw.githubusercontent.com/vercel-labs/skills/main/skills/find-skills/SKILL.md"
  branch?: string;           // e.g. "main"
  skillDir?: string;         // e.g. "skills/find-skills" or "skills/productivity/grill-me"
  companionFiles?: string[]; // e.g. ["scripts/accept_changes.py", "references/crawl.md"]
  prerequisites?: SkillPrerequisites;
  isUpstreamLive?: boolean;  // true if verified live public repo
}

export interface SkillItem extends SkillManifestMetadata {
  id: string;              // Unique identifier, e.g. "vercel-labs/skills/find-skills"
  slug?: string;           // URL-safe slug, e.g. "find-skills"
  name: string;            // Normalized name, e.g. "find-skills"
  title: string;           // Display title, e.g. "Find Skills"
  owner?: string;          // Repository owner, e.g. "vercel-labs"
  repo?: string;           // Repository name, e.g. "skills"
  description: string;     // Procedural description
  category: SkillCategory;
  author: string;          // Author or organization
  version: string;         // Semantic version string
  icon?: string;           // Lucide icon identifier
  triggers?: string[];     // Array of triggers, e.g. ["/find-skills", "search skills"]
  scope?: 'global' | 'workspace'; // Scope

  // Metrics & Badges
  installs?: number | string;       // Total install count (from Skills.sh telemetry, e.g. 1300000 or "1.3M")
  stars?: number | string;          // GitHub stars count (e.g. 8200 or "289.5K")
  firstSeen?: string;               // First seen date on skills.sh (e.g. "Mar 13, 2026")
  weeklyInstalls?: string;          // Weekly installs sparkline data
  repository?: string;              // GitHub repository link
  isOfficial?: boolean;    // Verified official maker badge
  isVerifiedMaker?: boolean; // Verified rosette checkmark badge next to install count
  auditStatus?: SkillAuditStatus;
  audits?: SkillAuditEntry[];

  // Agent & Topic Compatibility
  supportedAgents?: string[]; // IDs of supported agents, defaults to all 20 agents (including Antigravity)
  topics?: string[];          // Topic identifiers, e.g. ['frontend-react', 'agent-workflows']

  // Lifecycle & Installation State
  isInstalled: boolean;    // Installed on user's machine
  isEnabled: boolean;      // Active in prompt injection
  isLocal?: boolean;       // Scanned from local filesystem vs remote catalog
  sourceType?: SkillSourceType;
  source?: SkillSourceType;
  installPath?: string;    // Absolute path on disk
  localPath?: string;      // Compatibility alias for installPath
  remoteUrl?: string;      // skills.sh web page or github repo URL
  downloadUrl?: string;    // Direct bundle or API download URL
  sourceUrl?: string;      // Compatibility alias for remoteUrl

  // Integrity & Content
  sha256?: string;         // Bundle SHA-256 fingerprint
  content?: string;        // Inlined SKILL.md content
  files?: SkillFileEntry[];
  dependencies?: string[];
  tags: string[];          // Search & taxonomy tags
  installedAt?: string;    // ISO timestamp of local install

  // Rich Architectural Documentation & Multi-Language Enrichment
  isEnriched?: boolean;    // Completion flag: true when comprehensive documentation is attached
  targetRole?: 'frontend' | 'backend' | 'fullstack' | 'devops' | 'design' | 'data' | 'architecture' | 'science' | 'automation';
  criticality?: 'critical' | 'recommended' | 'specialized';
  docsMarkdown?: {
    en: string;
    fa: string;
  };
}

export type McpTransport = 'stdio' | 'sse' | 'websocket';

export interface McpToolInfo {
  name: string;
  description: string;
}

export interface McpRequirementInfo {
  binary?: string;
  envVars?: string[];
  description?: string;
}

export interface McpServerItem {
  id: string;
  name: string;
  title: string;
  description: string;
  category: string;
  author: string;
  transport: McpTransport;
  command: string;
  args: string[];
  env: Record<string, string>;
  isInstalled: boolean;
  isEnabled: boolean;
  status: 'connected' | 'disconnected' | 'testing' | 'error' | 'needs_config';
  lastPingMs?: number;
  lastChecked?: number;
  errorMessage?: string;
  toolCount?: number;
  tools?: McpToolInfo[];
  requirements?: McpRequirementInfo;
  sourceUrl?: string;
  official: boolean;
}

export interface RuleItem {
  id: string;
  title: string;
  fileName: string;
  path: string;
  scope: 'global' | 'workspace';
  trigger: 'always_on' | 'model_decision';
  description: string;
  content: string;
  isEnabled: boolean;
  updatedAt: string;
}

export interface WorkspaceExclusion {
  entityType: EcosystemEntityType;
  entityId: string;
  workspacePath: string;
  disabled: boolean;
}
