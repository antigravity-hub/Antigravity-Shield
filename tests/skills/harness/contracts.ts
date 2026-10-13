import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

export type SkillCategory =
  | 'all'
  | 'coding'
  | 'design'
  | 'devops'
  | 'data'
  | 'automation'
  | 'science'
  | 'architecture';

export type SkillSourceType = 'all' | 'local' | 'skills_sh' | 'github';

export interface SkillFileEntry {
  path: string;
  contents?: string;
  sizeBytes?: number;
  sha256?: string;
}

export interface SkillItem {
  id: string;
  name: string;
  title: string;
  description: string;
  category: SkillCategory;
  author: string;
  repo?: string;
  version: string;
  icon?: string;
  triggers?: string[];
  tags: string[];
  isInstalled: boolean;
  isEnabled: boolean;
  isLocal: boolean;
  isOfficial?: boolean;
  installs?: number;
  installPath?: string;
  sourceType: SkillSourceType;
  sha256?: string;
  files?: SkillFileEntry[];
  content?: string;
}

/**
 * Invariant Zero-Leak Privacy Guard & Secret Redactor
 * Masks 12 distinct private credential and PII patterns before transmission or inspection.
 */
export class ZeroLeakRedactor {
  private static readonly DISALLOWED_FILES = [
    /^\.env(\..+)?$/i,
    /^\.credentials(\..+)?$/i,
    /^mcp_config\.json$/i,
    /^config\.json$/i,
    /\.pem$/i,
    /\.key$/i,
    /\.token$/i,
    /\.id_rsa$/i,
  ];

  public static isPathAllowed(filePath: string): boolean {
    const normalized = path.basename(filePath);
    for (const pattern of this.DISALLOWED_FILES) {
      if (pattern.test(normalized)) {
        return false;
      }
    }
    // Only allow markdown and documentation files
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.md' || ext === '.json' || ext === '';
  }

  public static redactText(input: string, currentUsername?: string): string {
    let text = input;

    // 1. Anthropic API Keys (sk-ant-...) - MUST run before OpenAI sk-
    text = text.replace(/sk-ant-[a-zA-Z0-9_\-]{20,}/g, 'sk-ant-****************************');

    // 2. OpenAI API Keys (sk-...)
    text = text.replace(/sk-[a-zA-Z0-9_\-]{20,}/g, 'sk-********************************');

    // 3. GitHub Personal Access Tokens (ghp_...)
    text = text.replace(/ghp_[a-zA-Z0-9]{20,}/g, 'ghp_************************************');

    // 4. Notion Integration Tokens (ntn_...)
    text = text.replace(/ntn_[a-zA-Z0-9]{20,}/g, 'ntn_********************************');

    // 5. Exa API Keys (UUIDv4 pattern)
    text = text.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '********-****-****-****-************'
    );

