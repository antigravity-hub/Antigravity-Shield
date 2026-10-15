import fs from 'fs';
import path from 'path';
import os from 'os';

console.log('================================================================');
console.log('   EMPIRICAL CHALLENGER R1/R2 TEST HARNESS');
console.log('   Physical Disk Installation, Staging & Invariants Stress Test');
console.log('================================================================\n');

const home = os.homedir();
const skillsRoot = path.join(home, '.gemini', 'config', 'skills');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assertTest(name, condition, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${name}`);
    if (details) console.log(`         (${details})`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${name}`);
    if (details) console.error(`         Details: ${details}`);
  }
}

// -----------------------------------------------------------------------------
// Core Invariant Implementations (matching src-tauri/src/modules/skills.rs)
// -----------------------------------------------------------------------------

function splitFrontmatter(content) {
  const clean = content.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') {
    i++;
  }
  if (i >= lines.length || lines[i].trim() !== '---') {
    return { frontmatterLines: [], body: clean, foundClosing: false };
  }
  i++;
  const frontmatterLines = [];
  let foundClosing = false;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '---') {
      const hasContent = frontmatterLines.some(l => !l.trim().startsWith('#') && l.trim().length > 0 && l.includes(':'));
      if (!hasContent) {
        // empty leading delimiter block, reset buffer
        frontmatterLines.length = 0;
        i++;
        continue;
      } else {
        foundClosing = true;
        i++;
        break;
      }
    } else {
      frontmatterLines.push(line);
      i++;
    }
  }
  const body = foundClosing ? lines.slice(i).join('\n') : clean;
  return { frontmatterLines, body, foundClosing };
}

function parseFrontmatterLines(lines) {
  const result = { name: null, description: null, category: null, triggers: [], other: {} };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      i++;
      continue;
    }
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim().toLowerCase();
      let val = line.slice(colonIdx + 1).trim();

      // Folded / literal multiline
      if (val === '>' || val === '>–' || val === '|' || val === '|-') {
        const isFolded = val.startsWith('>');
        const multiline = [];
        i++;
        while (i < lines.length) {
          const next = lines[i];
          if (next.startsWith(' ') || next.startsWith('\t')) {
            multiline.push(next.trim());
            i++;
          } else if (next.trim() === '') {
            i++;
          } else {
            break;
          }
        }
        val = isFolded ? multiline.join(' ') : multiline.join('\n');
      } else {
        i++;
      }

      val = val.replace(/^['"]|['"]$/g, '').trim();
      if (key === 'name') result.name = val;
      else if (key === 'description') result.description = val;
      else if (key === 'category') result.category = val;
      else result.other[key] = val;
    } else {
      i++;
    }
  }
  return result;
}

function validateSkillFrontmatter(content) {
  const { frontmatterLines, foundClosing } = splitFrontmatter(content);
  if (!foundClosing || frontmatterLines.length === 0) {
    return { ok: false, error: "Missing YAML frontmatter delimiters ('---')" };
  }
  const parsed = parseFrontmatterLines(frontmatterLines);
  if (!parsed.name || parsed.name.trim().length === 0) {
    return { ok: false, error: "YAML frontmatter missing required 'name' field" };
  }
  if (!parsed.description || parsed.description.trim().length === 0) {
    return { ok: false, error: "YAML frontmatter missing required 'description' field" };
  }
  return { ok: true, meta: parsed };
}

const FORBIDDEN_EXTENSIONS = new Set([
  'env', 'credentials', 'key', 'pem', 'crt', 'p12', 'pfx',
  'exe', 'bat', 'cmd', 'ps1', 'sh', 'vbs', 'py', 'js', 'ts',
  'db', 'sqlite', 'sqlite3', 'dll', 'so', 'dylib',
]);

const FORBIDDEN_FILENAMES = new Set([
  'mcp_config.json', 'config.json', 'settings.json', 'token.json',
  'accounts.json', 'credentials.json', 'id_rsa', 'id_ed25519',
]);

function validateReadBoundaryFence(filePath) {
  const fileName = path.basename(filePath);
  const isAllowed =
    fileName.toLowerCase() === 'skill.md' ||
    fileName.toLowerCase() === 'skill.md.disabled' ||
    fileName.toLowerCase() === 'plugin.json';

  if (!isAllowed) {
    return { ok: false, error: `Forbidden file '${fileName}'` };
  }
  if (fileName.startsWith('.')) {
    return { ok: false, error: `Hidden file '${fileName}' blocked` };
  }
  if (FORBIDDEN_FILENAMES.has(fileName.toLowerCase())) {
    return { ok: false, error: `Sensitive config '${fileName}' blocked` };
  }
  const ext = path.extname(filePath).replace(/^\./, '').toLowerCase();
  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    return { ok: false, error: `Forbidden extension '.${ext}'` };
  }
  if (filePath.includes('..')) {
    return { ok: false, error: "Directory traversal ('..') prohibited" };
  }
  return { ok: true };
}

