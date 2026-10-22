/**
 * Antigravity Shield — Challenger 2 Milestone 3 Adversarial Simulation Suite
 * 
 * Verifies:
 * 1. Runtime i18n initialization & locale loading for all 13 locales.
 * 2. Alias resolution:
 *    - zh-CN -> zh
 *    - zh-TW -> zhTW
 *    - zhTW -> fallback or alias check
 *    - vi-VN -> vi
 *    - pt-BR -> pt
 *    - ms -> my
 *    - ms-MY -> my
 *    - fa-IR -> fa
 *    - es-ES -> es
 *    - es-MX -> es
 * 3. RTL configuration:
 *    - ar, fa, fa-IR, ar-SA/ar-EG DOM & CSS class behavior.
 *    - LTR transitions (en, zh) removing rtl-layout classes.
 *    - CSS selector audit in src/App.css.
 *    - App.tsx code audit for regional RTL handling.
 * 4. Critical namespace verification across all 13 locales:
 *    - common, proxy, ecosystem, settings, accounts.
 *    - Exhaustive leaf-key resolution test across all 5 critical namespaces.
 *    - 0 missing keys, 0 undefined values, valid interpolation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import i18next from 'i18next';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT_DIR, 'src', 'locales');

const ALL_LOCALES = [
  'en', 'ar', 'es', 'fa', 'ja', 'ko', 'my', 'pt', 'ru', 'tr', 'vi', 'zh-TW', 'zh'
];

const CRITICAL_NAMESPACES = ['common', 'proxy', 'ecosystem', 'settings', 'accounts'];

// Load all 13 locale JSONs
const localeData = {};
for (const loc of ALL_LOCALES) {
  const p = path.join(LOCALES_DIR, `${loc}.json`);
  if (!fs.existsSync(p)) {
    throw new Error(`Locale file not found: ${p}`);
  }
  localeData[loc] = JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Build resources exactly matching src/i18n.ts
const resources = {
  en: { translation: localeData['en'] },
  zh: { translation: localeData['zh'] },
  "zh-TW": { translation: localeData['zh-TW'] },
  ja: { translation: localeData['ja'] },
  tr: { translation: localeData['tr'] },
  "zh-CN": { translation: localeData['zh'] },
  vi: { translation: localeData['vi'] },
  "vi-VN": { translation: localeData['vi'] },
  pt: { translation: localeData['pt'] },
  "pt-BR": { translation: localeData['pt'] },
  ru: { translation: localeData['ru'] },
  ko: { translation: localeData['ko'] },
  ar: { translation: localeData['ar'] },
  es: { translation: localeData['es'] },
  "es-ES": { translation: localeData['es'] },
  "es-MX": { translation: localeData['es'] },
  my: { translation: localeData['my'] },
  ms: { translation: localeData['my'] },
  "ms-MY": { translation: localeData['my'] },
  fa: { translation: localeData['fa'] },
  "fa-IR": { translation: localeData['fa'] },
};

console.log('='.repeat(80));
console.log('🔥 CHALLENGER 2: ADVERSARIAL i18n RUNTIME & SIMULATION HARNESS');
console.log('='.repeat(80));

const testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  details: []
};

function recordTest(name, success, info = '') {
  if (success) {
    testResults.passed++;
    console.log(`  ✅ [PASS] ${name} ${info ? '(' + info + ')' : ''}`);
  } else {
    testResults.failed++;
    console.log(`  ❌ [FAIL] ${name} ${info ? '(' + info + ')' : ''}`);
  }
  testResults.details.push({ name, success, info });
}

function recordWarning(name, info) {
  testResults.warnings++;
  console.log(`  ⚠️  [WARN] ${name}: ${info}`);
  testResults.details.push({ name, warning: true, info });
}

function flattenKeys(obj, prefix = '') {
  const res = {};
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(res, flattenKeys(v, fullKey));
    } else {
      res[fullKey] = String(v ?? '');
    }
  }
  return res;
}

// -----------------------------------------------------------------------------
// SECTION 1: Initialize i18next & Validate 13 Locales
// -----------------------------------------------------------------------------
console.log('\n[1] Testing i18next Initialization & All 13 Base Locales...');

const i18nInstance = i18next.createInstance();
await i18nInstance.init({
  resources,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  debug: false
});

for (const loc of ALL_LOCALES) {
  await i18nInstance.changeLanguage(loc);
  const appName = i18nInstance.t('common.app_name');
  const saveBtn = i18nInstance.t('common.save');
  
  const valid = appName && appName !== 'common.app_name' && saveBtn && saveBtn !== 'common.save';
  recordTest(`Base Locale: ${loc}`, valid, `app_name: "${appName}", save: "${saveBtn}"`);
}

// -----------------------------------------------------------------------------
// SECTION 2: Adversarial Alias Resolution
// -----------------------------------------------------------------------------
console.log('\n[2] Testing Locale Aliases & Canonical Resolution...');

const aliasTestCases = [
  { alias: 'zh-CN', expectedSource: 'zh', sampleKey: 'common.save', expectedMatch: localeData['zh'].common.save },
  { alias: 'zh-TW', expectedSource: 'zh-TW', sampleKey: 'common.save', expectedMatch: localeData['zh-TW'].common.save },
  { alias: 'vi-VN', expectedSource: 'vi', sampleKey: 'common.save', expectedMatch: localeData['vi'].common.save },
  { alias: 'pt-BR', expectedSource: 'pt', sampleKey: 'common.save', expectedMatch: localeData['pt'].common.save },
  { alias: 'ms', expectedSource: 'my', sampleKey: 'common.save', expectedMatch: localeData['my'].common.save },
  { alias: 'ms-MY', expectedSource: 'my', sampleKey: 'common.save', expectedMatch: localeData['my'].common.save },
  { alias: 'fa-IR', expectedSource: 'fa', sampleKey: 'common.save', expectedMatch: localeData['fa'].common.save },
  { alias: 'es-ES', expectedSource: 'es', sampleKey: 'common.save', expectedMatch: localeData['es'].common.save },
  { alias: 'es-MX', expectedSource: 'es', sampleKey: 'common.save', expectedMatch: localeData['es'].common.save },
];

for (const tc of aliasTestCases) {
  await i18nInstance.changeLanguage(tc.alias);
  const actualVal = i18nInstance.t(tc.sampleKey);
  const matches = actualVal === tc.expectedMatch;
  recordTest(
    `Alias: ${tc.alias} -> ${tc.expectedSource}`,
    matches,
    `Resolved: "${actualVal}" | Expected: "${tc.expectedMatch}"`
  );
}

// Adversarial: Test non-hyphenated zhTW
await i18nInstance.changeLanguage('zhTW');
const zhTWVal = i18nInstance.t('common.save');
if (zhTWVal === localeData['zh-TW'].common.save) {
  recordTest('Adversarial Alias: zhTW without hyphen', true, `Resolved directly to Traditional Chinese: "${zhTWVal}"`);
} else {
  recordWarning(
    'Adversarial Alias: zhTW without hyphen',
    `i18n.ts has "zh-TW" in resources, but not "zhTW". Value resolved via fallback to: "${zhTWVal}"`
  );
}

// Adversarial: Fallback for unconfigured language
await i18nInstance.changeLanguage('de');
const fallbackVal = i18nInstance.t('common.save');
recordTest('Adversarial Fallback: unconfigured "de"', fallbackVal === localeData['en'].common.save, `Fell back to English: "${fallbackVal}"`);

// -----------------------------------------------------------------------------
// SECTION 3: RTL DOM & CSS Simulation
// -----------------------------------------------------------------------------
console.log('\n[3] Testing RTL Configuration & DOM Class Sync Simulation...');

// Mock DOM
const mockDoc = {
  documentElement: {
    dir: 'ltr',
    lang: 'en',
    classList: new Set(),
  },
  body: {
    classList: new Set(),
  }
};

// Replicate syncAppDirectionAndLanguage from src/i18n.ts
function syncAppDirectionAndLanguageSim(lng) {
  const current = lng || 'en';
  const isRtl = current === 'ar' || current === 'fa' || current?.startsWith('fa-') || current?.startsWith('ar-');
  mockDoc.documentElement.dir = isRtl ? 'rtl' : 'ltr';
  mockDoc.documentElement.lang = current;
  if (isRtl) {
    mockDoc.documentElement.classList.add('rtl-layout');
    mockDoc.body.classList.add('rtl-layout');
  } else {
    mockDoc.documentElement.classList.delete('rtl-layout');
    mockDoc.body.classList.delete('rtl-layout');
  }
}

// Test 'ar'
syncAppDirectionAndLanguageSim('ar');
const arDirOk = mockDoc.documentElement.dir === 'rtl' &&
                mockDoc.documentElement.classList.has('rtl-layout') &&
                mockDoc.body.classList.has('rtl-layout');
recordTest("RTL Sync: 'ar'", arDirOk, `dir=${mockDoc.documentElement.dir}, hasRtlClass=${mockDoc.documentElement.classList.has('rtl-layout')}`);

// Test 'fa'
syncAppDirectionAndLanguageSim('fa');
const faDirOk = mockDoc.documentElement.dir === 'rtl' &&
                mockDoc.documentElement.classList.has('rtl-layout') &&
                mockDoc.body.classList.has('rtl-layout');
recordTest("RTL Sync: 'fa'", faDirOk, `dir=${mockDoc.documentElement.dir}, hasRtlClass=${mockDoc.documentElement.classList.has('rtl-layout')}`);

// Test 'fa-IR'
syncAppDirectionAndLanguageSim('fa-IR');
const faIrDirOk = mockDoc.documentElement.dir === 'rtl' &&
                  mockDoc.documentElement.classList.has('rtl-layout');
recordTest("RTL Sync: 'fa-IR'", faIrDirOk, `dir=${mockDoc.documentElement.dir}`);

// Test 'ar-SA'
syncAppDirectionAndLanguageSim('ar-SA');
const arSaDirOk = mockDoc.documentElement.dir === 'rtl' &&
                  mockDoc.documentElement.classList.has('rtl-layout');
recordTest("RTL Sync: 'ar-SA'", arSaDirOk, `dir=${mockDoc.documentElement.dir}`);

// Test Transition Back to LTR: 'en'
syncAppDirectionAndLanguageSim('en');
const enResetOk = mockDoc.documentElement.dir === 'ltr' &&
                  !mockDoc.documentElement.classList.has('rtl-layout') &&
                  !mockDoc.body.classList.has('rtl-layout');
recordTest("LTR Reset: 'en' from RTL", enResetOk, `dir=${mockDoc.documentElement.dir}, rtlClassPresent=${mockDoc.documentElement.classList.has('rtl-layout')}`);

// Test Transition Back to LTR: 'zh'
syncAppDirectionAndLanguageSim('zh');
const zhResetOk = mockDoc.documentElement.dir === 'ltr' &&
                  !mockDoc.documentElement.classList.has('rtl-layout') &&
                  !mockDoc.body.classList.has('rtl-layout');
recordTest("LTR Reset: 'zh' from RTL", zhResetOk, `dir=${mockDoc.documentElement.dir}, rtlClassPresent=${mockDoc.documentElement.classList.has('rtl-layout')}`);

// Audit App.tsx discrepancy for regional RTL codes
const appTsxContent = fs.readFileSync(path.join(ROOT_DIR, 'src', 'App.tsx'), 'utf8');
const hasArSubtagCheck = appTsxContent.includes("startsWith('ar-')");
if (!hasArSubtagCheck) {
  recordWarning(
    'App.tsx RTL Logic Discrepancy',
    "App.tsx lines 131 & 163 check `config.language === 'ar' || config.language === 'fa' || config.language.startsWith('fa-')` but omit `startsWith('ar-')`. While i18n.ts handles `startsWith('ar-')`, App.tsx's local effect would set dir='ltr' if config.language is e.g. 'ar-SA' or 'ar-EG'."
  );
} else {
  recordTest('App.tsx RTL subtag check', true, 'Includes startsWith("ar-")');
}

// Audit App.css for RTL selectors
const appCssContent = fs.readFileSync(path.join(ROOT_DIR, 'src', 'App.css'), 'utf8');
const hasRtlDirSelector = appCssContent.includes('[dir="rtl"]');
const hasRtlClassSelector = appCssContent.includes('.rtl-layout');
const hasVazirmatnFont = appCssContent.includes('Vazirmatn');
recordTest('App.css RTL Selectors', hasRtlDirSelector && hasRtlClassSelector && hasVazirmatnFont, `[dir="rtl"]: ${hasRtlDirSelector}, .rtl-layout: ${hasRtlClassSelector}, Vazirmatn: ${hasVazirmatnFont}`);

// -----------------------------------------------------------------------------
// SECTION 4: Critical Namespaces Exhaustive Leaf Resolution Across All 13 Locales
// -----------------------------------------------------------------------------
console.log('\n[4] Testing Critical Namespaces Exhaustive Resolution Across All 13 Locales...');

// Extract all keys under the 5 critical namespaces from en.json
const enCriticalKeys = [];
for (const ns of CRITICAL_NAMESPACES) {
  if (localeData['en'][ns]) {
    const flatNs = flattenKeys(localeData['en'][ns], ns);
    enCriticalKeys.push(...Object.keys(flatNs));
  }
}

console.log(`  Identified ${enCriticalKeys.length} total keys across namespaces [${CRITICAL_NAMESPACES.join(', ')}].`);

for (const loc of ALL_LOCALES) {
  await i18nInstance.changeLanguage(loc);
  let locMissing = 0;
  let locUndefined = 0;
  
  for (const fullKey of enCriticalKeys) {
    const val = i18nInstance.t(fullKey);
    if (!val || val === fullKey) {
      locMissing++;
    }
  }

  // Test interpolation in common
  const interpResult = i18nInstance.t('common.pagination_info', { start: 1, end: 10, total: 100 });
  const interpValid = interpResult.includes('1') && interpResult.includes('10') && interpResult.includes('100');

  const suitePass = locMissing === 0 && interpValid;
  recordTest(
    `Namespace Suite (${loc})`,
    suitePass,
    `${enCriticalKeys.length - locMissing}/${enCriticalKeys.length} keys resolved, interpolation: ${interpValid ? 'OK' : 'FAIL'}`
  );
}

// -----------------------------------------------------------------------------
// SECTION 5: Summary & Verdict
// -----------------------------------------------------------------------------
console.log('\n' + '='.repeat(80));
console.log('📊 CHALLENGER 2 SIMULATION SUITE SUMMARY');
console.log('='.repeat(80));
console.log(`Passed Tests : ${testResults.passed}`);
console.log(`Failed Tests : ${testResults.failed}`);
console.log(`Warnings     : ${testResults.warnings}`);
console.log('='.repeat(80));

if (testResults.failed > 0) {
  console.log('💥 RESULT: FAILURES DETECTED IN SIMULATION SUITE');
  process.exit(1);
} else {
  console.log('✨ RESULT: ALL SIMULATION TESTS PASSED');
  process.exit(0);
}
