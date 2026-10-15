import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import compiled resolver from dist-test
import {
  isSkillUpstreamLive,
  parsePrerequisitesFromMarkdown,
  resolveSkillManifest,
} from '../dist-test/skillManifestResolver.js';

console.log('================================================================');
console.log('   EMPIRICAL ADVERSARIAL STRESS TEST: SKILL MANIFEST RESOLVER   ');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;
let findings = [];

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    if (details) console.error(`         Details: ${details}`);
    failCount++;
    findings.push({ testName, details });
  }
}

// ============================================================================
// SUITE 1: OFFICIAL KNOWN HUB SKILLS
// ============================================================================
console.log('--- SUITE 1: Official Known Hub Skills ---');

// 1.1 find-skills (vercel-labs/skills)
const findSkills = resolveSkillManifest({
  id: 'vercel-labs/skills/find-skills',
  slug: 'find-skills',
  name: 'find-skills',
  title: 'Find Skills',
  owner: 'vercel-labs',
  repo: 'skills',
  category: 'automation',
  author: 'Vercel Labs',
  version: '1.0.0',
});

assert(
  findSkills.isUpstreamLive === true,
  '1.1.1 find-skills isUpstreamLive === true',
  `Got: ${findSkills.isUpstreamLive}`
);
assert(
  findSkills.rawManifestUrl === 'https://raw.githubusercontent.com/vercel-labs/skills/main/skills/find-skills/SKILL.md',
  '1.1.2 find-skills rawManifestUrl resolves to vercel-labs/skills/main/skills/find-skills/SKILL.md',
  `Got: ${findSkills.rawManifestUrl}`
);
assert(
  findSkills.repoUrl === 'https://github.com/vercel-labs/skills',
  '1.1.3 find-skills repoUrl resolves correctly',
  `Got: ${findSkills.repoUrl}`
);
assert(
  findSkills.skillDir === 'skills/find-skills',
  '1.1.4 find-skills skillDir === skills/find-skills',
  `Got: ${findSkills.skillDir}`
);

// 1.2 agent-browser (vercel-labs/agent-browser)
const agentBrowser = resolveSkillManifest({
  id: 'vercel-labs/agent-browser/agent-browser',
  slug: 'agent-browser',
  name: 'agent-browser',
  title: 'Agent Browser',
  owner: 'vercel-labs',
  repo: 'agent-browser',
  category: 'automation',
  author: 'Vercel Labs',
  version: '1.0.0',
});

assert(
  agentBrowser.isUpstreamLive === true,
  '1.2.1 agent-browser isUpstreamLive === true',
  `Got: ${agentBrowser.isUpstreamLive}`
);
assert(
  agentBrowser.rawManifestUrl === 'https://raw.githubusercontent.com/vercel-labs/agent-browser/main/skills/agent-browser/SKILL.md',
  '1.2.2 agent-browser rawManifestUrl resolves correctly',
  `Got: ${agentBrowser.rawManifestUrl}`
);
assert(
  agentBrowser.companionFiles && agentBrowser.companionFiles.length === 2,
  '1.2.3 agent-browser companionFiles contains 2 files',
  `Got: ${JSON.stringify(agentBrowser.companionFiles)}`
);

// 1.3 grill-me (mattpocock/skills - productivity)
const grillMe = resolveSkillManifest({
  id: 'mattpocock/skills/grill-me',
  slug: 'grill-me',
  name: 'grill-me',
  title: 'Grill Me',
  owner: 'mattpocock',
  repo: 'skills',
  category: 'coding',
  author: 'Matt Pocock',
  version: '1.0.0',
});

assert(
  grillMe.isUpstreamLive === true,
  '1.3.1 grill-me isUpstreamLive === true',
  `Got: ${grillMe.isUpstreamLive}`
);
assert(
  grillMe.skillDir === 'skills/productivity/grill-me',
  '1.3.2 grill-me skillDir resolves to skills/productivity/grill-me',
  `Got: ${grillMe.skillDir}`
);
assert(
  grillMe.rawManifestUrl === 'https://raw.githubusercontent.com/mattpocock/skills/main/skills/productivity/grill-me/SKILL.md',
  '1.3.3 grill-me rawManifestUrl resolves correctly',
  `Got: ${grillMe.rawManifestUrl}`
);