// Matching skills.rs:972 read_skill_markdown sanitization
function validateReadSkillId(skillId) {
  if (
    !skillId ||
    skillId.length === 0 ||
    skillId.includes('/') ||
    skillId.includes('\\') ||
    skillId.includes('..') ||
    skillId.includes('\0')
  ) {
    return { ok: false, error: 'Invalid skill ID: directory traversal detected' };
  }
  return { ok: true };
}

// Matching skills.rs:1035 install_skill_physical
function sanitizeSkillInstallName(rawName) {
  const cleanName = rawName
    .replace(/\//g, '-')
    .replace(/\\/g, '-')
    .replace(/\.\./g, '')
    .replace(/\0/g, '')
    .trim();

  if (!cleanName || cleanName.length === 0) {
    return { ok: false, error: 'Invalid skill name for installation' };
  }
  const targetDir = path.join(skillsRoot, cleanName);
  const normalizedRoot = path.resolve(skillsRoot);
  const normalizedTarget = path.resolve(targetDir);

  if (!normalizedTarget.startsWith(normalizedRoot)) {
    return { ok: false, error: 'Path traversal detected in target directory' };
  }
  return { ok: true, cleanName, targetDir, normalizedTarget, normalizedRoot };
}

// Matching skills.rs:1142 companion file filter
function filterCompanionFile(companionRel) {
  const cleanRel = companionRel.trim().replace(/^\/+/, '').replace(/\\/g, '/');
  if (cleanRel.includes('..') || cleanRel.length === 0) {
    return { ok: false, error: 'Directory traversal or empty companion path' };
  }
  return { ok: true, cleanRel };
}

// =============================================================================
// TEST SUITE EXECUTION
// =============================================================================

console.log('--- TEST GROUP 1: YAML FRONTMATTER INVARIANTS ---');

// 1.1 Valid standard frontmatter
{
  const validDoc = `---
name: empirical-test-agent
description: Comprehensive verification of agent capabilities
category: automation
version: 1.0.0
---

# Empirical Test Agent
Body text here.
`;
  const res = validateSkillFrontmatter(validDoc);
  assertTest('1.1 Valid standard frontmatter passes', res.ok && res.meta.name === 'empirical-test-agent');
}

// 1.2 Missing opening delimiter
{
  const missingOpen = `name: test
description: missing opening delimiter
---
`;
  const res = validateSkillFrontmatter(missingOpen);
  assertTest('1.2 Missing opening delimiter is rejected', !res.ok && res.error.includes("Missing YAML frontmatter delimiters"));
}

// 1.3 Missing closing delimiter
{
  const missingClose = `---
name: test
description: missing closing delimiter
# No closing delimiter here
`;
  const res = validateSkillFrontmatter(missingClose);
  assertTest('1.3 Missing closing delimiter is rejected', !res.ok && res.error.includes("Missing YAML frontmatter delimiters"));
}

// 1.4 Missing name key
{
  const missingName = `---
description: This document has no name key
category: coding
---
`;
  const res = validateSkillFrontmatter(missingName);
  assertTest('1.4 Missing name key is rejected', !res.ok && res.error.includes("missing required 'name' field"));
}

// 1.5 Empty name value
{
  const emptyName = `---
name: ""
description: This document has an empty name
---
`;
  const res = validateSkillFrontmatter(emptyName);
  assertTest('1.5 Empty name string is rejected', !res.ok && res.error.includes("missing required 'name' field"));
}

// 1.6 Whitespace-only name value
{
  const wsName = `---
name: "   "
description: Whitespace name
---
`;
  const res = validateSkillFrontmatter(wsName);
  assertTest('1.6 Whitespace name is rejected', !res.ok && res.error.includes("missing required 'name' field"));
}

// 1.7 Missing description key
{
  const missingDesc = `---
name: valid-name-only
category: data
---
`;
  const res = validateSkillFrontmatter(missingDesc);
  assertTest('1.7 Missing description key is rejected', !res.ok && res.error.includes("missing required 'description' field"));
}

// 1.8 Empty description value
{
  const emptyDesc = `---
name: valid-name
description: ""
---
`;
  const res = validateSkillFrontmatter(emptyDesc);
  assertTest('1.8 Empty description is rejected', !res.ok && res.error.includes("missing required 'description' field"));
}

// 1.9 Multiline folded description
{
  const foldedDoc = `---
name: folded-agent
description: >
  This is a multiline folded description that spans
  multiple lines and should be merged properly.
version: 2.0.0
---
`;
  const res = validateSkillFrontmatter(foldedDoc);
  assertTest('1.9 Multiline folded description is valid', res.ok && res.meta.description.includes('multiline folded description'));
}

// 1.10 Double opening delimiter anomaly (e.g. core-web-vitals)
{
  const doubleDelim = `---

---
name: core-web-vitals
description: Optimize Core Web Vitals and Web Vitals metrics
---
`;
  const res = validateSkillFrontmatter(doubleDelim);
  assertTest('1.10 Double opening delimiter anomaly correctly handled', res.ok && res.meta.name === 'core-web-vitals');
}

console.log('\n--- TEST GROUP 2: PATH TRAVERSAL & SECURITY BOUNDARY FENCES ---');

// 2.1 Read Boundary: skill_id directory traversal rejection (skills.rs:972)
{
  const t1 = validateReadSkillId('../../evil');
  const t2 = validateReadSkillId('..\\..\\evil');
  const t3 = validateReadSkillId('nested/path');
  const t4 = validateReadSkillId('null\0byte');
  const t5 = validateReadSkillId('');
  const tValid = validateReadSkillId('valid-skill-name');

  assertTest('2.1 Read skill ID rejects ../../evil traversal', !t1.ok && t1.error.includes('directory traversal detected'));
  assertTest('2.2 Read skill ID rejects ..\\..\\evil Windows traversal', !t2.ok && t2.error.includes('directory traversal detected'));
  assertTest('2.3 Read skill ID rejects nested path slashes', !t3.ok && t3.error.includes('directory traversal detected'));
  assertTest('2.4 Read skill ID rejects null byte injection', !t4.ok && t4.error.includes('directory traversal detected'));
  assertTest('2.5 Read skill ID rejects empty string', !t5.ok && t5.error.includes('directory traversal detected'));
  assertTest('2.6 Read skill ID accepts valid clean name', tValid.ok);
}

// 2.7 ReadBoundaryFence: File level read boundary restrictions (skills.rs:256)
{
  const f1 = validateReadBoundaryFence(path.join(skillsRoot, 'test', '.env'));
  const f2 = validateReadBoundaryFence(path.join(skillsRoot, 'test', 'mcp_config.json'));
  const f3 = validateReadBoundaryFence(path.join(skillsRoot, 'test', 'id_rsa'));
  const f4 = validateReadBoundaryFence(path.join(skillsRoot, 'test', 'script.py'));
  const f5 = validateReadBoundaryFence(path.join(skillsRoot, 'test', '..', '..', 'secret.txt'));
  const fValid = validateReadBoundaryFence(path.join(skillsRoot, 'test', 'SKILL.md'));
  const fValidDisabled = validateReadBoundaryFence(path.join(skillsRoot, 'test', 'SKILL.md.disabled'));

  assertTest('2.7 Read boundary fence blocks .env file', !f1.ok);
  assertTest('2.8 Read boundary fence blocks mcp_config.json config', !f2.ok);
  assertTest('2.9 Read boundary fence blocks id_rsa private key', !f3.ok);
  assertTest('2.10 Read boundary fence blocks executable script .py', !f4.ok);
  assertTest('2.11 Read boundary fence blocks parent traversal ..', !f5.ok);
  assertTest('2.12 Read boundary fence permits standard SKILL.md', fValid.ok);
  assertTest('2.13 Read boundary fence permits disabled SKILL.md.disabled', fValidDisabled.ok);
}

// 2.14 Companion files traversal filter (skills.rs:1142)
{
  const c1 = filterCompanionFile('../escaped.txt');
  const c2 = filterCompanionFile('../../root.sh');
  const c3 = filterCompanionFile('..\\windows\\escaped.bat');
  const c4 = filterCompanionFile('');
  const cValid1 = filterCompanionFile('scripts/main.py');
  const cValid2 = filterCompanionFile('references/manual.pdf');
  const cValid3 = filterCompanionFile('scripts/nested/sub/tool.sh');

  assertTest('2.14 Companion filter rejects ../escaped.txt', !c1.ok);
  assertTest('2.15 Companion filter rejects deep ../../root.sh', !c2.ok);
  assertTest('2.16 Companion filter rejects Windows traversal ..\\escaped.bat', !c3.ok);
  assertTest('2.17 Companion filter rejects empty companion string', !c4.ok);
  assertTest('2.18 Companion filter permits valid relative scripts/main.py', cValid1.ok && cValid1.cleanRel === 'scripts/main.py');
  assertTest('2.19 Companion filter permits valid relative references/manual.pdf', cValid2.ok && cValid2.cleanRel === 'references/manual.pdf');
  assertTest('2.20 Companion filter permits nested script subpath', cValid3.ok && cValid3.cleanRel === 'scripts/nested/sub/tool.sh');
}

// 2.21 Installation directory path containment (skills.rs:1035)
{
  const s1 = sanitizeSkillInstallName('../../evil');
  assertTest('2.21 Traversal ../../evil is sanitized and strictly confined inside skillsRoot', s1.ok && s1.normalizedTarget.startsWith(s1.normalizedRoot) && !s1.cleanName.includes('/'));

  const s2 = sanitizeSkillInstallName('..\\..\\..\\windows\\system32');
  assertTest('2.22 Windows traversal is sanitized and strictly confined inside skillsRoot', s2.ok && s2.normalizedTarget.startsWith(s2.normalizedRoot) && !s2.cleanName.includes('\\'));

  const s3 = sanitizeSkillInstallName('....');
  assertTest('2.23 Pure traversal string "...." is sanitized to empty and rejected', !s3.ok && s3.error.includes('Invalid skill name'));

  const s4 = sanitizeSkillInstallName('legit-skill\0evil');
  assertTest('2.24 Null byte injection stripped', s4.ok && s4.cleanName === 'legit-skillevil');
}

console.log('\n--- TEST GROUP 3: PHYSICAL DISK INSTALLATION & STAGING SIMULATION ---');

// 3.1 Realistic skill physical installation with companion files
const testSkillName = 'empirical-challenger-stress-skill';
const testStagingName = `.tmp_${testSkillName}_${Date.now()}`;
const targetSkillDir = path.join(skillsRoot, testSkillName);
const stagingSkillDir = path.join(skillsRoot, testStagingName);

const realisticSkillMd = `---
name: ${testSkillName}
description: Autonomous empirical challenge skill verifying physical disk writes, directory staging, and companion file layout
category: automation
version: 1.0.0
triggers: [/${testSkillName}, /stress-test]
tags: [empirical, challenger, verification]
---

# Empirical Challenger Stress Skill

## Architecture Overview
This skill validates atomic two-phase directory promotion on Windows Win32 filesystems.

## Companion Scripts
- \`scripts/runner.py\`: Automated runner script
- \`scripts/sub/helper.sh\`: Nested helper utility
- \`references/schema.json\`: Verification schema
`;

const companionFilesData = [
  { relPath: 'scripts/runner.py', content: '#!/usr/bin/env python3\nprint("Empirical runner active")\n' },
  { relPath: 'scripts/sub/helper.sh', content: '#!/bin/bash\necho "Empirical nested helper"\n' },
  { relPath: 'references/schema.json', content: JSON.stringify({ version: '1.0', mode: 'empirical' }, null, 2) },
  { relPath: 'references/notes.txt', content: 'Verification guide and instructions.' },
];

try {
  if (!fs.existsSync(skillsRoot)) {
    fs.mkdirSync(skillsRoot, { recursive: true });
  }

  // Pre-cleanup if targetDir existed from prior run
  if (fs.existsSync(targetSkillDir)) {
    fs.rmSync(targetSkillDir, { recursive: true, force: true });
  }
  if (fs.existsSync(stagingSkillDir)) {
    fs.rmSync(stagingSkillDir, { recursive: true, force: true });
  }

  // Step A: Create Staging Directory
  fs.mkdirSync(stagingSkillDir, { recursive: true });
  assertTest('3.1 Staging directory created', fs.existsSync(stagingSkillDir), stagingSkillDir);

  // Step B: Write Primary SKILL.md in Staging
  const stagedSkillFile = path.join(stagingSkillDir, 'SKILL.md');
  fs.writeFileSync(stagedSkillFile, realisticSkillMd, 'utf8');
  assertTest('3.2 Staged SKILL.md written', fs.existsSync(stagedSkillFile));

  // Step C: Validate Staged Frontmatter before promotion (Validation Gate)
  const stagedContent = fs.readFileSync(stagedSkillFile, 'utf8');
  const stageVal = validateSkillFrontmatter(stagedContent);
  assertTest('3.3 Staged frontmatter validation gate passes', stageVal.ok && stageVal.meta.name === testSkillName);

  // Step D: Write Companion Files in Staging
  for (const companion of companionFilesData) {
    const fullCompanionPath = path.join(stagingSkillDir, companion.relPath);
    const parentDir = path.dirname(fullCompanionPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(fullCompanionPath, companion.content, 'utf8');
  }

  // Check presence of companion files in staging
  let allCompanionsStaged = true;
  for (const companion of companionFilesData) {
    if (!fs.existsSync(path.join(stagingSkillDir, companion.relPath))) {
      allCompanionsStaged = false;
    }
  }
  assertTest('3.4 Companion files created in scripts/ and references/', allCompanionsStaged);

  // Step E: Two-Phase Directory Promotion (Windows Safe Swap Simulation)
  const backupDir = path.join(skillsRoot, `.backup_${testSkillName}_${Date.now()}`);
  if (fs.existsSync(targetSkillDir)) {
    fs.renameSync(targetSkillDir, backupDir);
  }
  fs.renameSync(stagingSkillDir, targetSkillDir);
  if (fs.existsSync(backupDir)) {
    fs.rmSync(backupDir, { recursive: true, force: true });
  }

  assertTest('3.5 Atomic directory promotion to target completed', fs.existsSync(targetSkillDir));

  // Step F: Verify On-Disk File Content in Target Directory
  const installedSkillFile = path.join(targetSkillDir, 'SKILL.md');
  assertTest('3.6 Installed SKILL.md physically exists on disk', fs.existsSync(installedSkillFile));

  const installedContent = fs.readFileSync(installedSkillFile, 'utf8');
  assertTest('3.7 SKILL.md starts with delimiter ---', installedContent.trimStart().startsWith('---'));
  assertTest('3.8 SKILL.md contains second closing delimiter ---', installedContent.indexOf('---', 3) !== -1);

  const finalVal = validateSkillFrontmatter(installedContent);
  assertTest('3.9 Installed frontmatter strictly verified', finalVal.ok);
  assertTest('3.10 Non-empty name invariant verified', Boolean(finalVal.meta && finalVal.meta.name && finalVal.meta.name.trim().length > 0), `name="${finalVal.meta?.name}"`);
  assertTest('3.11 Non-empty description invariant verified', Boolean(finalVal.meta && finalVal.meta.description && finalVal.meta.description.trim().length > 0), `description length=${finalVal.meta?.description?.length}`);

  // Step G: Verify Companion Files Physical Presence on Disk
  for (const companion of companionFilesData) {
    const p = path.join(targetSkillDir, companion.relPath);
    const exists = fs.existsSync(p);
    const size = exists ? fs.statSync(p).size : 0;
    assertTest(`3.12 Companion file physically verified: ${companion.relPath}`, exists && size > 0, `size: ${size} bytes`);
  }

  // Step H: Test Toggle Physical Operation (SKILL.md -> SKILL.md.disabled)
  const disabledSkillFile = path.join(targetSkillDir, 'SKILL.md.disabled');
  fs.renameSync(installedSkillFile, disabledSkillFile);
  assertTest('3.13 Toggle disable renames to SKILL.md.disabled', fs.existsSync(disabledSkillFile) && !fs.existsSync(installedSkillFile));

  // Toggle re-enable
  fs.renameSync(disabledSkillFile, installedSkillFile);
  assertTest('3.14 Toggle enable restores SKILL.md', fs.existsSync(installedSkillFile) && !fs.existsSync(disabledSkillFile));

  // Step I: Clean up physical test directory
  fs.rmSync(targetSkillDir, { recursive: true, force: true });
  assertTest('3.15 Cleaned up physical test directory successfully', !fs.existsSync(targetSkillDir));

} catch (err) {
  console.error(`  ✗ Unexpected physical disk error: ${err.message}`);
  failedTests++;
  // Emergency cleanup
  if (fs.existsSync(stagingSkillDir)) fs.rmSync(stagingSkillDir, { recursive: true, force: true });
  if (fs.existsSync(targetSkillDir)) fs.rmSync(targetSkillDir, { recursive: true, force: true });
}

// -----------------------------------------------------------------------------
// Final Verdict & Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`TOTAL TESTS RUN : ${totalTests}`);
console.log(`PASSED TESTS   : ${passedTests}`);
console.log(`FAILED TESTS   : ${failedTests}`);
console.log('================================================================');

if (failedTests === 0) {
  console.log('>>> VERDICT: ALL EMPIRICAL CHALLENGES PASSED (APPROVE) <<<');
  process.exit(0);
} else {
  console.error(`>>> VERDICT: ${failedTests} CHALLENGE(S) FAILED (REQUEST_CHANGES) <<<`);
  process.exit(1);
}
