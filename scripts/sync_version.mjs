/**
 * Authoritative Single Source of Truth (SSoT) Version Synchronizer
 *
 * Reads the master version from root package.json and synchronizes it across:
 *  - src-tauri/tauri.conf.json
 *  - src-tauri/Cargo.toml
 *  - src-tauri/Cargo.lock
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pkgPath = path.join(rootDir, 'package.json');
if (!fs.existsSync(pkgPath)) {
  console.error('[sync-version] Error: package.json not found at', pkgPath);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const version = pkg.version;

if (!version || typeof version !== 'string') {
  console.error('[sync-version] Error: Invalid version in package.json:', version);
  process.exit(1);
}

console.log(`[sync-version] SSoT master version from package.json: ${version}`);

let modifiedCount = 0;

// 1. Sync src-tauri/tauri.conf.json
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
if (fs.existsSync(tauriConfPath)) {
  try {
    const raw = fs.readFileSync(tauriConfPath, 'utf-8');
    const conf = JSON.parse(raw);
    // In Tauri v2, version can either be '../package.json' or exact version string.
    // Keeping exact version or pointing to package.json ensures full toolchain compatibility.
    if (conf.version !== version && conf.version !== '../package.json') {
      conf.version = version;
      fs.writeFileSync(tauriConfPath, JSON.stringify(conf, null, 2) + '\n', 'utf-8');
      console.log(`  ✓ Updated src-tauri/tauri.conf.json -> ${version}`);
      modifiedCount++;
    } else {
      console.log(`  ✓ src-tauri/tauri.conf.json is in sync (${conf.version})`);
    }
  } catch (err) {
    console.error('  ✗ Failed to update tauri.conf.json:', err);
  }
}

// 2. Sync src-tauri/Cargo.toml
const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
if (fs.existsSync(cargoTomlPath)) {
  try {
    const cargoToml = fs.readFileSync(cargoTomlPath, 'utf-8');
    const packageRegex = /(\[package\][\s\S]*?version\s*=\s*")[^"]+(")/;
    if (packageRegex.test(cargoToml)) {
      const updatedCargo = cargoToml.replace(packageRegex, `$1${version}$2`);
      if (updatedCargo !== cargoToml) {
        fs.writeFileSync(cargoTomlPath, updatedCargo, 'utf-8');
        console.log(`  ✓ Updated src-tauri/Cargo.toml -> ${version}`);
        modifiedCount++;
      } else {
        console.log(`  ✓ src-tauri/Cargo.toml is in sync (${version})`);
      }
    }
  } catch (err) {
    console.error('  ✗ Failed to update Cargo.toml:', err);
  }
}

// 3. Sync src-tauri/Cargo.lock
const cargoLockPath = path.join(rootDir, 'src-tauri', 'Cargo.lock');
if (fs.existsSync(cargoLockPath)) {
  try {
    const cargoLock = fs.readFileSync(cargoLockPath, 'utf-8');
    const lockRegex = /(name\s*=\s*"antigravity-shield"\s*\n\s*version\s*=\s*")[^"]+(")/;
    if (lockRegex.test(cargoLock)) {
      const updatedLock = cargoLock.replace(lockRegex, `$1${version}$2`);
      if (updatedLock !== cargoLock) {
        fs.writeFileSync(cargoLockPath, updatedLock, 'utf-8');
        console.log(`  ✓ Updated src-tauri/Cargo.lock -> ${version}`);
        modifiedCount++;
      } else {
        console.log(`  ✓ src-tauri/Cargo.lock is in sync (${version})`);
      }
    }
  } catch (err) {
    console.error('  ✗ Failed to update Cargo.lock:', err);
  }
}

console.log(`[sync-version] Complete. (${modifiedCount} file(s) updated)`);