// 1.4 docx (anthropics/skills)
const docx = resolveSkillManifest({
  id: 'anthropics/skills/docx',
  slug: 'docx',
  name: 'docx',
  title: 'DOCX Generator',
  owner: 'anthropics',
  repo: 'skills',
  category: 'automation',
  author: 'Anthropic',
  version: '1.0.0',
});

assert(
  docx.isUpstreamLive === true,
  '1.4.1 docx isUpstreamLive === true',
  `Got: ${docx.isUpstreamLive}`
);
assert(
  docx.skillDir === 'skills/docx',
  '1.4.2 docx skillDir === skills/docx',
  `Got: ${docx.skillDir}`
);
assert(
  docx.companionFiles && docx.companionFiles.includes('scripts/office/soffice.py'),
  '1.4.3 docx companionFiles includes soffice.py',
  `Got: ${JSON.stringify(docx.companionFiles)}`
);

// 1.5 tavily-research / tavily-ai-research-agent-loops
const tavilySkill = resolveSkillManifest({
  id: 'tavily-ai/skills/tavily-ai-research-agent-loops',
  slug: 'tavily-ai-research-agent-loops',
  name: 'tavily-ai-research-agent-loops',
  title: 'Tavily Research',
  owner: 'tavily-ai',
  repo: 'skills',
  category: 'automation',
  author: 'Tavily AI',
  version: '1.0.0',
});

assert(
  tavilySkill.isUpstreamLive === true,
  '1.5.1 tavily skill isUpstreamLive === true',
  `Got: ${tavilySkill.isUpstreamLive}`
);
assert(
  tavilySkill.companionFiles && tavilySkill.companionFiles.length === 3,
  '1.5.2 tavily skill companionFiles includes 3 references',
  `Got: ${JSON.stringify(tavilySkill.companionFiles)}`
);

// ============================================================================
// SUITE 2: CATEGORIZED SKILLS (PRODUCTIVITY VS ENGINEERING)
// ============================================================================
console.log('\n--- SUITE 2: Categorized Skills Partitioning ---');

const engineeringSlugs = [
  'implement',
  'code-review',
  'tdd',
  'diagnosing-bugs',
  'verification',
  'systematic-refactoring',
];

for (const slug of engineeringSlugs) {
  const res = resolveSkillManifest({
    id: `mattpocock/skills/${slug}`,
    slug,
    name: slug,
    title: slug,
    owner: 'mattpocock',
    repo: 'skills',
    category: 'coding',
    author: 'Matt Pocock',
    version: '1.0.0',
  });
  assert(
    res.skillDir === `skills/engineering/${slug}`,
    `2.1 Engineering category resolution: ${slug} -> skills/engineering/${slug}`,
    `Got: ${res.skillDir}`
  );
}

const productivitySlugs = [
  'grill-me',
  'teach',
  'handoff',
  'grilling',
  'plan-execution',
];

for (const slug of productivitySlugs) {
  const res = resolveSkillManifest({
    id: `mattpocock/skills/${slug}`,
    slug,
    name: slug,
    title: slug,
    owner: 'mattpocock',
    repo: 'skills',
    category: 'coding',
    author: 'Matt Pocock',
    version: '1.0.0',
  });
  assert(
    res.skillDir === `skills/productivity/${slug}`,
    `2.2 Productivity category resolution: ${slug} -> skills/productivity/${slug}`,
    `Got: ${res.skillDir}`
  );
}

// 2.3 Adversarial casing and whitespace in slugs
const casedSlugRes = resolveSkillManifest({
  id: 'mattpocock/skills/TDD',
  slug: 'TDD',
  name: 'TDD',
  title: 'TDD',
  owner: 'mattpocock',
  repo: 'skills',
  category: 'coding',
  author: 'Matt Pocock',
  version: '1.0.0',
});
assert(
  casedSlugRes.skillDir === 'skills/engineering/TDD' || casedSlugRes.skillDir === 'skills/engineering/tdd',
  '2.3 Case-insensitive categorization for Matt Pocock skills (TDD)',
  `Got: ${casedSlugRes.skillDir}`
);

// ============================================================================
// SUITE 3: SCIENCE & SYNTHETIC SKILLS (NON-UPSTREAM)
// ============================================================================
console.log('\n--- SUITE 3: Science & Synthetic Non-Upstream Skills ---');

const scienceSyntheticIds = [
  'deepmind/alphafold-database',
  'ebi-chembl/chembl-client',
  'ncbi/sequence-fetch',
  'broadinstitute/gtex-database',
  'rcsb/pdb-viewer',
  'open.feishu.cn/lark-agent',
  'uizze.sh/minimalist-ui',
];

