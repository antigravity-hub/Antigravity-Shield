/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Repository: https://github.com/antigravity-hub/Antigravity-Shield
 */
import { SkillItem, SkillPrerequisites, SkillManifestMetadata } from '../types/ecosystem';

export interface ExtendedSkillManifestMetadata extends SkillManifestMetadata {
  candidateRawUrls?: string[];
}

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  repoUrl: string;
  embeddedBranch?: string;
  embeddedDir?: string;
}

/**
 * Mapping of known authoritative skill hubs on GitHub.
 */
interface HubConfig {
  owner: string;
  repo: string;
  defaultBranch: string;
  resolvePath: (slugOrName: string) => {
    skillDir: string;
    companionFiles?: string[];
  };
}

const KNOWN_HUBS: Record<string, HubConfig> = {
  'vercel-labs/skills': {
    owner: 'vercel-labs',
    repo: 'skills',
    defaultBranch: 'main',
    resolvePath: (slug) => ({
      skillDir: `skills/${slug}`,
    }),
  },
  'vercel-labs/agent-browser': {
    owner: 'vercel-labs',
    repo: 'agent-browser',
    defaultBranch: 'main',
    resolvePath: () => ({
      skillDir: 'skills/agent-browser',
      companionFiles: [
        'skill-data/core/references/index.md',
        'skill-data/core/templates/setup.sh',
      ],
    }),
  },
  'anthropics/skills': {
    owner: 'anthropics',
    repo: 'skills',
    defaultBranch: 'main',
    resolvePath: (slug) => {
      const companions: Record<string, string[]> = {
        docx: ['scripts/office/soffice.py'],
        xlsx: ['scripts/recalc.py'],
      };
      return {
        skillDir: `skills/${slug}`,
        companionFiles: companions[slug],
      };
    },
  },
  'mattpocock/skills': {
    owner: 'mattpocock',
    repo: 'skills',
    defaultBranch: 'main',
    resolvePath: (slug) => {
      const normalized = (slug || '').toLowerCase().trim();
      // Matt Pocock's monorepo partitions skills into categorized subdirectories
      const engineeringSkills = new Set([
        'implement',
        'code-review',
        'tdd',
        'diagnosing-bugs',
        'verification',
        'systematic-refactoring',
      ]);
      const productivitySkills = new Set([
        'grill-me',
        'teach',
        'handoff',
        'grilling',
        'plan-execution',
      ]);

      if (engineeringSkills.has(normalized)) {
        return { skillDir: `skills/engineering/${normalized}` };
      }
      if (productivitySkills.has(normalized)) {
        return { skillDir: `skills/productivity/${normalized}` };
      }
      // Default guess
      return { skillDir: `skills/productivity/${normalized}` };
    },
  },
  'obra/superpowers': {
    owner: 'obra',
    repo: 'superpowers',
    defaultBranch: 'main',
    resolvePath: (slug) => ({
      skillDir: `skills/${slug}`,
      companionFiles:
        slug === 'brainstorming'
          ? ['scripts/frame-template.html', 'scripts/helper.js']
          : undefined,
    }),
  },
  'tavily-ai/skills': {
    owner: 'tavily-ai',
    repo: 'skills',
    defaultBranch: 'main',
    resolvePath: (slug) => {
      const normalized = (slug || '').toLowerCase().trim();
      // Upstream tavily-ai/skills partitions:
      // core: tavily-search
      // developers: tavily-sdk
      // tasks: tavily-research, tavily-entity, tavily-list, tavily-monitor
      const coreSkills = new Set(['tavily-search', 'search']);
      const devSkills = new Set(['tavily-sdk', 'sdk']);
      const taskSkills = new Set([
        'tavily-research',
        'tavily-ai-research-agent-loops',
        'research',
        'tavily-entity',
        'tavily-list',
        'tavily-monitor',
      ]);

      let skillDir = `skills/tasks/${normalized}`;
      if (coreSkills.has(normalized)) {
        skillDir = `skills/core/${normalized}`;
      } else if (devSkills.has(normalized)) {
        skillDir = `skills/developers/${normalized}`;
      } else if (taskSkills.has(normalized)) {
        const cleanTask = normalized === 'tavily-ai-research-agent-loops' ? 'tavily-research' : normalized;
        skillDir = `skills/tasks/${cleanTask}`;
      } else {
        skillDir = `skills/${normalized}`;
      }

      return {
        skillDir,
        companionFiles: [
          'references/crawl.md',
          'references/extract.md',
          'references/research.md',
        ],
      };
    },
  },
};

