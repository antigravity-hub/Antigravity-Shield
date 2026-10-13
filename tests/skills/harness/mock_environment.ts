import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { SkillItem, SkillCategory } from './contracts';

export interface TestSandbox {
  rootDir: string;
  globalSkillsDir: string;
  customSkillsDir: string;
  scienceSkillsDir: string;
  cleanup: () => void;
}

export function createTestSandbox(): TestSandbox {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag_shield_skills_test_'));
  const globalSkillsDir = path.join(rootDir, 'global_skills');
  const customSkillsDir = path.join(rootDir, 'custom_plugins', 'custom-skills', 'skills');
  const scienceSkillsDir = path.join(rootDir, 'plugins', 'science', 'skills');

  fs.mkdirSync(globalSkillsDir, { recursive: true });
  fs.mkdirSync(customSkillsDir, { recursive: true });
  fs.mkdirSync(scienceSkillsDir, { recursive: true });

  const cleanup = () => {
    try {
      if (fs.existsSync(rootDir)) {
        fs.rmSync(rootDir, { recursive: true, force: true });
      }
    } catch {
      // Ignored during cleanup
    }
  };

  return {
    rootDir,
    globalSkillsDir,
    customSkillsDir,
    scienceSkillsDir,
    cleanup,
  };
}

export function populateMockSkill(
  baseDir: string,
  name: string,
  options: {
    frontmatter?: Record<string, string | string[]>;
    body?: string;
    subfiles?: { path: string; content: string }[];
    isDisabled?: boolean;
    useDisabledExt?: boolean;
    includeSecretEnv?: boolean;
    rawContentOverride?: string;
  }
): string {
  const skillDirName = options.isDisabled && options.useDisabledExt ? `${name}.disabled` : name;
  const skillDir = path.join(baseDir, skillDirName);
  fs.mkdirSync(skillDir, { recursive: true });

  let content = '';
  if (options.rawContentOverride !== undefined) {
    content = options.rawContentOverride;
  } else {
    if (options.frontmatter) {
      content += '---\n';
      for (const [key, value] of Object.entries(options.frontmatter)) {
        if (Array.isArray(value)) {
          content += `${key}: [${value.map((v) => `"${v}"`).join(', ')}]\n`;
        } else {
          content += `${key}: ${value}\n`;
        }
      }
      content += '---\n\n';
    }
    content += options.body || `# ${name}\n\nStandard procedural guidance.`;
  }

  const skillFileName = options.useDisabledExt && !options.isDisabled ? 'SKILL.md.disabled' : 'SKILL.md';
  fs.writeFileSync(path.join(skillDir, skillFileName), content, 'utf-8');

  if (options.isDisabled && !options.useDisabledExt) {
    fs.writeFileSync(path.join(skillDir, '.disabled'), 'DISABLED', 'utf-8');
  }

  if (options.includeSecretEnv) {
    fs.writeFileSync(
      path.join(skillDir, '.env'),
      'OPENAI_API_KEY=sk-test12345678901234567890\nGITHUB_PAT=ghp_secretTokenHere123456789012345678',
      'utf-8'
    );
  }

  if (options.subfiles) {
    for (const sub of options.subfiles) {
      const subPath = path.join(skillDir, sub.path);
      fs.mkdirSync(path.dirname(subPath), { recursive: true });
      fs.writeFileSync(subPath, sub.content, 'utf-8');
    }
  }

  return skillDir;
}

