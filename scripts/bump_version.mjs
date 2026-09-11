/**
 * Unified Version Bumper
 *
 * Usage:
 *   node scripts/bump_version.mjs <patch|minor|major|x.y.z>
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node scripts/bump_version.mjs <patch|minor|major|x.y.z>');
  process.exit(1);
}

const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const currentVersion = pkg.version;

let newVersion = arg;
if (['patch', 'minor', 'major'].includes(arg.toLowerCase())) {
  const parts = currentVersion.split('.').map(n => parseInt(n, 10));
  if (parts.length < 3) {
    console.error(`Error: Cannot bump non-semver version "${currentVersion}"`);
    process.exit(1);
  }
  const mode = arg.toLowerCase();
  if (mode === 'major') {
    newVersion = `${parts[0] + 1}.0.0`;
  } else if (mode === 'minor') {
    newVersion = `${parts[0]}.${parts[1] + 1}.0`;
  } else if (mode === 'patch') {
    newVersion = `${parts[0]}.${parts[1]}.${(parts[2] || 0) + 1}`;
  }
}

// Validate semver format
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(newVersion)) {
  console.error(`Error: Invalid semver version format: "${newVersion}"`);
  process.exit(1);
}

console.log(`\n========================================`);
console.log(`  Bumping version: ${currentVersion} -> ${newVersion}`);
console.log(`========================================\n`);

// 1. Update package.json (SSoT)
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
console.log(`✓ Updated package.json version -> ${newVersion}`);

// 2. Run sync_version.mjs
const syncScript = path.join(__dirname, 'sync_version.mjs');
const result = spawnSync('node', [syncScript], { stdio: 'inherit', cwd: rootDir });

if (result.status !== 0) {
  console.error('✗ Failed to synchronize version across files');
  process.exit(result.status || 1);
}

console.log(`\n🎉 Successfully bumped and synchronized version to v${newVersion}!\n`);
