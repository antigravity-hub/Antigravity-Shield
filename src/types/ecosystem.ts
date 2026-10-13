export type EcosystemEntityType = 'skills' | 'mcp' | 'rules';

export type SkillCategory =
  | 'coding'
  | 'design'
  | 'devops'
  | 'data'
  | 'automation'
  | 'science'
  | 'architecture'
  | 'all';

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

export interface SkillItem {
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
  installs?: number;       // Total install count (from Skills.sh telemetry)
  stars?: number;          // GitHub stars count
  isOfficial?: boolean;    // Verified official maker badge
  auditStatus?: SkillAuditStatus;
  audits?: SkillAuditEntry[];

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
