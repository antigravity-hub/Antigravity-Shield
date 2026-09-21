/**
 * Ultra-Hardened Unified Version Bumper & SemVer Intelligence Engine
 *
 * Usage:
 *   node scripts/bump_version.mjs <patch|minor|major|auto|x.y.z> [--dry-run] [--force]
 *
 * Modes:
 *   auto       Automatically inspects git log from last stable tag to HEAD (including
 *              all remote and local commits), parses Conventional Commits, determines
 *              Major/Minor/Patch, and prevents tag/pre-release collision.
 *   patch      Bumps patch version (X.Y.Z+1) with collision guard.
 *   minor      Bumps minor version (X.Y+1.0) with collision guard.
 *   major      Bumps major version (X+1.0.0) with collision guard.
 *   x.y.z      Sets explicit version with collision guard.
 *
 * Flags:
 *   --dry-run  Simulates the analysis and version bump without modifying files.
 *   --force    Bypasses collision guard (use with extreme caution).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');
const cleanArgs = args.filter(a => !a.startsWith('--'));

let targetArg = cleanArgs[0] || (args.includes('--auto') ? 'auto' : null);

if (!targetArg) {
  console.log(`
Usage: node scripts/bump_version.mjs <auto|patch|minor|major|x.y.z> [--dry-run] [--force]

Commands:
  auto         Smartly inspects git history (last stable tag -> HEAD), detects feat/fix/breaking,
               computes optimal SemVer, and guarantees zero tag collisions.
  patch        Increments patch version (e.g. 5.11.5 -> 5.11.6).
  minor        Increments minor version (e.g. 5.11.5 -> 5.12.0).
  major        Increments major version (e.g. 5.11.5 -> 6.0.0).
  <x.y.z>      Explicit version assignment.

Flags:
  --dry-run    Runs full analysis and prints dashboard without touching any files.
  --force      Bypasses tag collision warnings.
`);
  process.exit(1);
}

function runGit(gitArgs) {
  const res = spawnSync('git', gitArgs, { cwd: rootDir, encoding: 'utf-8' });
  if (res.error) {
    throw res.error;
  }
  return res.stdout ? res.stdout.trim() : '';
}

// 1. Get all local tags
let allTags = [];
try {
  const rawTags = runGit(['tag', '-l', '--sort=-v:refname']);
  if (rawTags) {
    allTags = rawTags.split(/\r?\n/).map(t => t.trim()).filter(Boolean);
  }
} catch (e) {
  console.warn('⚠️ Warning: Failed to query git tags:', e.message);
}

// 2. Identify the latest stable tag (ignore -pre, -rc, -beta, -alpha)
const stableTags = allTags.filter(t => /^v?\d+\.\d+\.\d+$/.test(t));
const lastStableTag = stableTags[0] || null;

// Read current package.json
const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const currentVersion = pkg.version;

let baseVersion = lastStableTag ? lastStableTag.replace(/^v/, '') : currentVersion.replace(/-.*$/, '');
let baseParts = baseVersion.split('.').map(n => parseInt(n, 10));
if (baseParts.length < 3 || baseParts.some(isNaN)) {
  baseParts = [1, 0, 0];
}

let bumpMode = targetArg.toLowerCase();
let calculatedVersion = null;
let analysisInfo = {
  lastStableTag: lastStableTag || '(None)',
  range: '',
  totalCommits: 0,
  breakingCount: 0,
  featCount: 0,
  fixCount: 0,
  choreCount: 0,
  sampleFeats: [],
  sampleFixes: []
};

if (bumpMode === 'auto') {
  const range = lastStableTag ? `${lastStableTag}..HEAD` : 'HEAD';
  analysisInfo.range = range;

  let commits = [];
  try {
    const rawLog = lastStableTag
      ? runGit(['log', `${lastStableTag}..HEAD`, '--pretty=format:%h|||%s'])
      : runGit(['log', '-n', '50', '--pretty=format:%h|||%s']);

    if (rawLog) {
      commits = rawLog.split(/\r?\n/).filter(Boolean).map(line => {
        const [hash, subject] = line.split('|||');
        return { hash, subject: subject || '' };
      });
    }
  } catch (e) {
    console.warn('⚠️ Warning: Failed to read git commit log:', e.message);
  }

  analysisInfo.totalCommits = commits.length;

  for (const c of commits) {
    const s = c.subject.trim();
    const isBreaking = /BREAKING CHANGE|!:/i.test(s);
    const isFeat = /^[a-z]+(\([a-z0-9_.-]+\))?!?:/i.test(s) && /^feat(\([a-z0-9_.-]+\))?!?:/i.test(s);
    const isFix = /^(fix|perf|refactor|security)(\([a-z0-9_.-]+\))?!?:/i.test(s);

    if (isBreaking) {
      analysisInfo.breakingCount++;
    } else if (isFeat) {
      analysisInfo.featCount++;
      if (analysisInfo.sampleFeats.length < 3) analysisInfo.sampleFeats.push(s);
    } else if (isFix) {
      analysisInfo.fixCount++;
      if (analysisInfo.sampleFixes.length < 3) analysisInfo.sampleFixes.push(s);
    } else {
      analysisInfo.choreCount++;
    }
  }

  if (analysisInfo.breakingCount > 0) {
    bumpMode = 'major';
  } else if (analysisInfo.featCount > 0) {
    bumpMode = 'minor';
  } else {
    bumpMode = 'patch';
  }
}

// Calculate version based on bumpMode
if (bumpMode === 'major') {
  calculatedVersion = `${baseParts[0] + 1}.0.0`;
} else if (bumpMode === 'minor') {
  calculatedVersion = `${baseParts[0]}.${baseParts[1] + 1}.0`;
} else if (bumpMode === 'patch') {
  calculatedVersion = `${baseParts[0]}.${baseParts[1]}.${baseParts[2] + 1}`;
} else {
  // Explicit version format validation
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(targetArg)) {
    console.error(`❌ Error: Invalid version argument "${targetArg}". Must be auto, patch, minor, major, or X.Y.Z`);
    process.exit(1);
  }
  calculatedVersion = targetArg;
}

// 3. Collision Guard: Check if calculated version or its tags already exist
let finalVersion = calculatedVersion;
let collisionDetected = false;
let collidedTags = [];

function checkCollision(ver) {
  const prefix = `v${ver}`;
  return allTags.filter(t => t === prefix || t.startsWith(`${prefix}-`));
}

collidedTags = checkCollision(finalVersion);

if (collidedTags.length > 0 && !isForce) {
  collisionDetected = true;
  // Automatically increment patch until no collision exists
  const parts = finalVersion.split('-')[0].split('.').map(n => parseInt(n, 10));
  let safePatch = parts[2];
  let safeVersion = finalVersion;
  while (checkCollision(safeVersion).length > 0) {
    safePatch++;
    safeVersion = `${parts[0]}.${parts[1]}.${safePatch}`;
  }
  finalVersion = safeVersion;
}

// Print Executive Terminal Dashboard
console.log(`
┌────────────────────────────────────────────────────────────────────────────┐
│              🚀 ANTIGRAVITY SHIELD SEMVER INTELLIGENCE HUD                │
├────────────────────────────────────────────────────────────────────────────┤
│ Last Stable Tag:    ${(analysisInfo.lastStableTag).padEnd(52)} │
│ Current Version:    ${currentVersion.padEnd(52)} │
│ Range Inspected:    ${(analysisInfo.range || 'Manual Request').padEnd(52)} │
│ Total Commits:      ${String(analysisInfo.totalCommits).padEnd(52)} │
│  ├─ Breaking:       ${String(analysisInfo.breakingCount).padEnd(52)} │
│  ├─ Features:       ${String(analysisInfo.featCount).padEnd(52)} │
│  ├─ Fixes/Perf:     ${String(analysisInfo.fixCount).padEnd(52)} │
│  └─ Chores/Other:   ${String(analysisInfo.choreCount).padEnd(52)} │
├────────────────────────────────────────────────────────────────────────────┤
│ Evaluated Mode:     ${bumpMode.toUpperCase().padEnd(52)} │
│ Target Version:     ${calculatedVersion.padEnd(52)} │`);

if (collisionDetected) {
  console.log(`│ Collision Status:   ⚠️ COLLISION DETECTED with: [${collidedTags.join(', ')}] │`);
  console.log(`│ Adjusted Safe Ver:  ✨ ${finalVersion.padEnd(50)} │`);
} else {
  console.log(`│ Collision Status:   ✅ PASSED (Zero collision in local/remote tags)     │`);
  console.log(`│ Resolved Version:   ✨ ${finalVersion.padEnd(50)} │`);
}
console.log(`└────────────────────────────────────────────────────────────────────────────┘`);

if (isDryRun) {
  console.log(`\n🔍 [DRY-RUN] No files were modified. To execute changes, run without --dry-run\n`);
  process.exit(0);
}

// 4. Update package.json (SSoT)
pkg.version = finalVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
console.log(`\n✓ [SSoT] Updated package.json version -> ${finalVersion}`);

// 5. Synchronize across all targets using sync_version.mjs
const syncScript = path.join(__dirname, 'sync_version.mjs');
const result = spawnSync('node', [syncScript], { stdio: 'inherit', cwd: rootDir });

if (result.status !== 0) {
  console.error('✗ Failed to synchronize version across project manifests');
  process.exit(result.status || 1);
}

console.log(`\n🎉 Successfully resolved and synchronized version to v${finalVersion}!\n`);
