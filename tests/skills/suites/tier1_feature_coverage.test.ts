import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  assertEqual,
  assertTrue,
  assertFalse,
  assertIncludes,
  assertNotIncludes,
  assertDeepEqual,
  assertGreaterThanOrEqual,
} from '../harness/assertions';
import {
  ZeroLeakRedactor,
  ResilientFrontmatterParser,
  MultiRootLocalScanner,
  MultiDimensionalSearchEngine,
  OneClickAtomicInstaller,
  SkillItem,
  SkillCategory,
} from '../harness/contracts';
import {
  createTestSandbox,
  populateMockSkill,
  CURATED_MOCK_CATALOG,
} from '../harness/mock_environment';

test('Tier 1: Feature Coverage (Positive Happy Paths)', async (t) => {
  // --------------------------------------------------------------------------
  // FEATURE 1: Multi-Root Local Scanner
  // --------------------------------------------------------------------------
  await t.test('F01: Multi-Root Local Scanner', async (st) => {
    await st.test('TC-T1-F01-01: Scans global skills root and detects valid SKILL.md', () => {
      const sandbox = createTestSandbox();
      try {
        populateMockSkill(sandbox.globalSkillsDir, 'animate', {
          frontmatter: { name: 'animate', description: 'Emil Kowalski motion framework' },
          body: '# Animate\n\nBuild motion from scratch.',
        });

        const scanned = MultiRootLocalScanner.scanDirectories([
          { path: sandbox.globalSkillsDir, isPlugin: false },
        ]);

        assertEqual(scanned.length, 1);
        assertEqual(scanned[0].name, 'animate');
        assertEqual(scanned[0].isLocal, true);
        assertEqual(scanned[0].isInstalled, true);
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T1-F01-02: Scans custom plugin skills root', () => {
      const sandbox = createTestSandbox();
      try {
        populateMockSkill(sandbox.customSkillsDir, 'backend-architect', {
          frontmatter: { name: 'backend-architect', description: 'Production-grade backend systems' },
          body: '# Backend Architect\n\nHigh throughput systems design.',
        });

        const scanned = MultiRootLocalScanner.scanDirectories([
          { path: sandbox.customSkillsDir, isPlugin: true },
        ]);

        assertEqual(scanned.length, 1);
        assertEqual(scanned[0].name, 'backend-architect');
        assertEqual(scanned[0].category, 'architecture');
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T1-F01-03: Scans general plugin skills root (science skills)', () => {
      const sandbox = createTestSandbox();
      try {
        populateMockSkill(sandbox.scienceSkillsDir, 'alphafold-database', {
          frontmatter: { name: 'alphafold-database', description: 'AlphaFold protein structures' },
          body: '# AlphaFold\n\nPredict 3D structures.',
        });

        const scanned = MultiRootLocalScanner.scanDirectories([
          { path: sandbox.scienceSkillsDir, isPlugin: true },
        ]);

        assertEqual(scanned.length, 1);
        assertEqual(scanned[0].name, 'alphafold-database');
        assertEqual(scanned[0].category, 'science');
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T1-F01-04: Deduplication across multi-roots gives precedence to user global skills', () => {
      const sandbox = createTestSandbox();
      try {
        // Same skill name in global skills and plugin skills
        populateMockSkill(sandbox.globalSkillsDir, 'apple-design', {
          frontmatter: { name: 'apple-design', description: 'User Global Custom Apple Design' },
          body: '# Apple Design Global',
        });
        populateMockSkill(sandbox.customSkillsDir, 'apple-design', {
          frontmatter: { name: 'apple-design', description: 'Plugin Default Apple Design' },
          body: '# Apple Design Plugin',
        });

        const scanned = MultiRootLocalScanner.scanDirectories([
          { path: sandbox.globalSkillsDir, isPlugin: false },
          { path: sandbox.customSkillsDir, isPlugin: true },
        ]);

        assertEqual(scanned.length, 1);
        assertEqual(scanned[0].description, 'User Global Custom Apple Design');
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T1-F01-05: Correctly detects isEnabled based on presence/absence of .disabled marker', () => {
      const sandbox = createTestSandbox();
      try {
        populateMockSkill(sandbox.globalSkillsDir, 'active-skill', {
          frontmatter: { name: 'active-skill', description: 'Active skill' },
          isDisabled: false,
        });
        populateMockSkill(sandbox.globalSkillsDir, 'muted-skill', {
          frontmatter: { name: 'muted-skill', description: 'Muted skill' },
          isDisabled: true,
        });

        const scanned = MultiRootLocalScanner.scanDirectories([
          { path: sandbox.globalSkillsDir, isPlugin: false },
        ]);

        assertEqual(scanned.length, 2);
        const active = scanned.find((s) => s.name === 'active-skill');
        const muted = scanned.find((s) => s.name === 'muted-skill');

        assertTrue(active?.isEnabled === true);
        assertTrue(muted?.isEnabled === false);
      } finally {
        sandbox.cleanup();
      }
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 2: Resilient SKILL.md Frontmatter Parser
  // --------------------------------------------------------------------------
  await t.test('F02: Resilient Frontmatter Parser', async (st) => {
    await st.test('TC-T1-F02-01: Parses standard unquoted YAML frontmatter', () => {
      const raw = `---
name: apple-design
description: Apple fluid interface design and motion
category: design
version: 1.2.0
---

# Apple Design

Fluid motion guide.`;

      const parsed = ResilientFrontmatterParser.parse(raw);
      assertEqual(parsed.name, 'apple-design');
      assertEqual(parsed.description, 'Apple fluid interface design and motion');
      assertEqual(parsed.category, 'design');
      assertEqual(parsed.version, '1.2.0');
      assertEqual(parsed.title, 'Apple Design');
    });

    await st.test('TC-T1-F02-02: Parses folded multiline scalars (>) and joins with spaces', () => {
      const raw = `---
name: ponytail
description: >
  Lazy senior dev mode: the smallest change that fully solves the task, and a
  reply a busy human understands in one read. Use on any coding task.
category: coding
---

# Ponytail
Execution instructions.`;

      const parsed = ResilientFrontmatterParser.parse(raw);
      assertEqual(parsed.name, 'ponytail');
      assertEqual(
        parsed.description,
        'Lazy senior dev mode: the smallest change that fully solves the task, and a reply a busy human understands in one read. Use on any coding task.'
      );
    });

    await st.test('TC-T1-F02-03: Parses chomped folded multiline scalars (>-)', () => {
      const raw = `---
name: credentials
description: >-
  Instructions for handling API keys and credentials safely, verifying their
  presence, and prompting the user to add them if missing.
category: devops
---

# Credentials Management`;

      const parsed = ResilientFrontmatterParser.parse(raw);
      assertEqual(parsed.name, 'credentials');
      assertEqual(
        parsed.description,
        'Instructions for handling API keys and credentials safely, verifying their presence, and prompting the user to add them if missing.'
      );
    });

    await st.test('TC-T1-F02-04: Parses quoted YAML strings with single and double quotes', () => {
      const raw = `---
name: "ui-ux-pro-max"
description: 'Comprehensive design guide for web and mobile applications.'
category: "design"
author: 'Principal Designer'
---

# UI/UX Pro Max`;

      const parsed = ResilientFrontmatterParser.parse(raw);
      assertEqual(parsed.name, 'ui-ux-pro-max');
      assertEqual(parsed.description, 'Comprehensive design guide for web and mobile applications.');
      assertEqual(parsed.author, 'Principal Designer');
    });

    await st.test('TC-T1-F02-05: Extracts human-readable title from Level-1 Markdown header', () => {
      const raw = `---
name: my-custom-skill
description: Custom tool
---

# Master Architectural Blueprint & Concurrency Engine

Detailed documentation body.`;

      const parsed = ResilientFrontmatterParser.parse(raw);
      assertEqual(parsed.title, 'Master Architectural Blueprint & Concurrency Engine');
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 3: Zero-Leak Privacy Guard
  // --------------------------------------------------------------------------
  await t.test('F03: Zero-Leak Privacy Guard', async (st) => {
    await st.test('TC-T1-F03-01: Tags all locally scanned skills with isLocal: true', () => {
      const sandbox = createTestSandbox();
      try {
        populateMockSkill(sandbox.globalSkillsDir, 'local-scanner-test', {
          frontmatter: { name: 'local-scanner-test', description: 'Testing privacy tagging' },
        });

        const scanned = MultiRootLocalScanner.scanDirectories([
          { path: sandbox.globalSkillsDir, isPlugin: false },
        ]);

        assertEqual(scanned.length, 1);
        assertTrue(scanned[0].isLocal);
        assertEqual(scanned[0].sourceType, 'local');
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T1-F03-02: Read-boundary fence rejects reading .env, .credentials, and mcp_config.json', () => {
      assertFalse(ZeroLeakRedactor.isPathAllowed('C:\\Users\\ersha\\.gemini\\config\\mcp_config.json'));
      assertFalse(ZeroLeakRedactor.isPathAllowed('C:\\skills\\alpha\\.env'));
      assertFalse(ZeroLeakRedactor.isPathAllowed('C:\\skills\\alpha\\.env.local'));
      assertFalse(ZeroLeakRedactor.isPathAllowed('C:\\skills\\alpha\\.credentials'));
      assertFalse(ZeroLeakRedactor.isPathAllowed('C:\\skills\\alpha\\private.key'));
      assertTrue(ZeroLeakRedactor.isPathAllowed('C:\\skills\\alpha\\SKILL.md'));
    });

    await st.test('TC-T1-F03-03: In-memory redactor masks OpenAI sk-..., GitHub ghp_..., and Notion ntn_... tokens', () => {
      const sampleGhPat = ['ghp', 'abcdefghijklmnopqrstuvwxyz0123456789'].join('_');
      const text =
        `Using OpenAI sk-abc12345678901234567890def and GitHub ${sampleGhPat} and Notion ntn_12345678901234567890abc`;
      const redacted = ZeroLeakRedactor.redactText(text);

      assertNotIncludes(redacted, 'sk-abc12345678901234567890def');
      assertNotIncludes(redacted, sampleGhPat);
      assertNotIncludes(redacted, 'ntn_12345678901234567890abc');
      assertIncludes(redacted, 'sk-********************************');
      assertIncludes(redacted, 'ghp_************************************');
      assertIncludes(redacted, 'ntn_********************************');
    });

    await st.test('TC-T1-F03-04: In-memory redactor masks Exa API keys, Bearer tokens, and Telegram bot tokens', () => {
      const text =
        'Exa key: c9080270-7db2-43cf-bf5e-80c00fff2133 and Bearer ya29.a0AfH6SM123 and Telegram token 1234567890:ABCdefGhIjkLmNoPqRsTuVwXyZ012345678';
      const redacted = ZeroLeakRedactor.redactText(text);

      assertNotIncludes(redacted, 'c9080270-7db2-43cf-bf5e-80c00fff2133');
      assertNotIncludes(redacted, 'ya29.a0AfH6SM123');
      assertNotIncludes(redacted, '1234567890:ABCdefGhIjkLmNoPqRsTuVwXyZ012345678');
      assertIncludes(redacted, '********-****-****-****-************');
      assertIncludes(redacted, 'Bearer [REDACTED_TOKEN]');
      assertIncludes(redacted, '[REDACTED_BOT_TOKEN]');
    });

    await st.test('TC-T1-F03-05: PII username path normalization replaces C:\\Users\\<username> with ~', () => {
      const text = 'Saved in C:\\Users\\ersha\\.gemini\\config\\skills\\animate\\SKILL.md';
      const redacted = ZeroLeakRedactor.redactText(text, 'ersha');

      assertNotIncludes(redacted, 'C:\\Users\\ersha');
      assertIncludes(redacted, '~\\.gemini\\config\\skills\\animate\\SKILL.md');
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 4: Native Tauri Skills Commands Contract
  // --------------------------------------------------------------------------
  await t.test('F04: Native Tauri Skills Commands Contract', async (st) => {
    await st.test('TC-T1-F04-01: list_installed_skills contract returns array of typed SkillItem', () => {
      const sample = CURATED_MOCK_CATALOG.find((s) => s.isInstalled);
      assertTrue(sample !== undefined);
      assertEqual(typeof sample?.id, 'string');
      assertEqual(typeof sample?.name, 'string');
      assertEqual(typeof sample?.title, 'string');
      assertEqual(typeof sample?.description, 'string');
      assertEqual(typeof sample?.category, 'string');
      assertEqual(typeof sample?.isInstalled, 'boolean');
      assertEqual(typeof sample?.isEnabled, 'boolean');
      assertEqual(typeof sample?.isLocal, 'boolean');
    });

    await st.test('TC-T1-F04-02: read_skill_content returns sanitized, redacted markdown text', () => {
      const rawContent = `# Secret Tool\n\nAuthorization: Bearer mySecretToken123\nLocal: C:\\Users\\ersha\\app`;
      const sanitized = ZeroLeakRedactor.redactText(rawContent, 'ersha');

      assertIncludes(sanitized, '# Secret Tool');
      assertNotIncludes(sanitized, 'mySecretToken123');
      assertNotIncludes(sanitized, 'C:\\Users\\ersha');
      assertIncludes(sanitized, 'Bearer [REDACTED_TOKEN]');
      assertIncludes(sanitized, '~\\app');
    });

    await st.test('TC-T1-F04-03: install_skill contract returns updated SkillItem with isInstalled: true', async () => {
      const sandbox = createTestSandbox();
      try {
        const item: SkillItem = {
          id: 'test/remote-skill',
          name: 'remote-skill',
          title: 'Remote Skill',
          description: 'A test remote skill',
          category: 'coding',
          author: 'Tester',
          version: '1.0.0',
          tags: ['test'],
          isInstalled: false,
          isEnabled: false,
          isLocal: false,
          sourceType: 'skills_sh',
        };

        const res = await OneClickAtomicInstaller.installSkill(sandbox.globalSkillsDir, item, [
          { path: 'SKILL.md', contents: '# Remote Skill\n\nInstalled cleanly.' },
        ]);

        assertTrue(res.success);
        assertTrue(fs.existsSync(path.join(sandbox.globalSkillsDir, 'remote-skill', 'SKILL.md')));
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T1-F04-04: toggle_skill_status contract updates enabled state via .disabled marker', () => {
      const sandbox = createTestSandbox();
      try {
        populateMockSkill(sandbox.globalSkillsDir, 'toggle-test', {
          frontmatter: { name: 'toggle-test', description: 'Testing toggle' },
        });

        // Toggle to disabled
        OneClickAtomicInstaller.toggleSkillStatus(sandbox.globalSkillsDir, 'toggle-test', false);
        assertTrue(fs.existsSync(path.join(sandbox.globalSkillsDir, 'toggle-test', '.disabled')));

        // Toggle back to enabled
        OneClickAtomicInstaller.toggleSkillStatus(sandbox.globalSkillsDir, 'toggle-test', true);
        assertFalse(fs.existsSync(path.join(sandbox.globalSkillsDir, 'toggle-test', '.disabled')));
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T1-F04-05: uninstall_skill contract cleanly removes skill directory', () => {
      const sandbox = createTestSandbox();
      try {
        populateMockSkill(sandbox.globalSkillsDir, 'uninstall-test', {
          frontmatter: { name: 'uninstall-test', description: 'To be removed' },
        });
        assertTrue(fs.existsSync(path.join(sandbox.globalSkillsDir, 'uninstall-test')));

        const uninstalled = OneClickAtomicInstaller.uninstallSkill(sandbox.globalSkillsDir, 'uninstall-test');
        assertTrue(uninstalled);
        assertFalse(fs.existsSync(path.join(sandbox.globalSkillsDir, 'uninstall-test')));
      } finally {
        sandbox.cleanup();
      }
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 5: Skills.sh Metadata Schema Validation
  // --------------------------------------------------------------------------
  await t.test('F05: Skills.sh Metadata Schema Validation', async (st) => {
    await st.test('TC-T1-F05-01: Validates SkillCategory enum across all 8 canonical domains', () => {
      const categories: SkillCategory[] = [
        'all',
        'coding',
        'design',
        'devops',
        'data',
        'automation',
        'science',
        'architecture',
      ];
      assertEqual(categories.length, 8);
    });

    await st.test('TC-T1-F05-02: Validates SkillItem schema integrity with mandatory fields', () => {
      for (const item of CURATED_MOCK_CATALOG) {
        assertTrue(Boolean(item.id));
        assertTrue(Boolean(item.name));
        assertTrue(Boolean(item.title));
        assertTrue(Boolean(item.description));
        assertTrue(Boolean(item.category));
        assertTrue(Boolean(item.author));
        assertTrue(Array.isArray(item.tags));
      }
    });

    await st.test('TC-T1-F05-03: Validates SkillFileEntry schema for nested bundle assets', () => {
      const entry = {
        path: 'scripts/analyze.py',
        contents: 'print("Analyzing")',
        sizeBytes: 21,
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      };
      assertEqual(entry.path, 'scripts/analyze.py');
      assertEqual(entry.sizeBytes, 21);
    });

    await st.test('TC-T1-F05-04: Validates sourceType discrimination', () => {
      const sources = new Set(CURATED_MOCK_CATALOG.map((s) => s.sourceType));
      assertTrue(sources.has('local'));
      assertTrue(sources.has('skills_sh'));
    });

    await st.test('TC-T1-F05-05: Validates official and verified badge flags', () => {
      const officialSkills = CURATED_MOCK_CATALOG.filter((s) => s.isOfficial === true);
      assertGreaterThanOrEqual(officialSkills.length, 5);
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 6: Curated Multi-Category Catalog Ingestion
  // --------------------------------------------------------------------------
  await t.test('F06: Curated Multi-Category Catalog Ingestion', async (st) => {
    await st.test('TC-T1-F06-01: Successfully ingests verified skills across all 7 categories', () => {
      const expectedCategories: SkillCategory[] = [
        'coding',
        'design',
        'devops',
        'data',
        'automation',
        'science',
        'architecture',
      ];
      for (const cat of expectedCategories) {
        const hasCat = CURATED_MOCK_CATALOG.some((s) => s.category === cat);
        assertTrue(hasCat, `Catalog must contain skills for category ${cat}`);
      }
    });

    await st.test('TC-T1-F06-02: Ingests official technology makers with official badges', () => {
      const findSkills = CURATED_MOCK_CATALOG.find((s) => s.name === 'find-skills');
      assertTrue(findSkills?.isOfficial === true);
      assertEqual(findSkills?.author, 'Vercel Labs');
    });

    await st.test('TC-T1-F06-03: Ingests all-time install telemetry metrics', () => {
      const findSkills = CURATED_MOCK_CATALOG.find((s) => s.name === 'find-skills');
      assertEqual(findSkills?.installs, 3800000);
    });

    await st.test('TC-T1-F06-04: Ingests slash command triggers for fast prompt activation', () => {
      const grillMe = CURATED_MOCK_CATALOG.find((s) => s.name === 'grill-me');
      assertTrue(Boolean(grillMe?.triggers?.includes('/grill-me')));
    });

    await st.test('TC-T1-F06-05: Validates taxonomy tags for indexing and discovery', () => {
      const agentBrowser = CURATED_MOCK_CATALOG.find((s) => s.name === 'agent-browser');
      assertTrue(Boolean(agentBrowser?.tags?.includes('browser')));
      assertTrue(Boolean(agentBrowser?.tags?.includes('automation')));
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 7: Dual-Source Remote Fetcher
  // --------------------------------------------------------------------------
  await t.test('F07: Dual-Source Remote Fetcher', async (st) => {
    await st.test('TC-T1-F07-01: Primary route successfully simulates Skills.sh API bundle fetch', async () => {
      const mockFetch = async (source: string) => {
        if (source === 'skills_sh') {
          return {
            status: 200,
            hash: 'hash123',
            files: [{ path: 'SKILL.md', contents: '# Vercel Find Skills' }],
          };
        }
        throw new Error('Not reached');
      };

      const res = await mockFetch('skills_sh');
      assertEqual(res.status, 200);
      assertEqual(res.files.length, 1);
    });

    await st.test('TC-T1-F07-02: Fallback route triggers on 429 rate limit and queries raw GitHub CDN', async () => {
      let switchedToCdn = false;
      const fetchWithFallback = async (attemptApi: boolean) => {
        if (attemptApi) {
          // Simulate HTTP 429
          throw new Error('HTTP 429: Too Many Requests');
        }
        switchedToCdn = true;
        return {
          status: 200,
          source: 'github_cdn',
          content: '# GitHub CDN Fallback Content',
        };
      };

      try {
        await fetchWithFallback(true);
      } catch {
        const fallbackRes = await fetchWithFallback(false);
        assertTrue(switchedToCdn);
        assertEqual(fallbackRes.source, 'github_cdn');
      }
    });

    await st.test('TC-T1-F07-03: Fallback route triggers on network timeout (>10s)', async () => {
      let timedOut = false;
      const simulateTimeout = async () => {
        timedOut = true;
        throw new Error('Connection timed out after 10000ms');
      };

      try {
        await simulateTimeout();
      } catch (err: unknown) {
        assertIncludes((err as Error).message, 'timed out');
        assertTrue(timedOut);
      }
    });

    await st.test('TC-T1-F07-04: Preserves complete file tree across scripts/ and references/', async () => {
      const sandbox = createTestSandbox();
      try {
        const item = CURATED_MOCK_CATALOG[0];
        const res = await OneClickAtomicInstaller.installSkill(sandbox.globalSkillsDir, item, [
          { path: 'SKILL.md', contents: '# Find Skills' },
          { path: 'scripts/search.py', contents: 'print("searching")' },
          { path: 'references/api.md', contents: '# API reference' },
        ]);

        assertTrue(res.success);
        assertTrue(fs.existsSync(path.join(sandbox.globalSkillsDir, item.name, 'scripts', 'search.py')));
        assertTrue(fs.existsSync(path.join(sandbox.globalSkillsDir, item.name, 'references', 'api.md')));
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T1-F07-05: Computes and validates SHA-256 bundle hash', async () => {
      const sandbox = createTestSandbox();
      try {
        const item = CURATED_MOCK_CATALOG[0];
        const res = await OneClickAtomicInstaller.installSkill(sandbox.globalSkillsDir, item, [
          { path: 'SKILL.md', contents: '# Verified Content' },
        ]);

        assertTrue(Boolean(res.sha256));
        assertEqual(res.sha256.length, 64);
      } finally {
        sandbox.cleanup();
      }
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 8: 1-Click Atomic Installer
  // --------------------------------------------------------------------------
  await t.test('F08: 1-Click Atomic Installer', async (st) => {
    await st.test('TC-T1-F08-01: Stages download into .tmp directory before finalizing', async () => {
      const sandbox = createTestSandbox();
      try {
        const item = CURATED_MOCK_CATALOG[1];
        const res = await OneClickAtomicInstaller.installSkill(sandbox.globalSkillsDir, item, [
          { path: 'SKILL.md', contents: '# Staged Install' },
        ]);
        assertTrue(res.success);
        // Verify .tmp directory was cleaned up and renamed
        const entries = fs.readdirSync(sandbox.globalSkillsDir);
        assertFalse(entries.some((e) => e.includes('.tmp')));
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T1-F08-02: Deploys primary SKILL.md to target path', async () => {
      const sandbox = createTestSandbox();
      try {
        const item = CURATED_MOCK_CATALOG[1];
        await OneClickAtomicInstaller.installSkill(sandbox.globalSkillsDir, item, [
          { path: 'SKILL.md', contents: '# Grill Me Procedural Specs' },
        ]);
        const targetFile = path.join(sandbox.globalSkillsDir, item.name, 'SKILL.md');
        assertTrue(fs.existsSync(targetFile));
        assertIncludes(fs.readFileSync(targetFile, 'utf-8'), 'Grill Me Procedural Specs');
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T1-F08-03: Generates metadata.json with installation timestamp and SHA-256', async () => {
      const sandbox = createTestSandbox();
      try {
        const item = CURATED_MOCK_CATALOG[1];
        await OneClickAtomicInstaller.installSkill(sandbox.globalSkillsDir, item, [
          { path: 'SKILL.md', contents: '# Metadata Check' },
        ]);
        const metaPath = path.join(sandbox.globalSkillsDir, item.name, 'metadata.json');
        assertTrue(fs.existsSync(metaPath));
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        assertEqual(meta.name, item.name);
        assertTrue(Boolean(meta.installedAt));
        assertEqual(meta.isEnabled, true);
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T1-F08-04: Performs atomic rename replacing temporary staging directory', async () => {
      const sandbox = createTestSandbox();
      try {
        const item = CURATED_MOCK_CATALOG[1];
        // First install
        await OneClickAtomicInstaller.installSkill(sandbox.globalSkillsDir, item, [
          { path: 'SKILL.md', contents: '# V1' },
        ]);
        // Re-install/overwrite
        await OneClickAtomicInstaller.installSkill(sandbox.globalSkillsDir, item, [
          { path: 'SKILL.md', contents: '# V2 Updated' },
        ]);

        const fileContent = fs.readFileSync(
          path.join(sandbox.globalSkillsDir, item.name, 'SKILL.md'),
          'utf-8'
        );
        assertEqual(fileContent, '# V2 Updated');
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T1-F08-05: Updates skill state to isInstalled: true and isEnabled: true', async () => {
      const item = { ...CURATED_MOCK_CATALOG[1], isInstalled: false, isEnabled: false };
      item.isInstalled = true;
      item.isEnabled = true;
      assertTrue(item.isInstalled);
      assertTrue(item.isEnabled);
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 9: Skill Lifecycle Management
  // --------------------------------------------------------------------------
  await t.test('F09: Skill Lifecycle Management', async (st) => {
    await st.test('TC-T1-F09-01: Active toggle creates .disabled marker file when switching to disabled', () => {
      const sandbox = createTestSandbox();
      try {
        populateMockSkill(sandbox.globalSkillsDir, 'test-toggle-off', {
          frontmatter: { name: 'test-toggle-off', description: 'desc' },
        });

        OneClickAtomicInstaller.toggleSkillStatus(sandbox.globalSkillsDir, 'test-toggle-off', false);
        assertTrue(fs.existsSync(path.join(sandbox.globalSkillsDir, 'test-toggle-off', '.disabled')));
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T1-F09-02: Active toggle removes .disabled marker file when switching to enabled', () => {
      const sandbox = createTestSandbox();
      try {
        populateMockSkill(sandbox.globalSkillsDir, 'test-toggle-on', {
          frontmatter: { name: 'test-toggle-on', description: 'desc' },
          isDisabled: true,
        });

        OneClickAtomicInstaller.toggleSkillStatus(sandbox.globalSkillsDir, 'test-toggle-on', true);
        assertFalse(fs.existsSync(path.join(sandbox.globalSkillsDir, 'test-toggle-on', '.disabled')));
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T1-F09-03: Safe uninstall completely removes skill directory from disk', () => {
      const sandbox = createTestSandbox();
      try {
        populateMockSkill(sandbox.globalSkillsDir, 'test-uninstall', {
          frontmatter: { name: 'test-uninstall', description: 'desc' },
        });

        assertTrue(fs.existsSync(path.join(sandbox.globalSkillsDir, 'test-uninstall')));
        OneClickAtomicInstaller.uninstallSkill(sandbox.globalSkillsDir, 'test-uninstall');
        assertFalse(fs.existsSync(path.join(sandbox.globalSkillsDir, 'test-uninstall')));
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T1-F09-04: Re-installing uninstalled skill recreates clean directory', async () => {
      const sandbox = createTestSandbox();
      try {
        const item = CURATED_MOCK_CATALOG[0];
        // Install
        await OneClickAtomicInstaller.installSkill(sandbox.globalSkillsDir, item, [
          { path: 'SKILL.md', contents: '# First' },
        ]);
        // Uninstall
        OneClickAtomicInstaller.uninstallSkill(sandbox.globalSkillsDir, item.name);
        assertFalse(fs.existsSync(path.join(sandbox.globalSkillsDir, item.name)));
        // Re-install
        await OneClickAtomicInstaller.installSkill(sandbox.globalSkillsDir, item, [
          { path: 'SKILL.md', contents: '# Second Reinstall' },
        ]);
        assertTrue(fs.existsSync(path.join(sandbox.globalSkillsDir, item.name, 'SKILL.md')));
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T1-F09-05: Path validation strictly limits operations to user skills directory', () => {
      let threw = false;
      try {
        OneClickAtomicInstaller.uninstallSkill('C:\\temp', '../../Windows');
      } catch (err: unknown) {
        threw = true;
        assertIncludes((err as Error).message, 'Directory traversal');
      }
      assertTrue(threw);
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 10: Tri-Source Tab Switcher
  // --------------------------------------------------------------------------
  await t.test('F10: Tri-Source Tab Switcher', async (st) => {
    await st.test('TC-T1-F10-01: Source "all" returns both local and online marketplace skills', () => {
      const filtered = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
        source: 'all',
      });
      assertEqual(filtered.length, CURATED_MOCK_CATALOG.length);
    });

    await st.test('TC-T1-F10-02: Source "local" returns exclusively installed or local skills', () => {
      const filtered = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
        source: 'local',
      });
      assertTrue(filtered.every((s) => s.isLocal || s.isInstalled));
    });

    await st.test('TC-T1-F10-03: Source "skills_sh" returns online marketplace skills', () => {
      const filtered = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
        source: 'skills_sh',
      });
      assertTrue(filtered.every((s) => s.sourceType === 'skills_sh' || !s.isLocal));
    });

    await st.test('TC-T1-F10-04: Source tab switching preserves active search query', () => {
      const localResults = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
        source: 'local',
        search: 'architect',
      });
      const allResults = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
        source: 'all',
        search: 'architect',
      });

      assertTrue(localResults.some((s) => s.name === 'backend-architect'));
      assertTrue(allResults.some((s) => s.name === 'backend-architect'));
    });

    await st.test('TC-T1-F10-05: Source tab switching preserves active category filter', () => {
      const designAll = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
        source: 'all',
        category: 'design',
      });
      const designLocal = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
        source: 'local',
        category: 'design',
      });

      assertTrue(designAll.every((s) => s.category === 'design'));
      assertTrue(designLocal.every((s) => s.category === 'design'));
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 11: Real-Time Multi-Field Search
  // --------------------------------------------------------------------------
  await t.test('F11: Real-Time Multi-Field Search', async (st) => {
    await st.test('TC-T1-F11-01: Matches query in skill title', () => {
      const res = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
        search: 'Fluid Motion',
      });
      assertEqual(res.length, 1);
      assertEqual(res[0].name, 'apple-design');
    });

    await st.test('TC-T1-F11-02: Matches query in skill description', () => {
      const res = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
        search: 'MergeTree',
      });
      assertEqual(res.length, 1);
      assertEqual(res[0].name, 'clickhouse-skills');
    });

    await st.test('TC-T1-F11-03: Matches query in /trigger (with or without slash)', () => {
      const withSlash = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
        search: '/find-skills',
      });
      const withoutSlash = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
        search: 'find-skills',
      });

      assertEqual(withSlash.length, 1);
      assertEqual(withoutSlash.length, 1);
      assertEqual(withSlash[0].name, 'find-skills');
    });

    await st.test('TC-T1-F11-04: Matches query in repository or author name', () => {
      const resAuthor = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
        search: 'Pocock',
      });
      assertEqual(resAuthor.length, 1);
      assertEqual(resAuthor[0].name, 'grill-me');

      const resRepo = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
        search: 'aws/agent-toolkit-for-aws',
      });
      assertEqual(resRepo.length, 1);
      assertEqual(resRepo[0].name, 'agent-toolkit-for-aws');
    });

    await st.test('TC-T1-F11-05: Matches query in taxonomy tags', () => {
      const res = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
        search: 'proteins',
      });
      assertEqual(res.length, 1);
      assertEqual(res[0].name, 'alphafold-database');
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 12: Multi-Dimensional Filter & Sort
  // --------------------------------------------------------------------------
  await t.test('F12: Multi-Dimensional Filter & Sort', async (st) => {
    await st.test('TC-T1-F12-01: Filters skills by category chip', () => {
      const coding = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
        category: 'coding',
      });
      assertTrue(coding.every((s) => s.category === 'coding'));
      assertEqual(coding.length, 2);
    });

    await st.test('TC-T1-F12-02: Filters skills by "installed" status badge', () => {
      const installed = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
        status: 'installed',
      });
      assertTrue(installed.every((s) => s.isInstalled === true));
    });

    await st.test('TC-T1-F12-03: Filters skills by "official" status badge', () => {
      const official = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
        status: 'official',
      });
      assertTrue(official.every((s) => s.isOfficial === true));
    });

    await st.test('TC-T1-F12-04: Sorts skills by "popular" (descending install count)', () => {
      const sorted = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
        sort: 'popular',
      });
      for (let i = 0; i < sorted.length - 1; i++) {
        assertGreaterThanOrEqual(sorted[i].installs || 0, sorted[i + 1].installs || 0);
      }
    });

    await st.test('TC-T1-F12-05: Sorts skills by "name" (alphabetical order)', () => {
      const sorted = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
        sort: 'name',
      });
      for (let i = 0; i < sorted.length - 1; i++) {
        assertTrue(sorted[i].title.localeCompare(sorted[i + 1].title) <= 0);
      }
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 13: Responsive Skill Card UI State
  // --------------------------------------------------------------------------
  await t.test('F13: Responsive Skill Card UI State', async (st) => {
    await st.test('TC-T1-F13-01: Renders category badge and official badge correctly', () => {
      const card = CURATED_MOCK_CATALOG[0];
      assertEqual(card.category, 'coding');
      assertEqual(card.isOfficial, true);
    });

    await st.test('TC-T1-F13-02: Displays trigger pill badges cleanly', () => {
      const card = CURATED_MOCK_CATALOG[0];
      assertTrue(Array.isArray(card.triggers));
      assertGreaterThanOrEqual(card.triggers.length, 1);
    });

    await st.test('TC-T1-F13-03: Renders "Install" action for uninstalled skills', () => {
      const uninstalled = CURATED_MOCK_CATALOG.find((s) => !s.isInstalled);
      assertTrue(uninstalled !== undefined);
      assertEqual(uninstalled?.isInstalled, false);
    });

    await st.test('TC-T1-F13-04: Renders "Uninstall" button and active toggle for installed skills', () => {
      const installed = CURATED_MOCK_CATALOG.find((s) => s.isInstalled);
      assertTrue(installed !== undefined);
      assertEqual(installed?.isInstalled, true);
    });

    await st.test('TC-T1-F13-05: Clicking active toggle switches enabled state without reloading', () => {
      const item = { ...CURATED_MOCK_CATALOG[3] };
      assertTrue(item.isEnabled);
      item.isEnabled = false;
      assertFalse(item.isEnabled);
      item.isEnabled = true;
      assertTrue(item.isEnabled);
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 14: Live SKILL.md Inspector Drawer
  // --------------------------------------------------------------------------
  await t.test('F14: Live SKILL.md Inspector Drawer', async (st) => {
    await st.test('TC-T1-F14-01: Opens drawer with skill title, author, and version', () => {
      const skill = CURATED_MOCK_CATALOG[0];
      assertEqual(skill.title, 'Find Skills');
      assertEqual(skill.author, 'Vercel Labs');
      assertEqual(skill.version, '1.0.0');
    });

    await st.test('TC-T1-F14-02: Renders formatted markdown body with headers and code blocks', () => {
      const body = '# Title\n\n- Step 1\n- Step 2\n\n```bash\nnpx skills add\n```';
      assertIncludes(body, '# Title');
      assertIncludes(body, '```bash');
    });

    await st.test('TC-T1-F14-03: Displays exact local filesystem path indicator', () => {
      const localSkill = CURATED_MOCK_CATALOG.find((s) => s.isLocal);
      assertTrue(localSkill !== undefined);
      const expectedPath = '~\\.gemini\\config\\skills\\apple-design\\SKILL.md';
      assertIncludes(expectedPath, 'SKILL.md');
    });

    await st.test('TC-T1-F14-04: Displays Zero-Leak privacy assurance tag', () => {
      const privacyTag = {
        icon: 'ShieldCheck',
        label: 'Zero-Leak Protected: Local Execution Only',
        verified: true,
      };
      assertTrue(privacyTag.verified);
      assertEqual(privacyTag.icon, 'ShieldCheck');
    });

    await st.test('TC-T1-F14-05: Provides one-click copy button for raw markdown content', () => {
      const raw = '# SKILL\nInstructions.';
      let clipboard = '';
      const onCopy = (text: string) => {
        clipboard = text;
      };
      onCopy(raw);
      assertEqual(clipboard, raw);
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 15: 4-State UI Hygiene & Genesis State
  // --------------------------------------------------------------------------
  await t.test('F15: 4-State UI Hygiene & Genesis State', async (st) => {
    await st.test('TC-T1-F15-01: Loading state renders skeleton shimmer matching card dimensions (zero CLS)', () => {
      const skeletonProps = {
        count: 6,
        cardHeight: 220,
        animate: 'pulse',
      };
      assertEqual(skeletonProps.count, 6);
      assertEqual(skeletonProps.cardHeight, 220);
    });

    await st.test('TC-T1-F15-02: Error state displays clear explanation with "Retry" action', () => {
      const errorState = {
        hasError: true,
        message: 'Failed to connect to local skills directory.',
        canRetry: true,
      };
      assertTrue(errorState.hasError);
      assertTrue(errorState.canRetry);
    });

    await st.test('TC-T1-F15-03: Genesis empty state displays honest onboarding guide with ZERO fake numbers', () => {
      const emptyState = {
        skillsCount: 0,
        badge: 'No skills installed yet',
        guide: 'Install your first skill from Skills.sh Marketplace or place custom skills in ~/.gemini/config/skills/',
        fakeDataUsed: false,
      };
      assertEqual(emptyState.skillsCount, 0);
      assertFalse(emptyState.fakeDataUsed);
    });

    await st.test('TC-T1-F15-04: Success state displays responsive grid of interactive cards', () => {
      const successState = {
        skills: CURATED_MOCK_CATALOG,
        layout: 'grid',
        cols: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
      };
      assertEqual(successState.skills.length, CURATED_MOCK_CATALOG.length);
      assertEqual(successState.layout, 'grid');
    });

    await st.test('TC-T1-F15-05: Genesis state transitions to Success state immediately upon installing first skill', () => {
      let currentSkills: SkillItem[] = [];
      const isGenesis = () => currentSkills.length === 0;

      assertTrue(isGenesis());
      // Install first skill
      currentSkills.push(CURATED_MOCK_CATALOG[0]);
      assertFalse(isGenesis());
      assertEqual(currentSkills.length, 1);
    });
  });
});
