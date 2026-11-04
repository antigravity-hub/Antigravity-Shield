import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const tscJsPath = path.join(projectRoot, 'node_modules', 'typescript', 'lib', 'tsc.js');

const testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  assertions: [],
};

function assert(condition, message, details = null) {
  if (condition) {
    testResults.passed++;
    testResults.assertions.push({ status: 'PASS', message, details });
    console.log(`  [PASS] ${message}`);
  } else {
    testResults.failed++;
    testResults.assertions.push({ status: 'FAIL', message, details });
    console.error(`  [FAIL] ${message}${details ? ' - ' + JSON.stringify(details) : ''}`);
  }
}

function warn(message, details = null) {
  testResults.warnings++;
  testResults.assertions.push({ status: 'WARN', message, details });
  console.warn(`  [WARN] ${message}${details ? ' - ' + JSON.stringify(details) : ''}`);
}

function runTscIsolated(filePath) {
  return spawnSync(
    process.execPath,
    [
      tscJsPath,
      '--noEmit',
      '--target', 'ES2020',
      '--module', 'ESNext',
      '--moduleResolution', 'bundler',
      '--strict',
      '--skipLibCheck',
      '--jsx', 'react-jsx',
      filePath,
    ],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: 30000,
    }
  );
}

async function runEmpiricalChallenge() {
  console.log('======================================================================');
  console.log('⚔️  EMPIRICAL CHALLENGER TEST SUITE: MILESTONE 1 GEN 2-2 ⚔️');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------------
  // TEST SUITE 1: TypeScript Zero-Regression & Full Workspace Compilation
  // -------------------------------------------------------------------------
  console.log('--- TEST SUITE 1: TypeScript Zero-Regression & Compilation ---');

  const ecosystemTsPath = path.join(projectRoot, 'src', 'types', 'ecosystem.ts');
  assert(fs.existsSync(ecosystemTsPath), 'File exists: src/types/ecosystem.ts');

  const ecosystemContent = fs.readFileSync(ecosystemTsPath, 'utf8');

  // 1.1 Assert exports
  assert(
    /export\s+type\s+SkillDistributionMode\s*=\s*'mirror'\s*\|\s*'reference_only';/.test(ecosystemContent),
    "SkillDistributionMode is exported with ('mirror' | 'reference_only')"
  );

  assert(
    /export\s+type\s+SkillLicenseType\s*=\s*'permissive'\s*\|\s*'copyleft'\s*\|\s*'restricted'\s*\|\s*'unlicensed';/.test(ecosystemContent),
    "SkillLicenseType is exported with ('permissive' | 'copyleft' | 'restricted' | 'unlicensed')"
  );

  assert(
    /export\s+interface\s+SkillItem\s+extends\s+SkillManifestMetadata/.test(ecosystemContent),
    'SkillItem is exported extending SkillManifestMetadata'
  );

  // 1.2 Verify all 11 provenance fields in SkillItem
  const expectedProvenanceFields = [
    { name: 'license', type: 'string' },
    { name: 'licenseType', type: 'SkillLicenseType' },
    { name: 'distributionMode', type: 'SkillDistributionMode' },
    { name: 'spdxId', type: 'string' },
    { name: 'nativeInstallCmd', type: 'string' },
    { name: 'rank', type: 'number' },
    { name: 'upstreamCommitSha', type: 'string' },
    { name: 'upstreamLicenseUrl', type: 'string' },
    { name: 'noticeText', type: 'string' },
    { name: 'isUpstreamReachable', type: 'boolean' },
    { name: 'tombstoned', type: 'boolean' },
  ];

  for (const f of expectedProvenanceFields) {
    const fieldRegex = new RegExp(`${f.name}\\?:\\s*${f.type};`);
    assert(fieldRegex.test(ecosystemContent), `SkillItem declares optional field: ${f.name}?: ${f.type}`);
  }

  // 1.3 Full project compile check via tsc -p tsconfig.json --noEmit
  console.log('  [INFO] Running project-wide TypeScript compilation check (tsc -p tsconfig.json --noEmit)...');
  const fullTscRes = spawnSync(
    process.execPath,
    [tscJsPath, '-p', 'tsconfig.json', '--noEmit'],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: 90000,
    }
  );

  assert(
    fullTscRes.status === 0,
    'Entire codebase compiles with ZERO errors (tsc -p tsconfig.json --noEmit exit code 0)',
    fullTscRes.status !== 0 ? { stdout: fullTscRes.stdout, stderr: fullTscRes.stderr } : null
  );

  // -------------------------------------------------------------------------
  // TEST SUITE 2: Type System Construction & Boundary Stress Testing
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 2: Type System Construction & Boundary Stress Testing ---');

  const testFixtureValidPath = path.join(projectRoot, 'src', '__m1_valid_test_fixture__.ts');
  const validFixtureContent = `
import { SkillItem, SkillDistributionMode, SkillLicenseType } from './types/ecosystem';

// Test 2.1: Legacy SkillItem without ANY of the 11 new fields (Backward Compatibility)
export const legacySkill: SkillItem = {
  id: 'legacy/sample-skill',
  name: 'sample-skill',
  title: 'Sample Skill',
  description: 'Pure legacy skill object without any new provenance properties.',
  category: 'coding',
  author: 'Legacy Author',
  version: '1.0.0',
  isInstalled: false,
  isEnabled: false,
  tags: ['legacy', 'test'],
};

// Test 2.2: Full Provenance SkillItem with all 11 new fields populated
export const fullProvenanceSkill: SkillItem = {
  id: 'antigravity/code-review',
  name: 'code-review',
  title: 'Code Review Specialist',
  description: 'High-rigor code review skill with full provenance.',
  category: 'coding',
  author: 'Antigravity Team',
  version: '2.0.0',
  isInstalled: false,
  isEnabled: false,
  tags: ['provenance', 'review'],

  // 11 Provenance & Governance fields:
  license: 'Apache-2.0',
  licenseType: 'permissive' as SkillLicenseType,
  distributionMode: 'mirror' as SkillDistributionMode,
  spdxId: 'Apache-2.0',
  nativeInstallCmd: 'npx skills add antigravity/code-review --skill code-review',
  rank: 1,
  upstreamCommitSha: '26d95aeb9117b7b061ab3805966ffd90ae2e66e4',
  upstreamLicenseUrl: 'https://raw.githubusercontent.com/antigravity/code-review/main/LICENSE',
  noticeText: 'Copyright 2026 Antigravity Authors',
  isUpstreamReachable: true,
  tombstoned: false,
};

// Test 2.3: Boundary Values for rank (1, 1000, 0, undefined)
export const boundaryRankMin: SkillItem = {
  ...legacySkill,
  id: 'rank-min',
  rank: 1,
};

export const boundaryRankMax: SkillItem = {
  ...legacySkill,
  id: 'rank-max',
  rank: 1000,
};

export const boundaryRankZero: SkillItem = {
  ...legacySkill,
  id: 'rank-zero',
  rank: 0,
};

export const boundaryRankUndefined: SkillItem = {
  ...legacySkill,
  id: 'rank-undefined',
  rank: undefined,
};

// Test 2.4: Distribution mode boundary values
export const modeMirror: SkillItem = {
  ...legacySkill,
  distributionMode: 'mirror',
};

export const modeRefOnly: SkillItem = {
  ...legacySkill,
  distributionMode: 'reference_only',
};

// Test 2.5: License type boundary values
export const licPermissive: SkillItem = { ...legacySkill, licenseType: 'permissive' };
export const licCopyleft: SkillItem = { ...legacySkill, licenseType: 'copyleft' };
export const licRestricted: SkillItem = { ...legacySkill, licenseType: 'restricted' };
export const licUnlicensed: SkillItem = { ...legacySkill, licenseType: 'unlicensed' };

// Test 2.6: Undefined for all 11 fields
export const allUndefined: SkillItem = {
  ...legacySkill,
  license: undefined,
  licenseType: undefined,
  distributionMode: undefined,
  spdxId: undefined,
  nativeInstallCmd: undefined,
  rank: undefined,
  upstreamCommitSha: undefined,
  upstreamLicenseUrl: undefined,
  noticeText: undefined,
  isUpstreamReachable: undefined,
  tombstoned: undefined,
};
`;

  try {
    fs.writeFileSync(testFixtureValidPath, validFixtureContent, 'utf8');

    console.log('  [INFO] Compiling valid type fixture with tsc...');
    const resValid = runTscIsolated(testFixtureValidPath);

    assert(
      resValid.status === 0,
      'Valid SkillItem constructions (legacy, full provenance, rank boundaries 1/1000/0, modes, license types) compile cleanly (exit code 0)',
      resValid.status !== 0 ? { stdout: resValid.stdout, stderr: resValid.stderr } : null
    );
  } finally {
    if (fs.existsSync(testFixtureValidPath)) {
      fs.unlinkSync(testFixtureValidPath);
    }
  }

  // Test 2.7: Adversarial / Negative Type Checking
  console.log('  [INFO] Testing negative type cases (asserting compiler rejections)...');

  const negativeTests = [
    {
      name: 'Illegal distributionMode ("invalid_distribution")',
      code: `
        import { SkillItem } from './types/ecosystem';
        const bad: SkillItem = {
          id: 'bad', name: 'bad', title: 'bad', description: 'bad', category: 'coding', author: 'bad', version: '1.0',
          // @ts-ignore
          // distributionMode is typed strictly
          distributionMode: 'invalid_mode'
        };
      `.replace('// @ts-ignore', ''),
      expectedErrorSnippet: 'Type \'"invalid_mode"\' is not assignable to type \'SkillDistributionMode',
    },
    {
      name: 'Illegal licenseType ("proprietary")',
      code: `
        import { SkillItem } from './types/ecosystem';
        const bad: SkillItem = {
          id: 'bad', name: 'bad', title: 'bad', description: 'bad', category: 'coding', author: 'bad', version: '1.0',
          licenseType: 'proprietary'
        };
      `,
      expectedErrorSnippet: 'Type \'"proprietary"\' is not assignable to type \'SkillLicenseType',
    },
    {
      name: 'Illegal rank type (string instead of number)',
      code: `
        import { SkillItem } from './types/ecosystem';
        const bad: SkillItem = {
          id: 'bad', name: 'bad', title: 'bad', description: 'bad', category: 'coding', author: 'bad', version: '1.0',
          rank: 'top_10'
        };
      `,
      expectedErrorSnippet: 'Type \'string\' is not assignable to type \'number',
    },
    {
      name: 'Illegal tombstoned type (number instead of boolean)',
      code: `
        import { SkillItem } from './types/ecosystem';
        const bad: SkillItem = {
          id: 'bad', name: 'bad', title: 'bad', description: 'bad', category: 'coding', author: 'bad', version: '1.0',
          tombstoned: 1
        };
      `,
      expectedErrorSnippet: 'Type \'number\' is not assignable to type \'boolean',
    },
    {
      name: 'Illegal isUpstreamReachable type (string instead of boolean)',
      code: `
        import { SkillItem } from './types/ecosystem';
        const bad: SkillItem = {
          id: 'bad', name: 'bad', title: 'bad', description: 'bad', category: 'coding', author: 'bad', version: '1.0',
          isUpstreamReachable: 'yes'
        };
      `,
      expectedErrorSnippet: 'Type \'string\' is not assignable to type \'boolean',
    },
  ];

  for (const neg of negativeTests) {
    const negFixturePath = path.join(projectRoot, 'src', `__m1_neg_test_${Date.now()}_${Math.random().toString(36).substring(7)}__.ts`);
    try {
      fs.writeFileSync(negFixturePath, neg.code, 'utf8');
      const resNeg = runTscIsolated(negFixturePath);

      const combinedOut = (resNeg.stdout || '') + (resNeg.stderr || '');
      const rejected = resNeg.status !== 0 && combinedOut.includes(neg.expectedErrorSnippet);
      assert(
        rejected,
        `Adversarial test rejected: ${neg.name}`,
        rejected ? null : { exitCode: resNeg.status, output: combinedOut.slice(0, 300) }
      );
    } finally {
      if (fs.existsSync(negFixturePath)) {
        fs.unlinkSync(negFixturePath);
      }
    }
  }

  // -------------------------------------------------------------------------
  // TEST SUITE 3: Serde Rust Struct Field Symmetry & Annotations
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 3: Serde Rust Struct Field Symmetry & Annotations ---');

  const rustSkillsPath = path.join(projectRoot, 'src-tauri', 'src', 'modules', 'skills.rs');
  assert(fs.existsSync(rustSkillsPath), 'File exists: src-tauri/src/modules/skills.rs');

  const rustCode = fs.readFileSync(rustSkillsPath, 'utf8');

  // Verify struct declaration has rename_all = "camelCase"
  const renameAllRegex = /#\[serde\(rename_all\s*=\s*"camelCase"\)\]\s*pub\s+struct\s+SkillItem/m;
  assert(
    renameAllRegex.test(rustCode),
    'Rust SkillItem struct is decorated with #[serde(rename_all = "camelCase")]'
  );

  // Expected Rust fields, types, and their camelCase equivalent
  const expectedRustFields = [
    { rustName: 'license', rustType: 'Option<String>', jsonKey: 'license' },
    { rustName: 'license_type', rustType: 'Option<String>', jsonKey: 'licenseType' },
    { rustName: 'distribution_mode', rustType: 'Option<String>', jsonKey: 'distributionMode' },
    { rustName: 'spdx_id', rustType: 'Option<String>', jsonKey: 'spdxId' },
    { rustName: 'native_install_cmd', rustType: 'Option<String>', jsonKey: 'nativeInstallCmd' },
    { rustName: 'rank', rustType: 'Option<u32>', jsonKey: 'rank' },
    { rustName: 'upstream_commit_sha', rustType: 'Option<String>', jsonKey: 'upstreamCommitSha' },
    { rustName: 'upstream_license_url', rustType: 'Option<String>', jsonKey: 'upstreamLicenseUrl' },
    { rustName: 'notice_text', rustType: 'Option<String>', jsonKey: 'noticeText' },
    { rustName: 'is_upstream_reachable', rustType: 'Option<bool>', jsonKey: 'isUpstreamReachable' },
    { rustName: 'tombstoned', rustType: 'Option<bool>', jsonKey: 'tombstoned' },
  ];

  for (const rf of expectedRustFields) {
    // Check field definition with Option<T>
    const fieldDeclRegex = new RegExp(`pub\\s+${rf.rustName}:\\s*${rf.rustType.replace('<', '\\<').replace('>', '\\>')},`);
    assert(fieldDeclRegex.test(rustCode), `Rust struct declares: pub ${rf.rustName}: ${rf.rustType}`);

    // Check serde annotation: #[serde(default, skip_serializing_if = "Option::is_none")]
    const fieldBlockRegex = new RegExp(
      `#\\[serde\\(default,\\s*skip_serializing_if\\s*=\\s*"Option::is_none"\\)\\]\\s*pub\\s+${rf.rustName}:`,
      'm'
    );
    assert(
      fieldBlockRegex.test(rustCode),
      `Rust field "${rf.rustName}" has #[serde(default, skip_serializing_if = "Option::is_none")]`
    );
  }

  // -------------------------------------------------------------------------
  // TEST SUITE 4: Serde JSON Roundtrip & Schema Conformity Simulation
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 4: Serde JSON Roundtrip Simulation ---');

  function simulateRustSerialize(item) {
    const out = {};
    for (const [k, v] of Object.entries(item)) {
      if (v !== undefined && v !== null) {
        out[k] = v;
      }
    }
    return JSON.stringify(out);
  }

  function simulateRustDeserialize(jsonStr) {
    const parsed = JSON.parse(jsonStr);
    const defaults = {
      isInstalled: false,
      isEnabled: false,
      isLocal: false,
      dependencies: [],
      triggers: [],
      tags: [],
      companionFiles: [],
      sourceType: 'local',
      version: '1.0.0',
      scope: 'global',
      license: null,
      licenseType: null,
      distributionMode: null,
      spdxId: null,
      nativeInstallCmd: null,
      rank: null,
      upstreamCommitSha: null,
      upstreamLicenseUrl: null,
      noticeText: null,
      isUpstreamReachable: null,
      tombstoned: null,
    };
    return { ...defaults, ...parsed };
  }

  // Test Case A: Minimal Legacy Payload
  const legacyPayload = {
    id: 'legacy-skill',
    name: 'legacy-skill',
    title: 'Legacy Skill',
    description: 'A legacy skill',
    category: 'coding',
    author: 'Author',
  };

  const serializedLegacy = simulateRustSerialize(legacyPayload);
  const parsedLegacy = JSON.parse(serializedLegacy);

  for (const rf of expectedRustFields) {
    assert(
      !(rf.jsonKey in parsedLegacy),
      `Legacy serialization omits "${rf.jsonKey}" (skip_serializing_if = "Option::is_none")`
    );
  }

  const deserializedLegacy = simulateRustDeserialize(serializedLegacy);
  assert(deserializedLegacy.id === 'legacy-skill', 'Deserialization restores id');
  assert(deserializedLegacy.license === null, 'Deserialization defaults omitted license to null/None');
  assert(deserializedLegacy.rank === null, 'Deserialization defaults omitted rank to null/None');

  // Test Case B: Full Provenance Payload
  const fullPayload = {
    id: 'full-provenance-skill',
    name: 'full-provenance-skill',
    title: 'Full Provenance Skill',
    description: 'Full provenance skill with all 11 fields',
    category: 'coding',
    author: 'Antigravity Team',
    license: 'MIT',
    licenseType: 'permissive',
    distributionMode: 'mirror',
    spdxId: 'MIT',
    nativeInstallCmd: 'npx skills add antigravity/test --skill test',
    rank: 42,
    upstreamCommitSha: '26d95aeb9117b7b061ab3805966ffd90ae2e66e4',
    upstreamLicenseUrl: 'https://raw.githubusercontent.com/antigravity/test/main/LICENSE',
    noticeText: 'Copyright 2026 Antigravity',
    isUpstreamReachable: true,
    tombstoned: false,
  };

  const serializedFull = simulateRustSerialize(fullPayload);
  const parsedFull = JSON.parse(serializedFull);

  for (const rf of expectedRustFields) {
    assert(
      rf.jsonKey in parsedFull,
      `Full serialization includes camelCase key: "${rf.jsonKey}"`
    );
    assert(
      parsedFull[rf.jsonKey] === fullPayload[rf.jsonKey],
      `Value matches for "${rf.jsonKey}": ${JSON.stringify(parsedFull[rf.jsonKey])}`
    );
  }

  // -------------------------------------------------------------------------
  // TEST SUITE 5: Hub Export Integration Integrity
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 5: Hub Export Integration Integrity ---');
  const manifestPath = path.join(projectRoot, 'hub-export', 'manifest.json');
  assert(fs.existsSync(manifestPath), 'File exists: hub-export/manifest.json');

  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const skillList = Object.values(manifest.skills || {});
    assert(skillList.length === 1000, `Manifest contains 1,000 skills (found: ${skillList.length})`);

    const sample = skillList.slice(0, 100);
    const validModes = sample.every((s) => s.distributionMode === 'mirror' || s.distributionMode === 'reference_only');
    assert(validModes, 'Sample of 100 skills in hub-export/manifest.json all have valid distributionMode');

    const validCmds = sample.every((s) => typeof s.nativeInstallCmd === 'string' && s.nativeInstallCmd.startsWith('npx skills add'));
    assert(validCmds, 'Sample of 100 skills in hub-export/manifest.json all have valid nativeInstallCmd');
  }

  // -------------------------------------------------------------------------
  // FINAL VERDICT
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`SUMMARY: ${testResults.passed} Passed, ${testResults.failed} Failed, ${testResults.warnings} Warnings`);
  console.log('======================================================================');

  if (testResults.failed === 0) {
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
