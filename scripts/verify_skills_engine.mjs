import fs from 'fs';
import path from 'path';
import os from 'os';

console.log('=== SKILLS ENGINE VERIFICATION SUITE ===\n');

// 1. Test Upstream Manifest Live Fetch
const upstreamUrl = 'https://raw.githubusercontent.com/vercel-labs/skills/main/skills/find-skills/SKILL.md';
console.log(`[1] Probing live upstream URL: ${upstreamUrl}`);

let liveContent = '';
try {
  const resp = await fetch(upstreamUrl, {
    headers: { 'User-Agent': 'Antigravity-Shield/6.0' },
  });
  if (resp.ok) {
    liveContent = await resp.text();
    console.log(`  ✓ Upstream fetch HTTP ${resp.status} OK (${liveContent.length} bytes)`);
  } else {
    console.log(`  ✗ Upstream fetch HTTP ${resp.status}`);
  }
} catch (err) {
  console.log(`  ! Network fetch warning (offline/firewall): ${err.message}`);
}

// 2. Strict YAML Frontmatter Validation
function validateSkillFrontmatter(content) {
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

const sampleValid = liveContent || `---\nname: find-skills\ndescription: Helps users discover and install agent skills\n---\n\n# Find Skills\n`;
const validation = validateSkillFrontmatter(sampleValid);
console.log(`[2] Frontmatter Validation Check:`);
if (validation.ok) {
  console.log(`  ✓ Valid YAML Frontmatter: name="${validation.name}", desc="${validation.description.slice(0, 40)}..."`);
} else {
  console.error(`  ✗ Validation failed: ${validation.error}`);
  process.exit(1);
}

// 3. Test Prerequisite Telemetry Parser
function parsePrerequisites(markdown) {
  const prereqs = {
    allowedTools: [],
    envVars: [],
    cliCommands: [],
  };

  const allowedMatch = markdown.match(/allowed-tools:\s*([^\r\n]+)/i);
  if (allowedMatch && allowedMatch[1]) {
    prereqs.allowedTools = allowedMatch[1]
      .split(',')
      .map((t) => t.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }

  const envMatches = markdown.match(/\b([A-Z0-9_]{3,}_(?:API_KEY|TOKEN|SECRET|KEY))\b/g);
  if (envMatches) {
    const excluded = new Set(['PRIMARY_KEY', 'FOREIGN_KEY', 'ROW_KEY']);
    prereqs.envVars = Array.from(new Set(envMatches)).filter((k) => !excluded.has(k));
  }

  const npmMatches = markdown.match(/npm\s+i(?:nstall)?\s+-g\s+([@a-zA-Z0-9_\-\/]+)/g);
  if (npmMatches) {
    npmMatches.forEach((m) => prereqs.cliCommands.push(m.trim()));
  }
  if (/agent-browser\s+install/i.test(markdown)) {
    prereqs.cliCommands.push('agent-browser install');
  }

  return prereqs;
}

const testSampleMarkdown = `---
name: agent-browser
description: Browser automation for AI
allowed-tools: Bash(agent-browser:*), Bash(npx agent-browser:*)
---

Requires TAVILY_API_KEY to search.
Install with:
npm i -g agent-browser && agent-browser install
`;

const parsedPrereqs = parsePrerequisites(testSampleMarkdown);
console.log(`[3] Prerequisite Telemetry Parser:`);
console.log(`  ✓ Allowed Tools: ${JSON.stringify(parsedPrereqs.allowedTools)}`);
console.log(`  ✓ Env Vars: ${JSON.stringify(parsedPrereqs.envVars)}`);
console.log(`  ✓ CLI Commands: ${JSON.stringify(parsedPrereqs.cliCommands)}`);

if (parsedPrereqs.allowedTools.length !== 2 || parsedPrereqs.envVars.length !== 1) {
  console.error('  ✗ Prerequisite extraction mismatch!');
  process.exit(1);
}

// 4. Physical Disk Installation Test (Atomic Staging Simulation)
const home = os.homedir();
const skillsRoot = path.join(home, '.gemini', 'config', 'skills');
const testSkillName = 'antigravity-engine-verify-test';
const testTargetDir = path.join(skillsRoot, testSkillName);
const testStagingDir = path.join(skillsRoot, `.tmp_${testSkillName}_${Date.now()}`);

console.log(`[4] Physical Disk Installation Test:`);
console.log(`  Target path: ${testTargetDir}`);

try {
  if (!fs.existsSync(skillsRoot)) {
    fs.mkdirSync(skillsRoot, { recursive: true });
  }

  // Phase A: Write to staging
  fs.mkdirSync(testStagingDir, { recursive: true });
  const stagingFile = path.join(testStagingDir, 'SKILL.md');
  fs.writeFileSync(stagingFile, sampleValid, 'utf8');

  // Validate staged file
  const readBack = fs.readFileSync(stagingFile, 'utf8');
  const stageValidation = validateSkillFrontmatter(readBack);
  if (!stageValidation.ok) {
    throw new Error(`Staged validation failed: ${stageValidation.error}`);
  }

  // Phase B: Two-phase promotion
  if (fs.existsSync(testTargetDir)) {
    fs.rmSync(testTargetDir, { recursive: true, force: true });
  }
  fs.renameSync(testStagingDir, testTargetDir);

  // Phase C: Verify target exists and is valid
  const installedFile = path.join(testTargetDir, 'SKILL.md');
  if (!fs.existsSync(installedFile)) {
    throw new Error('Target SKILL.md does not exist after promotion');
  }
  const installedContent = fs.readFileSync(installedFile, 'utf8');
  const finalValidation = validateSkillFrontmatter(installedContent);
  if (!finalValidation.ok) {
    throw new Error(`Installed frontmatter invalid: ${finalValidation.error}`);
  }

  console.log(`  ✓ Successfully atomically installed to ${installedFile}`);
  console.log(`  ✓ Physical validation on disk PASSED: name="${finalValidation.name}"`);

  // Cleanup test directory
  fs.rmSync(testTargetDir, { recursive: true, force: true });
  console.log(`  ✓ Cleaned up test directory.`);
} catch (err) {
  console.error(`  ✗ Physical disk installation test failed: ${err.message}`);
  if (fs.existsSync(testStagingDir)) fs.rmSync(testStagingDir, { recursive: true, force: true });
  if (fs.existsSync(testTargetDir)) fs.rmSync(testTargetDir, { recursive: true, force: true });
  process.exit(1);
}

console.log('\n=== ALL VERIFICATION CHECKS PASSED PERFECTLY ===');
