import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveSkillDistribution, resolveNativeInstallCmd } from './exportHubSkills.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  assertions: [],
};

function assert(condition, message, details = null) {
  if (condition) {
    results.passed++;
    results.assertions.push({ status: 'PASS', message, details });
    console.log(`  [PASS] ${message}`);
  } else {
    results.failed++;
    results.assertions.push({ status: 'FAIL', message, details });
    console.error(`  [FAIL] ${message}${details ? ' - ' + JSON.stringify(details) : ''}`);
  }
}

function warn(message, details = null) {
  results.warnings++;
  results.assertions.push({ status: 'WARN', message, details });
  console.warn(`  [WARN] ${message}${details ? ' - ' + JSON.stringify(details) : ''}`);
}

async function runEmpiricalChallenge() {
  console.log('======================================================================');
  console.log('⚔️  EMPIRICAL CHALLENGER TEST SUITE: MILESTONE 1 (R1) ⚔️');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------------
  // TEST SUITE 1: Statutory & Regulatory Rigor of LEGAL_AND_SOURCING_GUIDE.md
  // -------------------------------------------------------------------------
  console.log('--- TEST SUITE 1: Statutory & Regulatory Rigor (docs/LEGAL_AND_SOURCING_GUIDE.md) ---');
  const legalGuidePath = path.join(projectRoot, 'docs', 'LEGAL_AND_SOURCING_GUIDE.md');

  assert(fs.existsSync(legalGuidePath), 'File exists: docs/LEGAL_AND_SOURCING_GUIDE.md');

  const legalContent = fs.existsSync(legalGuidePath) ? fs.readFileSync(legalGuidePath, 'utf8') : '';
  const legalSize = Buffer.byteLength(legalContent, 'utf8');

  assert(legalSize > 25600, `File size > 25 KB (actual: ${(legalSize / 1024).toFixed(2)} KB, ${legalSize} bytes)`);

  // Assert presence of mandatory sections § 1 through § 8
  const mandatorySections = [
    { num: 1, title: 'Executive Summary & Legal Framework', regex: /##\s*1\.\s+Executive Summary/i },
    { num: 2, title: 'Copyright Considerations for AI Agent Skills', regex: /##\s*2\.\s+Copyright Considerations/i },
    { num: 3, title: 'Comprehensive License Compatibility Matrix', regex: /##\s*3\.\s+Comprehensive License Compatibility Matrix/i },
    { num: 4, title: 'Dual-Tier Governance: Tier 1.*vs Tier 2', regex: /##\s*4\.\s+Dual-Tier Governance/i },
    { num: 5, title: 'Mandatory Attribution, Bundling & Provenance Protocols', regex: /##\s*5\.\s+Mandatory Attribution/i },
    { num: 6, title: 'Safe Harbor Compliance & Distributor Governance', regex: /##\s*6\.\s+Safe Harbor Compliance/i },
    { num: 7, title: 'Automated Upstream Reachability & Tombstone Synchronization', regex: /##\s*7\.\s+Automated Upstream Reachability/i },
    { num: 8, title: 'Compliance Checklist & Operational Runbook', regex: /##\s*8\.\s+Compliance Checklist/i },
  ];

  for (const sec of mandatorySections) {
    assert(sec.regex.test(legalContent), `Section § ${sec.num} present: "${sec.title}"`);
  }

  // Assert key legal terms and citations
  const requiredTerms = [
    '17 U.S.C. § 101',
    '102',
    '106',
    '107',
    '512',
    'Feist',
    'Baker v. Selden',
    'Perfect 10',
    'SPDX',
    'Tier 1',
    'Tier 2',
    'mirror',
    'reference_only',
    'Digital Services Act',
    'DSA',
    'tombstone',
    '24 hours',
  ];

  for (const term of requiredTerms) {
    assert(legalContent.includes(term), `Statutory citation / term present: "${term}"`);
  }

  console.log('\n--- TEST SUITE 2: Catalog & Manifest Distribution Validation ---');
  const manifestPath = path.join(projectRoot, 'hub-export', 'manifest.json');
  assert(fs.existsSync(manifestPath), 'File exists: hub-export/manifest.json');

  let manifest = null;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert(typeof manifest === 'object' && manifest !== null, 'manifest.json parses as valid JSON object');
  } catch (err) {
    assert(false, 'manifest.json parses as valid JSON', { error: err.message });
  }

  if (manifest && manifest.skills) {
    const skillEntries = Object.entries(manifest.skills);
    const totalSkills = skillEntries.length;
    console.log(`  [INFO] Total skills in manifest.skills: ${totalSkills}`);
    assert(totalSkills === 1000, `Manifest contains exactly 1,000 skills (found: ${totalSkills})`);

    let countValidDistributionMode = 0;
    let countMirror = 0;
    let countRefOnly = 0;
    let countValidInstallCmd = 0;
    let countValidLicenseOrType = 0;

    const invalidDistributionModes = [];
    const invalidInstallCmds = [];
    const invalidLicenses = [];

    const installCmdRegex = /^(npx skills add|git clone|npm install)/;

    for (const [id, skill] of skillEntries) {
      // Check distributionMode
      if (skill.distributionMode === 'mirror' || skill.distributionMode === 'reference_only') {
        countValidDistributionMode++;
        if (skill.distributionMode === 'mirror') countMirror++;
        else countRefOnly++;
      } else {
        invalidDistributionModes.push({ id, mode: skill.distributionMode });
      }

      // Check nativeInstallCmd
      if (skill.nativeInstallCmd && typeof skill.nativeInstallCmd === 'string' && installCmdRegex.test(skill.nativeInstallCmd.trim())) {
        countValidInstallCmd++;
      } else {
        invalidInstallCmds.push({ id, cmd: skill.nativeInstallCmd });
      }

      // Check license or licenseType
      const hasLicense = (skill.license && typeof skill.license === 'string' && skill.license.trim().length > 0);
      const hasLicenseType = (skill.licenseType && typeof skill.licenseType === 'string' && skill.licenseType.trim().length > 0);
      if (hasLicense || hasLicenseType) {
        countValidLicenseOrType++;
      } else {
        invalidLicenses.push({ id, license: skill.license, licenseType: skill.licenseType });
      }
    }

    assert(
      countValidDistributionMode === totalSkills,
      `100% of skills have valid distributionMode ('mirror' | 'reference_only') (${countValidDistributionMode}/${totalSkills})`,
      invalidDistributionModes.slice(0, 5)
    );
    console.log(`    -> Breakdown: mirror: ${countMirror}, reference_only: ${countRefOnly}`);

    assert(
      countValidInstallCmd === totalSkills,
      `100% of skills have non-empty nativeInstallCmd matching /^(npx skills add|git clone|npm install)/ (${countValidInstallCmd}/${totalSkills})`,
      invalidInstallCmds.slice(0, 5)
    );

    assert(
      countValidLicenseOrType === totalSkills,
      `100% of skills have license or licenseType declared (${countValidLicenseOrType}/${totalSkills})`,
      invalidLicenses.slice(0, 5)
    );
  }

  console.log('\n--- TEST SUITE 3: Physical Asset Bundling Inspection (hub-export/docs/) ---');
  const docsDir = path.join(projectRoot, 'hub-export', 'docs');
  assert(fs.existsSync(docsDir), 'Directory exists: hub-export/docs');

  if (fs.existsSync(docsDir)) {
    const subdirs = fs.readdirSync(docsDir).filter((d) => fs.statSync(path.join(docsDir, d)).isDirectory());
    console.log(`  [INFO] Found ${subdirs.length} exported skill directories in hub-export/docs/`);

    assert(subdirs.length >= 50, `Subdirectory count in hub-export/docs/ >= 50 (found: ${subdirs.length})`);

    // Verify all subdirs (or sample at least 50)
    let validBundleCount = 0;
    let licenseOnlyCount = 0;
    let noticeOnlyCount = 0;
    let bothCount = 0;
    let missingBoth = [];

    // Let's audit ALL 989 subdirectories!
    for (const slug of subdirs) {
      const dirPath = path.join(docsDir, slug);
      const hasLicense = fs.existsSync(path.join(dirPath, 'LICENSE.md'));
      const hasNotice = fs.existsSync(path.join(dirPath, 'NOTICE.md'));

      if (hasLicense && hasNotice) {
        bothCount++;
        validBundleCount++;
      } else if (hasLicense) {
        // verify license is non-empty
        const content = fs.readFileSync(path.join(dirPath, 'LICENSE.md'), 'utf8');
        if (content.length > 50 && content.includes('SPDX-License-Identifier')) {
          licenseOnlyCount++;
          validBundleCount++;
        } else {
          missingBoth.push({ slug, reason: 'LICENSE.md too small or missing SPDX' });
        }
      } else if (hasNotice) {
        // verify notice is non-empty
        const content = fs.readFileSync(path.join(dirPath, 'NOTICE.md'), 'utf8');
        if (content.length > 50 && content.includes('Legal Notice')) {
          noticeOnlyCount++;
          validBundleCount++;
        } else {
          missingBoth.push({ slug, reason: 'NOTICE.md too small or missing Legal Notice' });
        }
      } else {
        missingBoth.push({ slug, reason: 'Missing both LICENSE.md and NOTICE.md' });
      }
    }

    assert(
      missingBoth.length === 0,
      `100% of all ${subdirs.length} directories contain valid LICENSE.md or NOTICE.md`,
      missingBoth.slice(0, 5)
    );
    console.log(`    -> Bundling Breakdown: LICENSE.md only: ${licenseOnlyCount}, NOTICE.md only: ${noticeOnlyCount}, Both (collision): ${bothCount}`);

    // Specifically test a deterministic sample of 50 directories
    const sample50 = subdirs.slice(0, 50);
    const samplePassed = sample50.every((slug) => {
      const p = path.join(docsDir, slug);
      return fs.existsSync(path.join(p, 'LICENSE.md')) || fs.existsSync(path.join(p, 'NOTICE.md'));
    });
    assert(samplePassed, `Sample of 50 directories: 100% contain LICENSE.md or NOTICE.md`);
  }

  console.log('\n--- TEST SUITE 4: Adversarial Stress Tests & Schema Alignment ---');

  // Check TypeScript schema fields in src/types/ecosystem.ts
  const tsTypePath = path.join(projectRoot, 'src', 'types', 'ecosystem.ts');
  const tsContent = fs.readFileSync(tsTypePath, 'utf8');

  const expectedTsFields = [
    'license?: string;',
    'licenseType?: SkillLicenseType;',
    'distributionMode?: SkillDistributionMode;',
    'spdxId?: string;',
    'nativeInstallCmd?: string;',
    'rank?: number;',
    'upstreamCommitSha?: string;',
    'upstreamLicenseUrl?: string;',
    'noticeText?: string;',
    'isUpstreamReachable?: boolean;',
    'tombstoned?: boolean;',
  ];

  for (const field of expectedTsFields) {
    assert(tsContent.includes(field), `TypeScript SkillItem declares: ${field.trim()}`);
  }

  // Check Rust Serde struct fields in src-tauri/src/modules/skills.rs
  const rustPath = path.join(projectRoot, 'src-tauri', 'src', 'modules', 'skills.rs');
  const rustContent = fs.readFileSync(rustPath, 'utf8');

  const expectedRustFields = [
    'pub license: Option<String>,',
    'pub license_type: Option<String>,',
    'pub distribution_mode: Option<String>,',
    'pub spdx_id: Option<String>,',
    'pub native_install_cmd: Option<String>,',
    'pub rank: Option<u32>,',
    'pub upstream_commit_sha: Option<String>,',
    'pub upstream_license_url: Option<String>,',
    'pub notice_text: Option<String>,',
    'pub is_upstream_reachable: Option<bool>,',
    'pub tombstoned: Option<bool>,',
  ];

  for (const field of expectedRustFields) {
    assert(rustContent.includes(field), `Rust SkillItem declares: ${field.trim()}`);
  }

  // Check slug collisions blast radius
  const catalogTsPath = path.join(projectRoot, 'src', 'config', 'skillsCatalog.ts');
  const catalogTsContent = fs.readFileSync(catalogTsPath, 'utf8');
  const marker = 'export const SKILLS_SH_CATALOG: SkillItem[] = ';
  const startIdx = catalogTsContent.indexOf(marker);
  const jsonStart = startIdx + marker.length;
  const helperMarker = catalogTsContent.indexOf('// =========================================================================', jsonStart);
  const jsonEnd = catalogTsContent.lastIndexOf('];', helperMarker);
  const rawJson = catalogTsContent.slice(jsonStart, jsonEnd + 1).trim();
  const rawSkills = JSON.parse(rawJson);

  const slugMap = new Map();
  for (const s of rawSkills) {
    const slug = s.slug || s.name || s.id.replace(/\//g, '__');
    if (!slugMap.has(slug)) slugMap.set(slug, []);
    slugMap.get(slug).push(s);
  }

  const collidingSlugs = [...slugMap.entries()].filter(([_, list]) => list.length > 1);
  console.log(`  [INFO] Detected ${collidingSlugs.length} colliding slugs in catalog`);

  // Verify that even colliding slugs have at least LICENSE.md or NOTICE.md preserved
  let collisionsSafe = true;
  for (const [slug, list] of collidingSlugs) {
    const p = path.join(docsDir, slug);
    const hasLicense = fs.existsSync(path.join(p, 'LICENSE.md'));
    const hasNotice = fs.existsSync(path.join(p, 'NOTICE.md'));
    if (!hasLicense && !hasNotice) {
      collisionsSafe = false;
    }
  }
  assert(collisionsSafe, 'All colliding slugs retain at least one valid license or notice file in hub-export/docs');

  // Unit stress testing: resolveSkillDistribution logic (imported from scripts/exportHubSkills.mjs)
  console.log('\n--- TEST SUITE 5: Algorithmic Stress Testing (Classification & Resolvers) ---');

  // Permissive tests
  assert(resolveSkillDistribution({ license: 'MIT' }) === 'mirror', 'Permissive license "MIT" resolves to mirror');
  assert(resolveSkillDistribution({ license: 'Apache-2.0' }) === 'mirror', 'Permissive license "Apache-2.0" resolves to mirror');
  assert(resolveSkillDistribution({ license: 'BSD-3-Clause' }) === 'mirror', 'Permissive license "BSD-3-Clause" resolves to mirror');
  assert(resolveSkillDistribution({ license: 'ISC' }) === 'mirror', 'Permissive license "ISC" resolves to mirror');
  assert(resolveSkillDistribution({ license: 'Unlicense' }) === 'mirror', 'Permissive license "Unlicense" resolves to mirror');
  assert(resolveSkillDistribution({ license: 'CC0-1.0', licenseType: 'permissive' }) === 'mirror', 'Permissive license "CC0-1.0" with licenseType permissive resolves to mirror');

  // Copyleft and restricted tests
  assert(resolveSkillDistribution({ license: 'GPL-3.0' }) === 'reference_only', 'Copyleft license "GPL-3.0" resolves to reference_only');
  assert(resolveSkillDistribution({ license: 'AGPL-3.0' }) === 'reference_only', 'Copyleft license "AGPL-3.0" resolves to reference_only');
  assert(resolveSkillDistribution({ license: 'CC-BY-NC-4.0' }) === 'reference_only', 'Restricted license "CC-BY-NC-4.0" resolves to reference_only');
  assert(
    resolveSkillDistribution({ license: 'UNLICENSED' }) === 'reference_only',
    'Unlicensed ("UNLICENSED") must resolve to reference_only',
    {
      input: { license: 'UNLICENSED' },
      received: resolveSkillDistribution({ license: 'UNLICENSED' }),
      flaw: "lic.includes('UNLICENSE') evaluates to true for 'UNLICENSED', erroneously classifying proprietary works as Tier 1 mirrorable"
    }
  );
  assert(resolveSkillDistribution({}) === 'reference_only', 'Empty skill metadata safely defaults to reference_only');

  // Explicit distributionMode overrides
  assert(resolveSkillDistribution({ distributionMode: 'mirror', license: 'GPL-3.0' }) === 'mirror', 'Explicit distributionMode mirror respected');
  assert(resolveSkillDistribution({ distributionMode: 'reference_only', license: 'MIT' }) === 'reference_only', 'Explicit distributionMode reference_only respected');

  // Native install command resolvers
  assert(resolveNativeInstallCmd({ nativeInstallCmd: 'git clone https://custom.repo' }, 's1') === 'git clone https://custom.repo', 'Pre-existing nativeInstallCmd preserved verbatim');
  assert(resolveNativeInstallCmd({ owner: 'vercel-labs', repo: 'skills' }, 'find-skills') === 'npx skills add vercel-labs/skills --skill find-skills', 'Owner/repo resolution produces valid npx command');
  assert(resolveNativeInstallCmd({ repository: 'https://github.com/anthropics/anthropic-quickstarts' }, 'evals') === 'npx skills add anthropics/anthropic-quickstarts --skill evals', 'GitHub URL resolution cleans prefix and formats correctly');
  assert(resolveNativeInstallCmd({ id: 'standalone-skill' }, 'standalone-skill') === 'npx skills add standalone-skill', 'Fallback to skill id produces valid npx command');

  // Verify catalog.min.json integrity
  const minCatalogPath = path.join(projectRoot, 'hub-export', 'catalog.min.json');
  assert(fs.existsSync(minCatalogPath), 'File exists: hub-export/catalog.min.json');
  if (fs.existsSync(minCatalogPath)) {
    const minCatalog = JSON.parse(fs.readFileSync(minCatalogPath, 'utf8'));
    assert(Array.isArray(minCatalog), 'catalog.min.json is a valid JSON array');
    assert(minCatalog.length === 1000, `catalog.min.json has 1000 items (actual: ${minCatalog.length})`);
    const allMinHaveMode = minCatalog.every((item) => item.distributionMode === 'mirror' || item.distributionMode === 'reference_only');
    assert(allMinHaveMode, '100% of items in catalog.min.json declare valid distributionMode');
  }


  // -------------------------------------------------------------------------
  // FINAL VERDICT
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`SUMMARY: ${results.passed} Passed, ${results.failed} Failed, ${results.warnings} Warnings`);
  console.log('======================================================================');

  if (results.failed === 0) {
    console.log('\n>>> EMPIRICAL VERDICT: APPROVE <<<');
    process.exit(0);
  } else {
    console.error('\n>>> EMPIRICAL VERDICT: REQUEST_CHANGES <<<');
    process.exit(1);
  }
}

runEmpiricalChallenge().catch((err) => {
  console.error('Fatal execution error in challenge harness:', err);
  process.exit(2);
});