export const CURATED_MOCK_CATALOG: SkillItem[] = [
  // 1. Coding & Languages
  {
    id: 'vercel-labs/skills/find-skills',
    name: 'find-skills',
    title: 'Find Skills',
    description: 'Discover and install skills for AI agents based on task context and project tech stack.',
    category: 'coding',
    author: 'Vercel Labs',
    repo: 'vercel-labs/skills',
    version: '1.0.0',
    triggers: ['/find-skills', 'search skills', 'discover agent skills'],
    tags: ['skills', 'discovery', 'coding', 'agents'],
    isInstalled: false,
    isEnabled: false,
    isLocal: false,
    isOfficial: true,
    installs: 3800000,
    sourceType: 'skills_sh',
  },
  {
    id: 'mattpocock/skills/grill-me',
    name: 'grill-me',
    title: 'Grill Me',
    description: 'Grills the engineer on architecture and requirements before writing any implementation code.',
    category: 'coding',
    author: 'Matt Pocock',
    repo: 'mattpocock/skills',
    version: '1.2.0',
    triggers: ['/grill-me', 'challenge spec', 'verify requirements'],
    tags: ['architecture', 'tdd', 'interview', 'coding'],
    isInstalled: false,
    isEnabled: false,
    isLocal: false,
    isOfficial: false,
    installs: 1300000,
    sourceType: 'skills_sh',
  },

  // 2. Design & Motion
  {
    id: 'anthropics/skills/frontend-design',
    name: 'frontend-design',
    title: 'Frontend Design',
    description: 'Distinctive, production-grade frontend design with high visual craft and responsive rhythm.',
    category: 'design',
    author: 'Anthropic',
    repo: 'anthropics/skills',
    version: '2.1.0',
    triggers: ['/frontend-design', 'distinctive ui', 'design system'],
    tags: ['design', 'ui', 'css', 'craft'],
    isInstalled: false,
    isEnabled: false,
    isLocal: false,
    isOfficial: true,
    installs: 982700,
    sourceType: 'skills_sh',
  },
  {
    id: 'apple-design/community',
    name: 'apple-design',
    title: 'Apple Design & Fluid Motion',
    description: 'Apple WWDC fluid motion foundations: 1:1 direct manipulation and velocity preservation.',
    category: 'design',
    author: 'Apple Guild',
    repo: 'apple/design-guidelines',
    version: '1.5.0',
    triggers: ['/apple-design', 'fluid springs', 'gestures'],
    tags: ['apple', 'motion', 'springs', 'ios'],
    isInstalled: true,
    isEnabled: true,
    isLocal: true,
    isOfficial: true,
    installs: 410000,
    sourceType: 'local',
  },

  // 3. DevOps & Cloud
  {
    id: 'aws/agent-toolkit-for-aws',
    name: 'agent-toolkit-for-aws',
    title: 'AWS Agent Toolkit',
    description: 'Official AWS infrastructure deployment, IAM roles, Lambda triggers, and CDK patterns.',
    category: 'devops',
    author: 'Amazon Web Services',
    repo: 'aws/agent-toolkit-for-aws',
    version: '3.0.0',
    triggers: ['/aws', 'aws deploy', 'lambda', 's3'],
    tags: ['aws', 'cloud', 'devops', 'cdk'],
    isInstalled: false,
    isEnabled: false,
    isLocal: false,
    isOfficial: true,
    installs: 890000,
    sourceType: 'skills_sh',
  },

  // 4. Data & Analytics
  {
    id: 'clickhouse/agent-skills',
    name: 'clickhouse-skills',
    title: 'ClickHouse Analytics Engine',
    description: 'High-throughput analytical SQL queries, MergeTree engines, and materialization pipelines.',
    category: 'data',
    author: 'ClickHouse',
    repo: 'clickhouse/agent-skills',
    version: '1.0.4',
    triggers: ['/clickhouse', 'olap query', 'mergetree'],
    tags: ['clickhouse', 'sql', 'analytics', 'data'],
    isInstalled: false,
    isEnabled: false,
    isLocal: false,
    isOfficial: true,
    installs: 540000,
    sourceType: 'skills_sh',
  },

  // 5. Automation & Browser
  {
    id: 'vercel-labs/agent-browser',
    name: 'agent-browser',
    title: 'Agent Browser',
    description: 'Headless and live browser navigation, DOM exploration, and screenshot evaluation.',
    category: 'automation',
    author: 'Vercel Labs',
    repo: 'vercel-labs/agent-browser',
    version: '1.4.0',
    triggers: ['/browser', 'browse web', 'headless inspect'],
    tags: ['browser', 'automation', 'puppeteer', 'crawler'],
    isInstalled: false,
    isEnabled: false,
    isLocal: false,
    isOfficial: true,
    installs: 1100000,
    sourceType: 'skills_sh',
  },

  // 6. Science & Research
  {
    id: 'science-plugin/alphafold-database',
    name: 'alphafold-database',
    title: 'AlphaFold Structure Fetch & Analysis',
    description: 'AlphaFold predicted 3D structure analysis, pLDDT confidence metrics, and disorder regions.',
    category: 'science',
    author: 'Science Team',
    repo: 'science/alphafold',
    version: '2.0.0',
    triggers: ['/alphafold', 'uniprot plddt', 'protein fold'],
    tags: ['science', 'biology', 'alphafold', 'proteins'],
    isInstalled: true,
    isEnabled: true,
    isLocal: true,
    isOfficial: true,
    installs: 120000,
    sourceType: 'local',
  },

  // 7. Architecture & Systems
  {
    id: 'principal/backend-architect',
    name: 'backend-architect',
    title: 'Principal Backend Architect',
    description: 'Production-grade backend architecture, distributed transactions, and race-condition safety.',
    category: 'architecture',
    author: 'Systems Guild',
    repo: 'custom-skills/backend-architect',
    version: '2.2.0',
    triggers: ['/backend-arch', 'microservices', 'idempotent api'],
    tags: ['architecture', 'backend', 'distributed', 'concurrency'],
    isInstalled: true,
    isEnabled: true,
    isLocal: true,
    isOfficial: true,
    installs: 250000,
    sourceType: 'local',
  },
];