for (const id of scienceSyntheticIds) {
  const prefix = id.split('/')[0];
  const name = id.split('/')[1];
  const skill = {
    id,
    name,
    title: name,
    owner: prefix,
    repo: name,
    category: 'science',
    author: prefix,
    version: '1.0.0',
  };

  const isLive = isSkillUpstreamLive(skill);
  const resolved = resolveSkillManifest(skill);

  assert(
    isLive === false,
    `3.1 isSkillUpstreamLive === false for synthetic skill: ${id}`,
    `Got: ${isLive}`
  );
  assert(
    resolved.isUpstreamLive === false,
    `3.2 resolveSkillManifest().isUpstreamLive === false for: ${id}`,
    `Got: ${resolved.isUpstreamLive}`
  );
  assert(
    resolved.rawManifestUrl === undefined,
    `3.3 rawManifestUrl === undefined for synthetic skill: ${id}`,
    `Got: ${resolved.rawManifestUrl}`
  );
}

// 3.4 Local skills must NEVER be considered upstream live
const localSkill = {
  id: 'local/my-secret-skill',
  name: 'my-secret-skill',
  title: 'My Secret Skill',
  isLocal: true,
  category: 'coding',
  author: 'Local User',
  version: '1.0.0',
};
assert(
  isSkillUpstreamLive(localSkill) === false,
  '3.4 Local skill isSkillUpstreamLive === false',
  `Got: ${isSkillUpstreamLive(localSkill)}`
);

// ============================================================================
// SUITE 4: OFFLINE FALLBACK & FRONTMATTER VALIDATION RESILIENCY
// ============================================================================
console.log('\n--- SUITE 4: Offline Fallback & Frontmatter Resiliency ---');