/**
 * Science and local plugin prefixes that do NOT exist on external GitHub.
 */
const NON_UPSTREAM_PREFIXES = [
  'deepmind/alphafold',
  'ebi-chembl/',
  'ncbi/',
  'broadinstitute/gtex',
  'rcsb/pdb',
  'open.feishu.cn/',
  'uizze.sh/',
];

/**
 * Validates GitHub owner and repository naming conventions.
 */
export function isValidGitHubIdentifier(owner: string, repo: string): boolean {
  if (!owner || !repo) return false;
  // GitHub usernames: 1-39 alphanumeric characters or single hyphens (cannot begin or end with hyphen)
  const validOwner = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(owner);
  // GitHub repo names: 1-100 alphanumeric, hyphens, underscores, dots (cannot be . or ..)
  const validRepo = /^[a-zA-Z0-9_\-\.]{1,100}$/.test(repo) && repo !== '.' && repo !== '..';
  return validOwner && validRepo;
}

/**
 * Dynamically extracts verified GitHub repository coordinates from any SkillItem field.
 */
export function parseGitHubRepoInfo(skill: SkillItem): GitHubRepoInfo | null {
  if (skill.isLocal) return null;

  const id = (skill.id || '').toLowerCase();
  for (const prefix of NON_UPSTREAM_PREFIXES) {
    if (id.startsWith(prefix)) return null;
  }

  // Priority 1: Direct owner & repo properties
  if (skill.owner && skill.repo) {
    const owner = skill.owner.trim();
    const repo = skill.repo.trim();
    if (isValidGitHubIdentifier(owner, repo)) {
      return {
        owner,
        repo,
        repoUrl: `https://github.com/${owner}/${repo}`,
      };
    }
  }

  // Priority 2: Extract from skill.repository, skill.repoUrl, or skill.remoteUrl
  const repoCandidates = [skill.repository, skill.repoUrl, skill.remoteUrl].filter(Boolean) as string[];
  for (const candidate of repoCandidates) {
    // Matches https://github.com/owner/repo or git@github.com:owner/repo
    const ghMatch = candidate.match(
      /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+?)(?:\.git|\/)?(?:$|\/|\?|#)/i
    );
    if (ghMatch) {
      const owner = ghMatch[1];
      const repo = ghMatch[2].replace(/\.git$/, '');
      if (isValidGitHubIdentifier(owner, repo)) {
        // Check for embedded tree/blob branch and subdirectory
        const treeMatch = candidate.match(/\/(?:tree|blob)\/([a-zA-Z0-9_\-\.]+)\/(.+)$/);
        return {
          owner,
          repo,
          repoUrl: `https://github.com/${owner}/${repo}`,
          embeddedBranch: treeMatch ? treeMatch[1] : undefined,
          embeddedDir: treeMatch ? treeMatch[2].replace(/\/SKILL\.md$/i, '') : undefined,
        };
      }
    }

    // Matches https://skills.sh/owner/repo or skills.sh/owner/repo/slug
    const skillsShMatch = candidate.match(
      /(?:https?:\/\/)?(?:www\.)?skills\.sh\/([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+?)(?:\/([a-zA-Z0-9_\-\.]+))?(?:$|\/|\?|#)/i
    );
    if (skillsShMatch) {
      const owner = skillsShMatch[1];
      const repo = skillsShMatch[2];
      if (isValidGitHubIdentifier(owner, repo)) {
        return {
          owner,
          repo,
          repoUrl: `https://github.com/${owner}/${repo}`,
        };
      }
    }
  }

  // Priority 3: Extract from nativeInstallCmd (e.g. npx skills add owner/repo --skill slug)
  if (skill.nativeInstallCmd) {
    const cmdMatch = skill.nativeInstallCmd.match(
      /npx\s+skills\s+add\s+([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+)/i
    );
    if (cmdMatch) {
      const owner = cmdMatch[1];
      const repo = cmdMatch[2];
      if (isValidGitHubIdentifier(owner, repo)) {
        return {
          owner,
          repo,
          repoUrl: `https://github.com/${owner}/${repo}`,
        };
      }
    }
  }

  // Priority 4: Parse from 3-part ID (owner/repo/slug)
  if (skill.id && skill.id.includes('/')) {
    const parts = skill.id.split('/');
    if (parts.length >= 3) {
      const owner = parts[0];
      const repo = parts[1];
      if (isValidGitHubIdentifier(owner, repo)) {
        return {
          owner,
          repo,
          repoUrl: `https://github.com/${owner}/${repo}`,
        };
      }
    }
  }

  return null;
}

/**
 * Resolves candidate directory locations for a skill within an upstream repository.
 */
export function resolveCandidateSkillDirs(
  _owner: string,
  repo: string,
  cleanSlug: string,
  embeddedDir?: string
): string[] {
  const dirs: string[] = [];

  // 1. Explicit embedded directory from URL
  if (embeddedDir) {
    dirs.push(embeddedDir.replace(/^\/|\/$/g, ''));
  }

  const normalizedRepo = repo.toLowerCase();
  const normalizedSlug = cleanSlug.toLowerCase();

  // 2. Monorepo standard: skills/<slug>
  dirs.push(`skills/${cleanSlug}`);

  // 3. Dedicated single-skill repo: root or <slug>
  if (normalizedRepo === normalizedSlug || normalizedSlug === 'index') {
    dirs.push(''); // Root-level: SKILL.md
    dirs.push(cleanSlug);
  } else {
    dirs.push(cleanSlug);
    dirs.push(''); // Root fallback
  }

  // 4. Dot-directory agent convention
  dirs.push(`.gemini/skills/${cleanSlug}`);
  dirs.push(`.agents/skills/${cleanSlug}`);
  dirs.push(`.claude/skills/${cleanSlug}`);

  return Array.from(new Set(dirs));
}

/**
 * Discovers relative companion script and reference files referenced inside SKILL.md.
 */
export function extractCompanionFilesFromMarkdown(markdown: string): string[] {
  if (!markdown || typeof markdown !== 'string') return [];

  const companions = new Set<string>();
  const matches = markdown.match(
    /\b(?:scripts|references|templates|assets)\/[a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]{2,4}\b/g
  );

  if (matches) {
    for (const match of matches) {
      const clean = match.replace(/\\/g, '/').replace(/^\/+/, '');
      if (
        !clean.includes('..') &&
        !clean.includes('\0') &&
        /\.(py|sh|js|ts|mjs|cjs|json|yaml|yml|md|html|css|svg)$/i.test(clean)
      ) {
        companions.add(clean);
      }
    }
  }

  return Array.from(companions);
}

/**
 * Checks whether a skill represents a verified live public repository.
 */
export function isSkillUpstreamLive(skill: SkillItem): boolean {
  if (skill.isUpstreamLive !== undefined) {
    return skill.isUpstreamLive;
  }
  if (skill.isLocal) {
    return false;
  }

  const id = (skill.id || '').toLowerCase();
  for (const prefix of NON_UPSTREAM_PREFIXES) {
    if (id.startsWith(prefix)) {
      return false;
    }
  }

  const hubKey = `${skill.owner || ''}/${skill.repo || ''}`;
  if (KNOWN_HUBS[hubKey]) {
    return true;
  }

  if (skill.rawManifestUrl) {
    try {
      const parsed = new URL(skill.rawManifestUrl);
      if (
        (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
        (parsed.hostname === 'raw.githubusercontent.com' || parsed.hostname.endsWith('.githubusercontent.com'))
      ) {
        return true;
      }
    } catch {
      // Invalid URL string, skip
    }
  }

  // Dynamic GitHub repo parsing
  const repoInfo = parseGitHubRepoInfo(skill);
  if (repoInfo) {
    return true;
  }

  return false;
}

/**
 * Extracts and cleans allowed-tools list from markdown or YAML frontmatter.
 * Handles both inline comma-separated values and multiline YAML bullet lists,
 * stripping leading '- ' bullets from items.
 */
export function extractAllowedTools(markdown: string): string[] {
  if (!markdown || typeof markdown !== 'string') return [];

  const lines = markdown.split(/\r?\n/);
  const tools: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^\s*allowed-tools:\s*(.*)$/i);
    if (match) {
      const inlineRest = match[1].trim();
      if (inlineRest) {
        const clean = inlineRest.replace(/^\[|\]$/g, '');
        const items = clean
          .split(',')
          .map((t) => t.trim().replace(/^-\s*/, '').replace(/^['"]|['"]$/g, ''))
          .filter((t) => t.length > 0);
        tools.push(...items);
      }

      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j];
        const trimmed = nextLine.trim();
        if (trimmed.startsWith('---') || trimmed.startsWith('#')) {
          break;
        }
        if (/^-\s+/.test(trimmed)) {
          const item = trimmed.replace(/^-\s+/, '').replace(/^['"]|['"]$/g, '').trim();
          if (item) {
            tools.push(item);
          }
          j++;
        } else if (trimmed === '') {
          j++;
        } else {
          break;
        }
      }
      break;
    }
  }

  return tools;
}

/**
 * Parses prerequisite execution telemetry (allowed-tools, env vars, CLI commands)
 * from Markdown and YAML frontmatter.
 */
export function parsePrerequisitesFromMarkdown(markdown: string): SkillPrerequisites {
  const prereqs: SkillPrerequisites = {
    envVars: [],
    cliCommands: [],
    allowedTools: [],
    dependencies: [],
  };

  if (!markdown || typeof markdown !== 'string') {
    return prereqs;
  }

  // 1. Extract allowed-tools from YAML frontmatter or inline text
  prereqs.allowedTools = extractAllowedTools(markdown);

  // 2. Extract Environment variables (API keys, Tokens, Secrets)
  const envVarMatches = markdown.match(/\b([A-Z0-9_]{2,}_(?:API_KEY|TOKEN|SECRET|KEY|PASSWORD|AUTH))\b/g);
  if (envVarMatches) {
    const excluded = new Set(['PRIMARY_KEY', 'FOREIGN_KEY', 'COMPOSITE_KEY', 'ROW_KEY']);
    const unique = Array.from(new Set(envVarMatches)).filter((k) => !excluded.has(k));
    prereqs.envVars = unique;
  }

  // 3. Extract CLI commands (e.g. npm i -g @tavily/cli, tvly login, etc.)
  const cliSet = new Set<string>();

  // npm install global
  const npmMatches = markdown.match(/npm\s+i(?:nstall)?\s+-g\s+([@a-zA-Z0-9_\-\/]+)/g);
  if (npmMatches) {
    npmMatches.forEach((m) => cliSet.add(m.trim()));
  }

  // agent-browser install command
  if (/agent-browser\s+install/i.test(markdown)) {
    cliSet.add('agent-browser install');
  }

  // tvly login / init
  const tvlyMatches = markdown.match(/tvly\s+(?:login|init|install)/g);
  if (tvlyMatches) {
    tvlyMatches.forEach((m) => cliSet.add(m.trim()));
  }

  // pip install
  const pipMatches = markdown.match(/pip\s+install\s+([a-zA-Z0-9_\-]+)/g);
  if (pipMatches) {
    pipMatches.forEach((m) => cliSet.add(m.trim()));
  }

  // curl install scripts
  const curlMatches = markdown.match(/curl\s+-fsSL\s+([^\s|]+\.sh)\s+\|\s+bash/g);
  if (curlMatches) {
    curlMatches.forEach((m) => cliSet.add(m.trim()));
  }

  prereqs.cliCommands = Array.from(cliSet);

  return prereqs;
}

/**
 * Resolves a SkillItem into canonical upstream URLs and metadata.
 */
export function resolveSkillManifest(skill: SkillItem): ExtendedSkillManifestMetadata {
  const isLive = isSkillUpstreamLive(skill);

  // If already explicitly populated on the skill object
  if (skill.rawManifestUrl && skill.repoUrl && skill.branch && skill.skillDir) {
    const prereqs =
      skill.prerequisites ||
      parsePrerequisitesFromMarkdown(skill.content || skill.docsMarkdown?.en || '');
    return {
      repoUrl: skill.repoUrl,
      rawManifestUrl: skill.rawManifestUrl,
      candidateRawUrls: [skill.rawManifestUrl],
      branch: skill.branch,
      skillDir: skill.skillDir,
      companionFiles: skill.companionFiles || [],
      prerequisites: prereqs,
      isUpstreamLive: isLive,
    };
  }

  const cleanSlug = skill.slug || skill.name || skill.id.split('/').pop() || '';
  const hubKey = `${skill.owner || ''}/${skill.repo || ''}`;
  const hub = KNOWN_HUBS[hubKey];

  // 1. Authoritative Known Hub Resolution (Maintains 100% Zero-Regression)
  if (hub && isLive) {
    const { skillDir, companionFiles } = hub.resolvePath(cleanSlug);
    const branch = skill.branch || hub.defaultBranch;
    const repoUrl = `https://github.com/${hub.owner}/${hub.repo}`;
    const rawManifestUrl = `https://raw.githubusercontent.com/${hub.owner}/${hub.repo}/${branch}/${skillDir}/SKILL.md`;

    const dynamicCompanions =
      companionFiles ||
      extractCompanionFilesFromMarkdown(skill.content || skill.docsMarkdown?.en || '');

    const prereqs =
      skill.prerequisites ||
      parsePrerequisitesFromMarkdown(skill.content || skill.docsMarkdown?.en || '');

    return {
      repoUrl,
      rawManifestUrl,
      candidateRawUrls: [rawManifestUrl],
      branch,
      skillDir,
      companionFiles: dynamicCompanions || [],
      prerequisites: prereqs,
      isUpstreamLive: true,
    };
  }

  // 2. Dynamic Upstream GitHub Resolution for Arbitrary Repositories
  const repoInfo = parseGitHubRepoInfo(skill);
  if (repoInfo && isLive) {
    const branch = skill.branch || repoInfo.embeddedBranch || 'main';
    const candidateDirs = resolveCandidateSkillDirs(
      repoInfo.owner,
      repoInfo.repo,
      cleanSlug,
      skill.skillDir || repoInfo.embeddedDir
    );

    const primaryDir = candidateDirs[0];
    const rawPathPrefix = `https://raw.githubusercontent.com/${repoInfo.owner}/${repoInfo.repo}/${branch}`;
    const rawManifestUrl = primaryDir
      ? `${rawPathPrefix}/${primaryDir}/SKILL.md`
      : `${rawPathPrefix}/SKILL.md`;

    // Generate candidate fallback URLs (root, alternative directories, master branch)
    const candidateRawUrls: string[] = [];
    for (const d of candidateDirs) {
      candidateRawUrls.push(d ? `${rawPathPrefix}/${d}/SKILL.md` : `${rawPathPrefix}/SKILL.md`);
    }
    // Add master branch fallback
    if (branch === 'main') {
      const masterPrefix = `https://raw.githubusercontent.com/${repoInfo.owner}/${repoInfo.repo}/master`;
      for (const d of candidateDirs) {
        candidateRawUrls.push(d ? `${masterPrefix}/${d}/SKILL.md` : `${masterPrefix}/SKILL.md`);
      }
    }

    const companions =
      skill.companionFiles && skill.companionFiles.length > 0
        ? skill.companionFiles
        : extractCompanionFilesFromMarkdown(skill.content || skill.docsMarkdown?.en || '');

    const prereqs =
      skill.prerequisites ||
      parsePrerequisitesFromMarkdown(skill.content || skill.docsMarkdown?.en || '');

    return {
      repoUrl: repoInfo.repoUrl,
      rawManifestUrl,
      candidateRawUrls: Array.from(new Set(candidateRawUrls)),
      branch,
      skillDir: primaryDir,
      companionFiles: companions,
      prerequisites: prereqs,
      isUpstreamLive: true,
    };
  }

  // 3. Fallback for Local, Synthetic, or Offline Skills
  const prereqs =
    skill.prerequisites ||
    parsePrerequisitesFromMarkdown(skill.content || skill.docsMarkdown?.en || '');

  return {
    repoUrl: skill.repository || skill.remoteUrl || undefined,
    rawManifestUrl: undefined,
    candidateRawUrls: [],
    branch: 'main',
    skillDir: cleanSlug,
    companionFiles: [],
    prerequisites: prereqs,
    isUpstreamLive: false,
  };
}
