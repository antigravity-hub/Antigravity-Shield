import fs from 'fs';
import path from 'path';

const en = JSON.parse(fs.readFileSync('src/locales/en.json', 'utf-8'));

function resolve(k) {
  const parts = k.split('.');
  let cur = en;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object' || !(p in cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

console.log('--- DYNAMIC KEYS INGESTION & COVERAGE CHECK ---');

// 1. AccentColorPicker
const accentSrc = fs.readFileSync('src/components/common/AccentColorPicker.tsx', 'utf-8');
const nameKeys = [...accentSrc.matchAll(/nameKey:\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
const descKeys = [...accentSrc.matchAll(/descKey:\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
console.log('Accent nameKeys missing in en.json:', nameKeys.filter(k => typeof resolve(k) !== 'string'));
console.log('Accent descKeys missing in en.json:', descKeys.filter(k => typeof resolve(k) !== 'string'));

// 2. ThinkingBudget
const tbSrc = fs.readFileSync('src/components/settings/ThinkingBudget.tsx', 'utf-8');
console.log('thinking_budget modes in en.json:', en.settings?.thinking_budget?.mode);
console.log('thinking_budget effort in en.json:', en.settings?.thinking_budget?.effort);

// 3. ImageThinkingMode
console.log('image_thinking_mode options in en.json:', en.settings?.image_thinking_mode?.options);

// 4. SpeedometerGauge / FleetVelocityGauge zones & arcs
console.log('velocity_gauge in en.json:', en.dashboard?.velocity_gauge);

// 5. brew_error in en.json
console.log('brew_error keys in en.json:', Object.keys(en.settings?.about || {}).filter(k => k.startsWith('brew_error')));

// 6. AccountDetailsDialog / AccountTable config.i18nKey
const accTableSrc = fs.readFileSync('src/components/accounts/AccountTable.tsx', 'utf-8');
const i18nKeys = [...accTableSrc.matchAll(/i18nKey:\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
console.log('AccountTable i18nKeys missing in en.json:', i18nKeys.filter(k => typeof resolve(k) !== 'string'));