function validateSkillFrontmatter(content) {
  if (!content || typeof content !== 'string') return { ok: false, error: 'Empty content' };
  const clean = content.replace(/^\uFEFF/, '').trim();
  if (!clean.startsWith('---')) {
    return { ok: false, error: 'Missing opening delimiter ---' };
  }
  const secondDelim = clean.indexOf('---', 3);
  if (secondDelim === -1) {
    return { ok: false, error: 'Missing closing delimiter ---' };
  }
  const yamlBlock = clean.slice(3, secondDelim);
  const nameMatch = yamlBlock.match(/^\s*name:\s*(.+)$/m);
  const descMatch = yamlBlock.match(/^\s*description:\s*(.+)$/m);

  if (!nameMatch || !nameMatch[1].trim()) {
    return { ok: false, error: "Missing required 'name' field" };
  }
  if (!descMatch || !descMatch[1].trim()) {
    return { ok: false, error: "Missing required 'description' field" };
  }

  return {
    ok: true,
    name: nameMatch[1].trim().replace(/^['"]|['"]$/g, ''),
    description: descMatch[1].trim().replace(/^['"]|['"]$/g, ''),
  };
}

// Fallback generator simulation (from Rust skills.rs lines 1100-1126 and 1301-1313)
function generateCanonicalSkillMd(skill, cleanName) {
  const cleanDesc = (skill.description || '').replace(/\r/g, '').replace(/\n/g, ' ');
  const triggersStr = (skill.triggers || []).join(', ');
  return `---\nname: ${cleanName}\ndescription: ${cleanDesc}\ncategory: ${skill.category || 'coding'}\nversion: ${skill.version || '1.0.0'}\ntriggers: [${triggersStr}]\n---\n\n# ${skill.title || cleanName}\n\n${cleanDesc}\n`;
}

// 4.1 Standard fallback
const offlineSkill1 = {
  id: 'offline/test-skill',
  name: 'test-skill',
  title: 'Test Offline Skill',
  description: 'A completely offline skill fallback test',
  category: 'automation',
  version: '1.0.0',
  triggers: ['/test', 'run test'],
};
const generatedMd1 = generateCanonicalSkillMd(offlineSkill1, 'test-skill');
const val1 = validateSkillFrontmatter(generatedMd1);
assert(val1.ok === true, '4.1 Standard offline fallback generates valid YAML frontmatter', val1.error);
assert(val1.name === 'test-skill', '4.1.1 Frontmatter name matches clean_name');
assert(val1.description === 'A completely offline skill fallback test', '4.1.2 Frontmatter description matches');

// 4.2 Multiline description with newlines and quotes
const offlineSkill2 = {
  id: 'offline/multiline-skill',
  name: 'multiline-skill',
  title: 'Multiline Skill',
  description: 'Line 1 of description.\nLine 2 with "quotes" and symbols: @#$!\r\nLine 3.',
  category: 'design',
  version: '2.0.0',
  triggers: ['/multi'],
};
const generatedMd2 = generateCanonicalSkillMd(offlineSkill2, 'multiline-skill');
const val2 = validateSkillFrontmatter(generatedMd2);
assert(val2.ok === true, '4.2 Multiline description sanitized and produces valid single-line frontmatter', val2.error);
assert(!val2.description.includes('\n'), '4.2.1 Description contains no illegal linebreaks in frontmatter');

// 4.3 Persian UTF-8 description
const offlineSkill3 = {
  id: 'offline/persian-skill',
  name: 'persian-biostats',
  title: 'مهارت تخصصی آمار زیستی',
  description: 'تحلیل آماری داده‌های پزشکی و زیستی با SPSS و پایتون برای پروژه‌های بالینی',
  category: 'science',
  version: '1.0.0',
  triggers: ['/آمار-زیستی'],
};
const generatedMd3 = generateCanonicalSkillMd(offlineSkill3, 'persian-biostats');
const val3 = validateSkillFrontmatter(generatedMd3);
assert(val3.ok === true, '4.3 Persian UTF-8 text parsed accurately in frontmatter', val3.error);
assert(val3.description.includes('تحلیل آماری'), '4.3.1 Persian content preserved');

// 4.4 Corrupted upstream response fallback (e.g. HTML 404 page returned instead of markdown)
const html404 = '<!DOCTYPE html><html><head><title>404 Not Found</title></head><body>404 Not Found</body></html>';
const val404 = validateSkillFrontmatter(html404);
assert(val404.ok === false, '4.4 HTML 404 response correctly rejected by frontmatter validation gate', 'Expected rejection');

// 4.5 Missing name in frontmatter
const missingName = '---\ndescription: Has description but no name\n---\n# Body';
const valMissingName = validateSkillFrontmatter(missingName);
assert(valMissingName.ok === false, '4.5 Frontmatter missing name rejected', 'Expected rejection');

// 4.6 Missing description in frontmatter
const missingDesc = '---\nname: my-skill\n---\n# Body';
const valMissingDesc = validateSkillFrontmatter(missingDesc);
assert(valMissingDesc.ok === false, '4.6 Frontmatter missing description rejected', 'Expected rejection');

// ============================================================================
// SUITE 5: PREREQUISITE TELEMETRY PARSER STRESS TEST
// ============================================================================
console.log('\n--- SUITE 5: Prerequisite Telemetry Parser Stress Testing ---');

// 5.1 Standard allowed-tools, envVars, and CLI commands
const testMd1 = `---
name: agent-browser
description: Browser automation for AI
allowed-tools: Bash(agent-browser:*), Bash(npx agent-browser:*), read_file
---

# Setup Instructions

Requires TAVILY_API_KEY and GITHUB_TOKEN to perform research and commits.
Also needs JWT_SECRET and AWS_SECRET.

Install dependencies:
npm i -g @tavily/cli
npm install -g agent-browser
tvly login
pip install tavily-python
curl -fsSL https://agent-browser.dev/install.sh | bash
`;

const p1 = parsePrerequisitesFromMarkdown(testMd1);

assert(
  p1.allowedTools.length === 3 &&
  p1.allowedTools.includes('Bash(agent-browser:*)') &&
  p1.allowedTools.includes('Bash(npx agent-browser:*)') &&
  p1.allowedTools.includes('read_file'),
  '5.1.1 Extract multiple comma-separated allowed-tools',
  `Got: ${JSON.stringify(p1.allowedTools)}`
);

assert(
  p1.envVars.includes('TAVILY_API_KEY') &&
  p1.envVars.includes('GITHUB_TOKEN') &&
  p1.envVars.includes('JWT_SECRET') &&
  p1.envVars.includes('AWS_SECRET'),
  '5.1.2 Extract standard environment variables (API_KEY, TOKEN, SECRET)',
  `Got: ${JSON.stringify(p1.envVars)}`
);

assert(
  p1.cliCommands.includes('npm i -g @tavily/cli') &&
  p1.cliCommands.includes('npm install -g agent-browser') &&
  p1.cliCommands.includes('tvly login') &&
  p1.cliCommands.includes('pip install tavily-python') &&
  p1.cliCommands.includes('curl -fsSL https://agent-browser.dev/install.sh | bash'),
  '5.1.3 Extract varied CLI install commands',
  `Got: ${JSON.stringify(p1.cliCommands)}`
);

// 5.2 Database key exclusions (PRIMARY_KEY, FOREIGN_KEY, ROW_KEY, COMPOSITE_KEY)
const testMdDb = `
Table has PRIMARY_KEY and FOREIGN_KEY constraints with ROW_KEY indexing.
COMPOSITE_KEY is also present.
However, you need DB_AUTH_TOKEN and BACKEND_API_KEY.
`;
const pDb = parsePrerequisitesFromMarkdown(testMdDb);
assert(
  !pDb.envVars.includes('PRIMARY_KEY') &&
  !pDb.envVars.includes('FOREIGN_KEY') &&
  !pDb.envVars.includes('ROW_KEY') &&
  !pDb.envVars.includes('COMPOSITE_KEY'),
  '5.2.1 Database schema keys properly excluded from envVars',
  `Got: ${JSON.stringify(pDb.envVars)}`
);
assert(
  pDb.envVars.includes('DB_AUTH_TOKEN') && pDb.envVars.includes('BACKEND_API_KEY'),
  '5.2.2 Real env tokens still extracted alongside excluded db keys',
  `Got: ${JSON.stringify(pDb.envVars)}`
);

// 5.3 Adversarial Short Key Names (e.g. HF_TOKEN, GH_TOKEN, AI_API_KEY, S3_SECRET)
const testMdShort = `
Requires HF_TOKEN (Hugging Face) and GH_TOKEN (GitHub) and AI_API_KEY.
`;
const pShort = parsePrerequisitesFromMarkdown(testMdShort);
console.log('  [TELEMETRY] Short key extraction check:');
console.log(`    HF_TOKEN extracted? ${pShort.envVars.includes('HF_TOKEN')}`);
console.log(`    GH_TOKEN extracted? ${pShort.envVars.includes('GH_TOKEN')}`);
console.log(`    AI_API_KEY extracted? ${pShort.envVars.includes('AI_API_KEY')}`);

assert(
  pShort.envVars.includes('HF_TOKEN') && pShort.envVars.includes('GH_TOKEN'),
  '5.3 Short prefix tokens (HF_TOKEN, GH_TOKEN) support check',
  `Current regex requires >= 3 chars before underscore. Got: ${JSON.stringify(pShort.envVars)}`
);

// 5.4 Malformed / Edge Case Inputs to parsePrerequisitesFromMarkdown
assert(
  JSON.stringify(parsePrerequisitesFromMarkdown(null)) === JSON.stringify({ envVars: [], cliCommands: [], allowedTools: [], dependencies: [] }),
  '5.4.1 Null input handled safely',
  'Did not return clean empty structure'
);
assert(
  JSON.stringify(parsePrerequisitesFromMarkdown(undefined)) === JSON.stringify({ envVars: [], cliCommands: [], allowedTools: [], dependencies: [] }),
  '5.4.2 Undefined input handled safely',
  'Did not return clean empty structure'
);
assert(
  JSON.stringify(parsePrerequisitesFromMarkdown(12345)) === JSON.stringify({ envVars: [], cliCommands: [], allowedTools: [], dependencies: [] }),
  '5.4.3 Non-string input handled safely',
  'Did not return clean empty structure'
);

// 5.5 ReDoS Stress Test: 10,000 characters input
const startReDos = Date.now();
const largeEvilString = 'npm i -g ' + 'a/'.repeat(5000) + '\n' + 'TAVILY_API_KEY '.repeat(1000);
const pLarge = parsePrerequisitesFromMarkdown(largeEvilString);
const durationReDos = Date.now() - startReDos;
assert(
  durationReDos < 200,
  `5.5 Large 10KB input parsed within ${durationReDos}ms (< 200ms)`,
  `Took ${durationReDos}ms`
);

// ============================================================================
// SUMMARY & VERDICT
// ============================================================================
console.log('\n================================================================');
console.log(`TOTAL TESTS: ${passCount + failCount}`);
console.log(`PASSED:      ${passCount}`);
console.log(`FAILED:      ${failCount}`);
console.log('================================================================\n');

if (findings.length > 0) {
  console.log('FINDINGS / POTENTIAL REGRESSIONS:');
  findings.forEach((f, idx) => {
    console.log(`${idx + 1}. [${f.testName}]`);
    console.log(`   ${f.details}`);
  });
}
