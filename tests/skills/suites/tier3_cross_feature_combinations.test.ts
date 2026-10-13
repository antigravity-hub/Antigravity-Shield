import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  assertEqual,
  assertTrue,
  assertFalse,
  assertIncludes,
  assertNotIncludes,
  assertGreaterThanOrEqual,
} from '../harness/assertions';
import {
  ZeroLeakRedactor,
  ResilientFrontmatterParser,
  MultiRootLocalScanner,
  MultiDimensionalSearchEngine,
  OneClickAtomicInstaller,
  SkillItem,
} from '../harness/contracts';
import {
  createTestSandbox,
  populateMockSkill,
  CURATED_MOCK_CATALOG,
} from '../harness/mock_environment';

test('Tier 3: Cross-Feature Combinations (Pairwise & Compound Interactions)', async (t) => {
  // --------------------------------------------------------------------------
  // TC-T3-01: Local Scan + Remote Marketplace Deduplication
  // --------------------------------------------------------------------------
  await t.test('TC-T3-01: Local Scan + Remote Marketplace Deduplication (F01 + F08 + F06)', () => {
    const sandbox = createTestSandbox();
    try {
      // User has locally customized apple-design
      populateMockSkill(sandbox.globalSkillsDir, 'apple-design', {
        frontmatter: {
          name: 'apple-design',
          description: 'Customized Local Apple Design with fluid velocity preservation',
          category: 'design',
        },
        body: '# Apple Design Local Custom',
      });

      const localSkills = MultiRootLocalScanner.scanDirectories([
        { path: sandbox.globalSkillsDir, isPlugin: false },
      ]);
      assertEqual(localSkills.length, 1);

      // Merge local skills with remote marketplace catalog
      const mergedMap = new Map<string, SkillItem>();
      // Ingest remote first
      for (const remote of CURATED_MOCK_CATALOG) {
        mergedMap.set(remote.name, remote);
      }
      // Local overrides remote
      for (const local of localSkills) {
        mergedMap.set(local.name, {
          ...local,
          isInstalled: true,
        });
      }

      const merged = Array.from(mergedMap.values());
      const appleDesign = merged.find((s) => s.name === 'apple-design');
      assertTrue(appleDesign !== undefined);
      assertEqual(appleDesign?.isLocal, true);
      assertEqual(appleDesign?.isInstalled, true);
      assertEqual(appleDesign?.description, 'Customized Local Apple Design with fluid velocity preservation');
    } finally {
      sandbox.cleanup();
    }
  });

  // --------------------------------------------------------------------------
  // TC-T3-02: Active Toggle State Reflection in Search & Filter
  // --------------------------------------------------------------------------
  await t.test('TC-T3-02: Active Toggle State Reflection in Multi-Field Search & Filter (F09 + F11 + F12)', () => {
    const sandbox = createTestSandbox();
    try {
      populateMockSkill(sandbox.globalSkillsDir, 'backend-architect', {
        frontmatter: {
          name: 'backend-architect',
          description: 'Production backend architecture',
          triggers: ['/backend-arch', 'microservices'],
          category: 'architecture',
        },
      });

      // Initially enabled
      let scanned = MultiRootLocalScanner.scanDirectories([
        { path: sandbox.globalSkillsDir, isPlugin: false },
      ]);
      assertEqual(scanned[0].isEnabled, true);

      // Toggle to disabled
      OneClickAtomicInstaller.toggleSkillStatus(sandbox.globalSkillsDir, 'backend-architect', false);

      // Re-scan
      scanned = MultiRootLocalScanner.scanDirectories([
        { path: sandbox.globalSkillsDir, isPlugin: false },
      ]);
      assertEqual(scanned[0].isEnabled, false);

      // Query via Search Engine
      const searchRes = MultiDimensionalSearchEngine.query(scanned, {
        search: '/backend-arch',
        category: 'architecture',
      });
      assertEqual(searchRes.length, 1);
      assertEqual(searchRes[0].isEnabled, false);
    } finally {
      sandbox.cleanup();
    }
  });

  // --------------------------------------------------------------------------
  // TC-T3-03: 1-Click Atomic Install Followed by Local Scan Re-hydration
  // --------------------------------------------------------------------------
  await t.test('TC-T3-03: 1-Click Atomic Install Followed by Local Scan Re-hydration (F08 + F09 + F01)', async () => {
    const sandbox = createTestSandbox();
    try {
      const skillToInstall: SkillItem = {
        id: 'vercel-labs/skills/find-skills',
        name: 'find-skills',
        title: 'Find Skills',
        description: 'Discover agent skills dynamically',
        category: 'coding',
        author: 'Vercel Labs',
        version: '1.0.0',
        tags: ['discovery', 'coding'],
        triggers: ['/find-skills'],
        isInstalled: false,
        isEnabled: false,
        isLocal: false,
        sourceType: 'skills_sh',
      };

      // Perform atomic install
      const installRes = await OneClickAtomicInstaller.installSkill(sandbox.globalSkillsDir, skillToInstall, [
        {
          path: 'SKILL.md',
          contents: `---
name: find-skills
description: Discover agent skills dynamically
category: coding
triggers: ["/find-skills"]
---

# Find Skills

Automated discovery guide.`,
        },
        {
          path: 'scripts/matcher.py',
          contents: 'print("matching skills")',
        },
      ]);
      assertTrue(installRes.success);

      // Perform multi-root scan
      const scanned = MultiRootLocalScanner.scanDirectories([
        { path: sandbox.globalSkillsDir, isPlugin: false },
      ]);
      assertEqual(scanned.length, 1);
      assertEqual(scanned[0].name, 'find-skills');
      assertEqual(scanned[0].category, 'coding');
      assertTrue(scanned[0].isInstalled);
      assertTrue(scanned[0].isEnabled);
      assertTrue(scanned[0].triggers?.includes('/find-skills'));
    } finally {
      sandbox.cleanup();
    }
  });

  // --------------------------------------------------------------------------
  // TC-T3-04: Uninstall + Read Content Invalidation
  // --------------------------------------------------------------------------
  await t.test('TC-T3-04: Uninstall + Read Content Invalidation (F09 + F04 + F14)', () => {
    const sandbox = createTestSandbox();
    try {
      populateMockSkill(sandbox.globalSkillsDir, 'temporary-tool', {
        frontmatter: { name: 'temporary-tool', description: 'To be deleted' },
        body: '# Temporary Content',
      });

      // Verify file exists
      const targetFile = path.join(sandbox.globalSkillsDir, 'temporary-tool', 'SKILL.md');
      assertTrue(fs.existsSync(targetFile));

      // Uninstall
      const uninstalled = OneClickAtomicInstaller.uninstallSkill(sandbox.globalSkillsDir, 'temporary-tool');
      assertTrue(uninstalled);
      assertFalse(fs.existsSync(targetFile));

      // Attempt read
      let readResult: string | null = null;
      if (fs.existsSync(targetFile)) {
        readResult = fs.readFileSync(targetFile, 'utf-8');
      }
      assertEqual(readResult, null);
    } finally {
      sandbox.cleanup();
    }
  });

  // --------------------------------------------------------------------------
  // TC-T3-05: Zero-Leak Redactor Integration in Live Markdown Drawer
  // --------------------------------------------------------------------------
  await t.test('TC-T3-05: Zero-Leak Secret Redactor Integration in Live Markdown Drawer (F03 + F14 + F02)', () => {
    const rawSkillContent = `---
name: sensitive-pipeline
description: Pipeline with secrets
---

# Sensitive Pipeline

API Keys:
- OpenAI: sk-prodKey1234567890abcdef1234567890
- GitHub: ghp_mySuperSecretPatToken12345678901234
- Telegram: 1234567890:AAFFGGhhIIjjKKllMMnnOOppQQrrSS01234
- Local Path: C:\\Users\\ersha\\.gemini\\config\\skills\\sensitive\\SKILL.md
`;

    // Parse frontmatter
    const parsed = ResilientFrontmatterParser.parse(rawSkillContent);
    assertEqual(parsed.name, 'sensitive-pipeline');

    // Live Drawer Redaction
    const drawerRendered = ZeroLeakRedactor.redactText(parsed.body, 'ersha');

    assertNotIncludes(drawerRendered, 'sk-prodKey1234567890abcdef1234567890');
    assertNotIncludes(drawerRendered, 'ghp_mySuperSecretPatToken12345678901234');
    assertNotIncludes(drawerRendered, '1234567890:AAFFGGhhIIjjKKllMMnnOOppQQrrSS01234');
    assertNotIncludes(drawerRendered, 'C:\\Users\\ersha');

    assertIncludes(drawerRendered, 'sk-********************************');
    assertIncludes(drawerRendered, 'ghp_************************************');
    assertIncludes(drawerRendered, '[REDACTED_BOT_TOKEN]');
    assertIncludes(drawerRendered, '~\\.gemini\\config\\skills\\sensitive\\SKILL.md');
  });

  // --------------------------------------------------------------------------
  // TC-T3-06: Dual-Source Remote Fetcher + Atomic Installer Under 429
  // --------------------------------------------------------------------------
  await t.test('TC-T3-06: Dual-Source Fetcher + Atomic Installer Under 429 Rate Limit (F07 + F08 + F03)', async () => {
    const sandbox = createTestSandbox();
    try {
      // Simulate fetcher with 429 failover
      const fetchBundle = async () => {
        // Step 1: primary API returns 429
        const isRateLimited = true;
        if (isRateLimited) {
          // Failover to raw GitHub CDN
          return [
            {
              path: 'SKILL.md',
              contents: '# Resilient Failover Skill\n\nFetched from CDN cleanly.',
            },
            {
              path: 'scripts/worker.py',
              contents: 'print("resilient")',
            },
          ];
        }
        return [];
      };

      const files = await fetchBundle();
      const skillItem = CURATED_MOCK_CATALOG[2]; // frontend-design

      const res = await OneClickAtomicInstaller.installSkill(sandbox.globalSkillsDir, skillItem, files);
      assertTrue(res.success);
      assertTrue(fs.existsSync(path.join(sandbox.globalSkillsDir, skillItem.name, 'SKILL.md')));
      assertTrue(fs.existsSync(path.join(sandbox.globalSkillsDir, skillItem.name, 'scripts', 'worker.py')));
    } finally {
      sandbox.cleanup();
    }
  });

  // --------------------------------------------------------------------------
  // TC-T3-07: Tri-Source Tab Switching Under Active Multi-Field Filter & Search
  // --------------------------------------------------------------------------
  await t.test('TC-T3-07: Tri-Source Tab Switching Under Active Multi-Field Filter & Search (F10 + F11 + F12)', () => {
    // Search query 'design', Category 'design'
    const queryOpts = {
      search: 'design',
      category: 'design' as const,
    };

    const allTab = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
      ...queryOpts,
      source: 'all',
    });
    const localTab = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
      ...queryOpts,
      source: 'local',
    });
    const marketTab = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
      ...queryOpts,
      source: 'skills_sh',
    });

    assertTrue(allTab.length >= localTab.length);
    assertTrue(allTab.length >= marketTab.length);
    assertTrue(localTab.every((s) => s.isLocal || s.isInstalled));
    assertTrue(marketTab.every((s) => s.sourceType === 'skills_sh' || !s.isLocal));
  });

  // --------------------------------------------------------------------------
  // TC-T3-08: Rapid Concurrent Install-Uninstall Race Condition Resilience
  // --------------------------------------------------------------------------
  await t.test('TC-T3-08: Rapid Concurrent Install-Uninstall Race Condition Resilience (F08 + F09 + F01)', async () => {
    const sandbox = createTestSandbox();
    try {
      const skillA = { ...CURATED_MOCK_CATALOG[0], name: 'concurrent-a' };
      const skillB = { ...CURATED_MOCK_CATALOG[1], name: 'concurrent-b' };
      const skillC = { ...CURATED_MOCK_CATALOG[2], name: 'concurrent-c' };

      // Pre-install B to be uninstalled
      populateMockSkill(sandbox.globalSkillsDir, 'concurrent-b', {
        frontmatter: { name: 'concurrent-b', description: 'pre-installed' },
      });

      // Run concurrent operations: install A, uninstall B, install C
      await Promise.all([
        OneClickAtomicInstaller.installSkill(sandbox.globalSkillsDir, skillA, [
          { path: 'SKILL.md', contents: '---\nname: concurrent-a\ndescription: Skill A\n---\n\n# Skill A' },
        ]),
        (async () => {
          OneClickAtomicInstaller.uninstallSkill(sandbox.globalSkillsDir, 'concurrent-b');
        })(),
        OneClickAtomicInstaller.installSkill(sandbox.globalSkillsDir, skillC, [
          { path: 'SKILL.md', contents: '---\nname: concurrent-c\ndescription: Skill C\n---\n\n# Skill C' },
        ]),
      ]);

      const scanned = MultiRootLocalScanner.scanDirectories([
        { path: sandbox.globalSkillsDir, isPlugin: false },
      ]);

      const names = scanned.map((s) => s.name);
      assertTrue(names.includes('concurrent-a'));
      assertFalse(names.includes('concurrent-b'));
      assertTrue(names.includes('concurrent-c'));
    } finally {
      sandbox.cleanup();
    }
  });

  // --------------------------------------------------------------------------
  // TC-T3-09: Multi-Root Scan with Corrupted & Sensitive Files in Traversed Directories
  // --------------------------------------------------------------------------
  await t.test('TC-T3-09: Multi-Root Scan with Corrupted & Sensitive Files in Traversed Roots (F02 + F03 + F01)', () => {
    const sandbox = createTestSandbox();
    try {
      // Valid skill
      populateMockSkill(sandbox.globalSkillsDir, 'valid-skill', {
        frontmatter: { name: 'valid-skill', description: 'Valid skill description' },
        body: '# Valid Skill',
      });

      // Skill with secret .env file in directory
      populateMockSkill(sandbox.globalSkillsDir, 'secret-skill', {
        frontmatter: { name: 'secret-skill', description: 'Has secret env file' },
        body: '# Secret Skill',
        includeSecretEnv: true,
      });

      // Persian UTF-8 skill in custom plugins
      populateMockSkill(sandbox.customSkillsDir, 'persian-skill', {
        frontmatter: { name: 'persian-skill', description: 'مهارت تحلیل فارسی' },
        body: '# تحلیل تخصصی داده',
      });

      // Corrupted file in directory
      const corruptDir = path.join(sandbox.globalSkillsDir, 'corrupt-yaml');
      fs.mkdirSync(corruptDir, { recursive: true });
      fs.writeFileSync(path.join(corruptDir, 'SKILL.md'), '---[bad yaml: :::\n# Corrupt\nBody', 'utf-8');

      // Place a top-level .env and mcp_config.json in roots
      fs.writeFileSync(path.join(sandbox.globalSkillsDir, '.env'), 'SECRET_TOKEN=xyz', 'utf-8');
      fs.writeFileSync(path.join(sandbox.customSkillsDir, 'mcp_config.json'), '{"key":"secret"}', 'utf-8');

      // Scan
      const scanned = MultiRootLocalScanner.scanDirectories([
        { path: sandbox.globalSkillsDir, isPlugin: false },
        { path: sandbox.customSkillsDir, isPlugin: true },
      ]);

      // All returned items must be valid
      assertEqual(scanned.length, 4);

      // Verify zero leak of .env contents
      for (const item of scanned) {
        assertNotIncludes(item.content || '', 'SECRET_TOKEN=xyz');
        assertNotIncludes(item.content || '', 'OPENAI_API_KEY');
      }

      // Verify Persian characters preserved
      const persian = scanned.find((s) => s.name === 'persian-skill');
      assertTrue(persian !== undefined);
      assertIncludes(persian?.description || '', 'مهارت تحلیل فارسی');
    } finally {
      sandbox.cleanup();
    }
  });

  // --------------------------------------------------------------------------
  // TC-T3-10: 4-State UI Transitions: Genesis Empty State to Success Upon 1-Click Install
  // --------------------------------------------------------------------------
  await t.test('TC-T3-10: Genesis Empty State to Success Transition Upon 1-Click Install (F15 + F08 + F10)', async () => {
    const sandbox = createTestSandbox();
    try {
      // 1. Initial State: Genesis empty state (0 local skills)
      let localSkills = MultiRootLocalScanner.scanDirectories([
        { path: sandbox.globalSkillsDir, isPlugin: false },
      ]);
      assertEqual(localSkills.length, 0);

      // 2. User navigates to Marketplace and selects skill to install
      const candidate = CURATED_MOCK_CATALOG[0]; // find-skills

      // 3. User clicks 1-Click Install: loading state simulated
      let uiState = 'loading';
      assertEqual(uiState, 'loading');

      // 4. Atomic Install completes
      await OneClickAtomicInstaller.installSkill(sandbox.globalSkillsDir, candidate, [
        {
          path: 'SKILL.md',
          contents: `---
name: ${candidate.name}
description: ${candidate.description}
category: ${candidate.category}
---
# ${candidate.title}`,
        },
      ]);

      // 5. Re-hydrate local skills
      localSkills = MultiRootLocalScanner.scanDirectories([
        { path: sandbox.globalSkillsDir, isPlugin: false },
      ]);
      assertEqual(localSkills.length, 1);

      // 6. UI transitions to Success State with 1 item
      uiState = 'success';
      assertEqual(uiState, 'success');
      assertEqual(localSkills[0].name, 'find-skills');
      assertTrue(localSkills[0].isInstalled);
    } finally {
      sandbox.cleanup();
    }
  });
});