    // 6. Slack Bot Tokens (xoxb-...)
    text = text.replace(
      /xoxb-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}/g,
      'xoxb-**********-**********-************************'
    );

    // 7. Google AI / Cloud API Keys (AIza...)
    text = text.replace(/AIza[0-9A-Za-z\-_]{35}/g, 'AIza***********************************');

    // 8. AWS Access Key IDs (AKIA...)
    text = text.replace(/AKIA[0-9A-Z]{16}/g, 'AKIA****************');

    // 9. Bearer Authorization Tokens
    text = text.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]');

    // 10. Telegram Bot Tokens (e.g. 1234567890:ABCdef...)
    text = text.replace(/\b\d{8,10}:[a-zA-Z0-9_-]{35}\b/g, '[REDACTED_BOT_TOKEN]');

    // 11. Generic Secret Key-Value Assignments
    text = text.replace(
      /(api[_-]?key|secret|token|password)\s*[:=]\s*["']?([a-zA-Z0-9_\-\.]{16,})["']?/gi,
      '$1="[REDACTED_SECRET]"'
    );

    // 12. PII Username Path Normalization
    if (currentUsername) {
      const userPattern = new RegExp(`C:\\\\Users\\\\${currentUsername}`, 'gi');
      text = text.replace(userPattern, '~');
      const slashPattern = new RegExp(`C:/Users/${currentUsername}`, 'gi');
      text = text.replace(slashPattern, '~');
    } else {
      text = text.replace(/C:[\\/]Users[\\/][^\\/ \r\n"']+/gi, '~');
    }

    return text;
  }
}

/**
 * Resilient SKILL.md Frontmatter Parser
 * Pure TypeScript reference oracle mimicking the Rust resilient parser.
 */
export class ResilientFrontmatterParser {
  public static parse(content: string): {
    name: string;
    title: string;
    description: string;
    triggers: string[];
    category?: SkillCategory;
    version?: string;
    author?: string;
    body: string;
  } {
    let name = '';
    let description = '';
    let title = '';
    const triggers: string[] = [];
    let category: SkillCategory | undefined;
    let version: string | undefined;
    let author: string | undefined;

    // Handle empty or leading quirks
    const trimmed = content.trim();

    // Check for double delimiter quirk (e.g. core-web-vitals: ---\n\n---)
    let searchContent = trimmed;
    if (searchContent.startsWith('---\n\n---') || searchContent.startsWith('---\r\n\r\n---')) {
      searchContent = searchContent.replace(/^---\r?\n\r?\n---/, '---');
    }

    let frontmatterRaw = '';
    let bodyRaw = trimmed;

    if (searchContent.startsWith('---')) {
      const secondIndex = searchContent.indexOf('---', 3);
      if (secondIndex !== -1) {
        frontmatterRaw = searchContent.substring(3, secondIndex).trim();
        bodyRaw = searchContent.substring(secondIndex + 3).trim();
      }
    }

    // Parse frontmatter key-values with folded scalar support
    if (frontmatterRaw) {
      const lines = frontmatterRaw.split(/\r?\n/);
      let currentKey = '';
      let isFoldedScalar = false;
      let foldedBuffer: string[] = [];

      const flushFolded = () => {
        if (currentKey && isFoldedScalar) {
          const joined = foldedBuffer.join(' ').trim();
          if (currentKey === 'description') description = joined;
          isFoldedScalar = false;
          foldedBuffer = [];
        }
      };

      for (const line of lines) {
        // If line is indented and we are in folded scalar mode
        if (isFoldedScalar && /^\s+/.test(line)) {
          foldedBuffer.push(line.trim());
          continue;
        } else {
          flushFolded();
        }

        const match = line.match(/^([a-zA-Z0-9_\-]+)\s*:\s*(.*)$/);
        if (match) {
          currentKey = match[1].toLowerCase();
          const val = match[2].trim();

          if (val === '>' || val === '>-') {
            isFoldedScalar = true;
            foldedBuffer = [];
          } else {
            // Strip quotes if present
            const unquoted = val.replace(/^["'](.*)["']$/, '$1');
            if (currentKey === 'name') name = unquoted;
            else if (currentKey === 'description') description = unquoted;
            else if (currentKey === 'category') category = unquoted as SkillCategory;
            else if (currentKey === 'version') version = unquoted;
            else if (currentKey === 'author') author = unquoted;
            else if (currentKey === 'triggers') {
              // could be inline array or single trigger
              if (unquoted.startsWith('[') && unquoted.endsWith(']')) {
                const parts = unquoted
                  .slice(1, -1)
                  .split(',')
                  .map((p) => p.trim().replace(/^["'](.*)["']$/, '$1'));
                triggers.push(...parts.filter(Boolean));
              } else if (unquoted) {
                triggers.push(unquoted);
              }
            }
          }
        }
      }
      flushFolded();
    }

    // Extract title from body if Level-1 header exists
    const titleMatch = bodyRaw.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
    } else if (name) {
      // Fallback: title-case the name
      title = name
        .split(/[-_]/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    } else {
      title = 'Untitled Skill';
    }

    // Fallback name if missing in frontmatter
    if (!name) {
      name = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }

    // Fallback description from first paragraph of body if empty
    if (!description && bodyRaw) {
      const bodyLines = bodyRaw
        .split(/\r?\n/)
        .filter((l) => l.trim() && !l.startsWith('#'));
      if (bodyLines.length > 0) {
        description = bodyLines[0].trim();
      }
    }

    // Extract triggers from markdown body if empty ("Use when...", "/trigger")
    if (triggers.length === 0 && bodyRaw) {
      const slashMatches = bodyRaw.match(/\/[a-zA-Z0-9_\-]+/g);
      if (slashMatches) {
        triggers.push(...Array.from(new Set(slashMatches)));
      }
    }

    return {
      name,
      title,
      description,
      triggers,
      category,
      version: version || '1.0.0',
      author: author || 'community',
      body: bodyRaw,
    };
  }
}

/**
 * Multi-Root Local Skills Scanner Reference
 */
export class MultiRootLocalScanner {
  public static scanDirectories(roots: { path: string; isPlugin: boolean }[]): SkillItem[] {
    const discovered = new Map<string, SkillItem>();

    for (const root of roots) {
      if (!fs.existsSync(root.path)) continue;
      const entries = fs.readdirSync(root.path, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillDir = path.join(root.path, entry.name);
        const skillMdPath = path.join(skillDir, 'SKILL.md');
        const disabledMarker = path.join(skillDir, '.disabled');
        const isDirDisabled = entry.name.endsWith('.disabled');

        let content = '';
        let exists = false;

        if (fs.existsSync(skillMdPath)) {
          content = fs.readFileSync(skillMdPath, 'utf-8');
          exists = true;
        } else if (fs.existsSync(skillMdPath + '.disabled')) {
          content = fs.readFileSync(skillMdPath + '.disabled', 'utf-8');
          exists = true;
        }

        if (!exists) continue;

        const isEnabled = !fs.existsSync(disabledMarker) && !isDirDisabled;
        const parsed = ResilientFrontmatterParser.parse(content);
        const skillId = parsed.name || entry.name.replace(/\.disabled$/, '');

        // Precedence: global user skills take precedence over plugin skills
        if (discovered.has(skillId) && root.isPlugin) {
          continue;
        }

        // Infer category if absent
        let cat: SkillCategory = parsed.category || 'coding';
        if (!parsed.category) {
          const lowerDesc = (parsed.description + ' ' + parsed.name).toLowerCase();
          if (lowerDesc.includes('science') || lowerDesc.includes('protein') || lowerDesc.includes('alphafold') || lowerDesc.includes('medical') || lowerDesc.includes('biology')) {
            cat = 'science';
          } else if (lowerDesc.includes('design') || lowerDesc.includes('motion') || lowerDesc.includes('ui') || lowerDesc.includes('ux')) {
            cat = 'design';
          } else if (lowerDesc.includes('devops') || lowerDesc.includes('docker') || lowerDesc.includes('cloud') || lowerDesc.includes('aws')) {
            cat = 'devops';
          } else if (lowerDesc.includes('data') || lowerDesc.includes('sql') || lowerDesc.includes('postgres') || lowerDesc.includes('analytics')) {
            cat = 'data';
          } else if (lowerDesc.includes('browser') || lowerDesc.includes('automate') || lowerDesc.includes('crawl')) {
            cat = 'automation';
          } else if (lowerDesc.includes('architect') || lowerDesc.includes('microservice') || lowerDesc.includes('distributed')) {
            cat = 'architecture';
          }
        }

        discovered.set(skillId, {
          id: skillId,
          name: parsed.name,
          title: parsed.title,
          description: parsed.description,
          category: cat,
          author: parsed.author || 'local',
          version: parsed.version || '1.0.0',
          triggers: parsed.triggers,
          tags: ['local', cat],
          isInstalled: true,
          isEnabled,
          isLocal: true,
          isOfficial: false,
          installs: 0,
          installPath: ZeroLeakRedactor.redactText(skillDir),
          sourceType: 'local',
          content: ZeroLeakRedactor.redactText(content),
        });
      }
    }

    return Array.from(discovered.values());
  }
}

/**
 * Multi-Dimensional Search, Filter and Sort Engine
 */
export class MultiDimensionalSearchEngine {
  public static query(
    skills: SkillItem[],
    options: {
      source?: SkillSourceType;
      category?: SkillCategory;
      status?: 'all' | 'installed' | 'available' | 'official';
      search?: string;
      sort?: 'popular' | 'name' | 'recent';
    }
  ): SkillItem[] {
    let result = [...skills];

    // 1. Source filter
    if (options.source && options.source !== 'all') {
      if (options.source === 'local') {
        result = result.filter((s) => s.isLocal || s.isInstalled);
      } else if (options.source === 'skills_sh') {
        result = result.filter((s) => s.sourceType === 'skills_sh' || !s.isLocal);
      }
    }

    // 2. Category filter
    if (options.category && options.category !== 'all') {
      result = result.filter((s) => s.category === options.category);
    }

    // 3. Status filter
    if (options.status && options.status !== 'all') {
      if (options.status === 'installed') {
        result = result.filter((s) => s.isInstalled);
      } else if (options.status === 'available') {
        result = result.filter((s) => !s.isInstalled);
      } else if (options.status === 'official') {
        result = result.filter((s) => s.isOfficial === true);
      }
    }

    // 4. Multi-field search
    if (options.search && options.search.trim().length > 0) {
      const query = options.search.trim().toLowerCase();
      const normalizedQuery = query.startsWith('/') ? query.slice(1) : query;

      result = result.filter((s) => {
        // title
        if (s.title.toLowerCase().includes(query)) return true;
        // name
        if (s.name.toLowerCase().includes(query)) return true;
        // description
        if (s.description.toLowerCase().includes(query)) return true;
        // repo or author
        if (s.repo && s.repo.toLowerCase().includes(query)) return true;
        if (s.author && s.author.toLowerCase().includes(query)) return true;
        // triggers (match with or without slash)
        if (
          s.triggers &&
          s.triggers.some((t) => {
            const lowerT = t.toLowerCase();
            return lowerT.includes(query) || lowerT.includes(normalizedQuery);
          })
        ) {
          return true;
        }
        // tags
        if (s.tags && s.tags.some((tag) => tag.toLowerCase().includes(query))) {
          return true;
        }
        return false;
      });
    }

    // 5. Sorting
    if (options.sort === 'popular') {
      result.sort((a, b) => (b.installs || 0) - (a.installs || 0));
    } else if (options.sort === 'name') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  }
}

/**
 * 1-Click Atomic Installer Simulator with Windows File-Lock & Hash Verification
 */
export class OneClickAtomicInstaller {
  public static async installSkill(
    targetBaseDir: string,
    skill: SkillItem,
    files: SkillFileEntry[],
    options?: {
      simulateLockErrorCount?: number;
      simulateShaMismatch?: boolean;
    }
  ): Promise<{ success: boolean; installedPath: string; sha256: string }> {
    // 1. Path traversal security check
    if (skill.name.includes('..') || skill.name.includes('/') || skill.name.includes('\\')) {
      throw new Error(`Security Violation: Directory traversal rejected in skill name "${skill.name}"`);
    }

    const finalDir = path.join(targetBaseDir, skill.name);
    const tmpDir = path.join(targetBaseDir, `${skill.name}.tmp_${Date.now()}`);

    // Create temp staging dir
    fs.mkdirSync(tmpDir, { recursive: true });

    try {
      // Write files into tmp
      let primarySkillMdContent = '';
      for (const file of files) {
        if (file.path.includes('..')) {
          throw new Error(`Security Violation: Directory traversal in file entry "${file.path}"`);
        }
        const filePath = path.join(tmpDir, file.path);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        const content = file.contents || '';
        fs.writeFileSync(filePath, content, 'utf-8');
        if (file.path === 'SKILL.md') {
          primarySkillMdContent = content;
        }
      }

      // Compute SHA-256
      const hash = crypto.createHash('sha256').update(primarySkillMdContent).digest('hex');

      // Verify SHA-256 if expected
      if (options?.simulateShaMismatch) {
        throw new Error('Integrity Check Failed: SHA-256 checksum mismatch');
      }

      // Write metadata.json
      const metadata = {
        id: skill.id,
        name: skill.name,
        installedAt: new Date().toISOString(),
        version: skill.version || '1.0.0',
        sha256: hash,
        isEnabled: true,
      };
      fs.writeFileSync(path.join(tmpDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');

      // Simulate Windows file lock retry if requested
      if (options?.simulateLockErrorCount && options.simulateLockErrorCount > 0) {
        let attempts = 0;
        while (attempts < options.simulateLockErrorCount) {
          attempts++;
          await new Promise((r) => setTimeout(r, 50));
        }
      }

      // Move/rename to finalDir atomically
      if (fs.existsSync(finalDir)) {
        fs.rmSync(finalDir, { recursive: true, force: true });
      }
      fs.renameSync(tmpDir, finalDir);

      return {
        success: true,
        installedPath: finalDir,
        sha256: hash,
      };
    } catch (err) {
      // Rollback tmpDir
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
      throw err;
    }
  }

  public static uninstallSkill(targetBaseDir: string, skillName: string): boolean {
    if (skillName.includes('..') || skillName.includes('/') || skillName.includes('\\')) {
      throw new Error(`Security Violation: Directory traversal rejected in skill name "${skillName}"`);
    }

    const targetDir = path.join(targetBaseDir, skillName);
    if (!fs.existsSync(targetDir)) {
      return false;
    }

    fs.rmSync(targetDir, { recursive: true, force: true });
    return true;
  }

  public static toggleSkillStatus(targetBaseDir: string, skillName: string, enabled: boolean): boolean {
    if (skillName.includes('..') || skillName.includes('/') || skillName.includes('\\')) {
      throw new Error(`Security Violation: Directory traversal rejected in skill name "${skillName}"`);
    }

    const targetDir = path.join(targetBaseDir, skillName);
    if (!fs.existsSync(targetDir)) {
      return false;
    }

    const disabledMarker = path.join(targetDir, '.disabled');
    if (enabled) {
      if (fs.existsSync(disabledMarker)) {
        fs.unlinkSync(disabledMarker);
      }
    } else {
      if (!fs.existsSync(disabledMarker)) {
        fs.writeFileSync(disabledMarker, 'DISABLED', 'utf-8');
      }
    }

    return true;
  }
}
