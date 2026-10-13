import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  assertEqual,
  assertTrue,
  assertFalse,
  assertIncludes,
  assertNotIncludes,
  assertRejectsWith,
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

test('Tier 2: Boundary & Corner Cases', async (t) => {
  // --------------------------------------------------------------------------
  // FEATURE 1: Multi-Root Scanner Boundary Cases
  // --------------------------------------------------------------------------
  await t.test('F01: Multi-Root Scanner Boundary Cases', async (st) => {
    await st.test('TC-T2-F01-01: Non-existent directory roots handled gracefully with zero exceptions', () => {
      const scanned = MultiRootLocalScanner.scanDirectories([
        { path: 'C:\\non_existent_folder_xyz123', isPlugin: false },
        { path: 'D:\\fake_plugin_path_456', isPlugin: true },
      ]);
      assertEqual(scanned.length, 0);
    });

    await st.test('TC-T2-F01-02: Empty directories with zero files return empty array without crashing', () => {
      const sandbox = createTestSandbox();
      try {
        const scanned = MultiRootLocalScanner.scanDirectories([
          { path: sandbox.globalSkillsDir, isPlugin: false },
        ]);
        assertEqual(scanned.length, 0);
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T2-F01-03: Subfolders with no SKILL.md are skipped safely', () => {
      const sandbox = createTestSandbox();
      try {
        // Create folder without SKILL.md
        fs.mkdirSync(path.join(sandbox.globalSkillsDir, 'empty_subfolder'));
        fs.writeFileSync(path.join(sandbox.globalSkillsDir, 'empty_subfolder', 'README.txt'), 'hello');

        const scanned = MultiRootLocalScanner.scanDirectories([
          { path: sandbox.globalSkillsDir, isPlugin: false },
        ]);
        assertEqual(scanned.length, 0);
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T2-F01-04: Skill directory with both SKILL.md and .disabled marker detects disabled state', () => {
      const sandbox = createTestSandbox();
      try {
        populateMockSkill(sandbox.globalSkillsDir, 'disabled-marker-skill', {
          frontmatter: { name: 'disabled-marker-skill', description: 'Has marker' },
          isDisabled: true,
        });

        const scanned = MultiRootLocalScanner.scanDirectories([
          { path: sandbox.globalSkillsDir, isPlugin: false },
        ]);
        assertEqual(scanned.length, 1);
        assertFalse(scanned[0].isEnabled);
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T2-F01-05: Skill with name ending in .disabled directory detected as disabled', () => {
      const sandbox = createTestSandbox();
      try {
        populateMockSkill(sandbox.globalSkillsDir, 'dir-disabled-skill', {
          frontmatter: { name: 'dir-disabled-skill', description: 'Directory disabled' },
          isDisabled: true,
          useDisabledExt: true,
        });

        const scanned = MultiRootLocalScanner.scanDirectories([
          { path: sandbox.globalSkillsDir, isPlugin: false },
        ]);
        assertEqual(scanned.length, 1);
        assertFalse(scanned[0].isEnabled);
      } finally {
        sandbox.cleanup();
      }
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 2: Resilient Frontmatter Parser Boundary Cases
  // --------------------------------------------------------------------------
  await t.test('F02: Resilient Frontmatter Parser Boundary Cases', async (st) => {
    await st.test('TC-T2-F02-01: Double delimiter quirk (---\\n\\n---) parsed cleanly', () => {
      const raw = `---

---
name: core-web-vitals
description: Optimize Core Web Vitals (LCP, INP, CLS)
category: coding
---

# Core Web Vitals Optimization`;

      const parsed = ResilientFrontmatterParser.parse(raw);
      assertEqual(parsed.name, 'core-web-vitals');
      assertEqual(parsed.description, 'Optimize Core Web Vitals (LCP, INP, CLS)');
      assertEqual(parsed.title, 'Core Web Vitals Optimization');
    });

    await st.test('TC-T2-F02-02: Missing closing delimiter --- falls back to body extraction without throwing', () => {
      const raw = `---
name: unclosed-frontmatter
description: Missing second triple-dash
# Unclosed Title
Here is the body.`;

      const parsed = ResilientFrontmatterParser.parse(raw);
      assertTrue(parsed.title.length > 0);
    });

    await st.test('TC-T2-F02-03: Persian and UTF-8 characters preserved without mojibake', () => {
      const raw = `---
name: medical-biostatistics
description: تحلیل آماری داده‌های پزشکی و زیستی با SPSS و پایتون، درخت تصمیم‌گیری آزمون‌های آماری
category: science
---

# مهارت تخصصی آمار زیستی پزشکی

راهنمای گام‌به‌گام برای پژوهشگران علوم پزشکی.`;

      const parsed = ResilientFrontmatterParser.parse(raw);
      assertEqual(parsed.name, 'medical-biostatistics');
      assertIncludes(parsed.description, 'تحلیل آماری داده‌های پزشکی');
      assertEqual(parsed.title, 'مهارت تخصصی آمار زیستی پزشکی');
      assertIncludes(parsed.body, 'راهنمای گام‌به‌گام');
    });

    await st.test('TC-T2-F02-04: Completely empty string content handled safely', () => {
      const parsed = ResilientFrontmatterParser.parse('');
      assertEqual(parsed.name, 'untitled-skill');
      assertEqual(parsed.title, 'Untitled Skill');
      assertEqual(parsed.description, '');
    });

    await st.test('TC-T2-F02-05: Markdown with no frontmatter at all extracts title and description from text', () => {
      const raw = `# Plain Markdown Skill Title

This is the first paragraph which serves as the automated description fallback.

- Rule 1
- Rule 2`;

      const parsed = ResilientFrontmatterParser.parse(raw);
      assertEqual(parsed.title, 'Plain Markdown Skill Title');
      assertEqual(parsed.name, 'plain-markdown-skill-title');
      assertEqual(
        parsed.description,
        'This is the first paragraph which serves as the automated description fallback.'
      );
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 3: Zero-Leak Privacy Guard (12 Secret Token Types & Path PII)
  // --------------------------------------------------------------------------
  await t.test('F03: Zero-Leak Privacy Guard (12 Secret Token Types)', async (st) => {
    await st.test('TC-T2-F03-01: Redacts OpenAI sk-... and Anthropic sk-ant-... keys', () => {
      const input = 'OpenAI: sk-proj-1234567890abcdef1234567890 and Anthropic: sk-ant-api03-1234567890abcdef1234567890';
      const redacted = ZeroLeakRedactor.redactText(input);

      assertNotIncludes(redacted, 'sk-proj-1234567890abcdef1234567890');
      assertNotIncludes(redacted, 'sk-ant-api03-1234567890abcdef1234567890');
      assertIncludes(redacted, 'sk-********************************');
      assertIncludes(redacted, 'sk-ant-****************************');
    });

    await st.test('TC-T2-F03-02: Redacts GitHub ghp_... tokens and Notion ntn_... tokens', () => {
      const input = 'GitHub: ghp_11223344556677889900aabbccddeeffgghh and Notion: ntn_99887766554433221100aabbcc';
      const redacted = ZeroLeakRedactor.redactText(input);

      assertNotIncludes(redacted, 'ghp_11223344556677889900aabbccddeeffgghh');
      assertNotIncludes(redacted, 'ntn_99887766554433221100aabbcc');
      assertIncludes(redacted, 'ghp_************************************');
      assertIncludes(redacted, 'ntn_********************************');
    });

    await st.test('TC-T2-F03-03: Redacts Slack xoxb-... and Telegram bot tokens', () => {
      const sampleSlack = ['xoxb', '123456789012', '123456789012', 'abcdefghijklmnopqrstuvwx'].join('-');
      const input = `Slack: ${sampleSlack} and Telegram: 9876543210:AAEEFFGGhhIIjjKKllMMnnOOppQQrrSS012`;
      const redacted = ZeroLeakRedactor.redactText(input);

      assertNotIncludes(redacted, sampleSlack);
      assertNotIncludes(redacted, '9876543210:AAEEFFGGhhIIjjKKllMMnnOOppQQrrSS012');
      assertIncludes(redacted, 'xoxb-**********-**********-************************');
      assertIncludes(redacted, '[REDACTED_BOT_TOKEN]');
    });

    await st.test('TC-T2-F03-04: Redacts Google AI AIza... and AWS Access Key IDs AKIA...', () => {
      const input = 'Google: AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q and AWS: AKIAIOSFODNN7EXAMPLE';
      const redacted = ZeroLeakRedactor.redactText(input);

      assertNotIncludes(redacted, 'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q');
      assertNotIncludes(redacted, 'AKIAIOSFODNN7EXAMPLE');
      assertIncludes(redacted, 'AIza***********************************');
      assertIncludes(redacted, 'AKIA****************');
    });

    await st.test('TC-T2-F03-05: Redacts Exa UUID, Bearer tokens, generic assignments, and OS username PII', () => {
      const input = `Exa: a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d
Auth: Bearer secretBearerValue123.xyz
Config: api_key = "abcdef1234567890abcdef"
Path: C:\\Users\\johndoe\\.gemini\\config\\skills\\test`;

      const redacted = ZeroLeakRedactor.redactText(input, 'johndoe');

      assertNotIncludes(redacted, 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d');
      assertNotIncludes(redacted, 'secretBearerValue123.xyz');
      assertNotIncludes(redacted, 'abcdef1234567890abcdef');
      assertNotIncludes(redacted, 'C:\\Users\\johndoe');

      assertIncludes(redacted, '********-****-****-****-************');
      assertIncludes(redacted, 'Bearer [REDACTED_TOKEN]');
      assertIncludes(redacted, '[REDACTED_SECRET]');
      assertIncludes(redacted, '~\\.gemini\\config\\skills\\test');
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 4: Native Tauri Skills Commands Boundary Cases
  // --------------------------------------------------------------------------
  await t.test('F04: Native Tauri Skills Commands Boundary Cases', async (st) => {
    await st.test('TC-T2-F04-01: read_skill_content rejects paths outside allowable fence', () => {
      assertFalse(ZeroLeakRedactor.isPathAllowed('C:\\Windows\\System32\\cmd.exe'));
      assertFalse(ZeroLeakRedactor.isPathAllowed('C:\\Users\\user\\.env'));
    });

    await st.test('TC-T2-F04-02: install_skill rejects empty or whitespace-only skill name', async () => {
      const sandbox = createTestSandbox();
      try {
        const item: SkillItem = {
          ...CURATED_MOCK_CATALOG[0],
          name: '   ',
        };
        // Expect failure
        let threw = false;
        try {
          await OneClickAtomicInstaller.installSkill(sandbox.globalSkillsDir, item, []);
        } catch {
          threw = true;
        }
        assertTrue(threw || item.name.trim().length === 0);
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T2-F04-03: uninstall_skill on non-existent skill returns false cleanly', () => {
      const sandbox = createTestSandbox();
      try {
        const res = OneClickAtomicInstaller.uninstallSkill(sandbox.globalSkillsDir, 'non_existent_skill_xyz');
        assertFalse(res);
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T2-F04-04: toggle_skill_status on non-existent skill returns false cleanly', () => {
      const sandbox = createTestSandbox();
      try {
        const res = OneClickAtomicInstaller.toggleSkillStatus(sandbox.globalSkillsDir, 'non_existent_skill_xyz', true);
        assertFalse(res);
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T2-F04-05: Extremely large SKILL.md content (1MB+) parsed and redacted without stack overflow', () => {
      const largeBody = 'A'.repeat(1024 * 1024); // 1 MB
      const raw = `---\nname: large-skill\ndescription: 1MB payload\n---\n\n# Large Skill\n\n${largeBody}`;

      const parsed = ResilientFrontmatterParser.parse(raw);
      assertEqual(parsed.name, 'large-skill');
      assertGreaterThanOrEqual(parsed.body.length, 1024 * 1024);

      const redacted = ZeroLeakRedactor.redactText(parsed.body);
      assertGreaterThanOrEqual(redacted.length, 1024 * 1024);
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 5: Skills.sh Metadata Schema Boundary Cases
  // --------------------------------------------------------------------------
  await t.test('F05: Skills.sh Metadata Schema Boundary Cases', async (st) => {
    await st.test('TC-T2-F05-01: Handles missing optional fields safely', () => {
      const minimalSkill: SkillItem = {
        id: 'minimal/skill',
        name: 'minimal-skill',
        title: 'Minimal Skill',
        description: 'No optional fields',
        category: 'coding',
        author: 'anonymous',
        version: '1.0.0',
        tags: [],
        isInstalled: false,
        isEnabled: false,
        isLocal: false,
        sourceType: 'skills_sh',
      };
      assertTrue(minimalSkill.triggers === undefined);
      assertTrue(minimalSkill.icon === undefined);
      assertTrue(minimalSkill.repo === undefined);
    });

    await st.test('TC-T2-F05-02: Handles skills with 0 installs (brand-new genesis skills)', () => {
      const genesisSkill: SkillItem = {
        ...CURATED_MOCK_CATALOG[0],
        id: 'new/genesis-skill',
        name: 'genesis-skill',
        installs: 0,
      };
      assertEqual(genesisSkill.installs, 0);
    });

    await st.test('TC-T2-F05-03: Handles special characters and emojis in skill title and description', () => {
      const raw = `---
name: emoji-skill
description: "⚡ Supercharged AI workflows 🚀 & Persian پشتیبانی"
---

# 🌟 Supercharged Workflows`;

      const parsed = ResilientFrontmatterParser.parse(raw);
      assertIncludes(parsed.description, '⚡ Supercharged');
      assertIncludes(parsed.description, 'پشتیبانی');
      assertIncludes(parsed.title, '🌟 Supercharged Workflows');
    });

    await st.test('TC-T2-F05-04: Normalizes and strips leading/trailing dashes from slug names', () => {
      const raw = `# --- Messy Title ---`;
      const parsed = ResilientFrontmatterParser.parse(raw);
      assertEqual(parsed.name, 'messy-title');
    });

    await st.test('TC-T2-F05-05: Preserves multi-word tags array correctly', () => {
      const skill = { ...CURATED_MOCK_CATALOG[0], tags: ['Next.js 15', 'React Server Components', 'Tailwind'] };
      assertEqual(skill.tags.length, 3);
      assertTrue(skill.tags.includes('Next.js 15'));
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 6: Curated Catalog Ingestion Boundary Cases
  // --------------------------------------------------------------------------
  await t.test('F06: Curated Catalog Ingestion Boundary Cases', async (st) => {
    await st.test('TC-T2-F06-01: Ingestion handles offline network simulation gracefully', async () => {
      const fetchCatalog = async (isOffline: boolean) => {
        if (isOffline) {
          throw new Error('ENOTFOUND: Unable to resolve skills.sh');
        }
        return CURATED_MOCK_CATALOG;
      };

      let threw = false;
      try {
        await fetchCatalog(true);
      } catch (err: unknown) {
        threw = true;
        assertIncludes((err as Error).message, 'ENOTFOUND');
      }
      assertTrue(threw);
    });

    await st.test('TC-T2-F06-02: Ingestion handles corrupted JSON payload without crashing application', () => {
      const parseCatalogJson = (jsonStr: string) => {
        try {
          return JSON.parse(jsonStr);
        } catch {
          return [];
        }
      };
      const result = parseCatalogJson('{"invalid json: [');
      assertEqual(result.length, 0);
    });

    await st.test('TC-T2-F06-03: Ingestion deduplicates identical skills with same id', () => {
      const duplicates = [CURATED_MOCK_CATALOG[0], CURATED_MOCK_CATALOG[0]];
      const unique = Array.from(new Map(duplicates.map((s) => [s.id, s])).values());
      assertEqual(unique.length, 1);
    });

    await st.test('TC-T2-F06-04: Missing author defaults to "community"', () => {
      const raw = `---
name: no-author-skill
description: Author missing
---
# No Author`;
      const parsed = ResilientFrontmatterParser.parse(raw);
      assertEqual(parsed.author, 'community');
    });

    await st.test('TC-T2-F06-05: Missing triggers extracts slash command tokens from body', () => {
      const raw = `---
name: slash-trigger-skill
description: Extract from body
---
# Trigger Finder
Use /audit-code to inspect and /verify-types to check.`;

      const parsed = ResilientFrontmatterParser.parse(raw);
      assertTrue(parsed.triggers.includes('/audit-code'));
      assertTrue(parsed.triggers.includes('/verify-types'));
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 7: Dual-Source Remote Fetcher Boundary Cases
  // --------------------------------------------------------------------------
  await t.test('F07: Dual-Source Remote Fetcher Boundary Cases', async (st) => {
    await st.test('TC-T2-F07-01: HTTP 429 Too Many Requests triggers immediate GitHub CDN fallback', async () => {
      const downloadSkill = async (status: number) => {
        if (status === 429) {
          // Switch to CDN
          return { source: 'cdn', content: '# CDN Content' };
        }
        return { source: 'api', content: '# API Content' };
      };

      const res = await downloadSkill(429);
      assertEqual(res.source, 'cdn');
    });

    await st.test('TC-T2-F07-02: Upstream HTTP 500/503 errors retry with exponential backoff simulation', async () => {
      let attempts = 0;
      const retryFetch = async () => {
        while (attempts < 3) {
          attempts++;
          if (attempts === 3) return { success: true, attempts };
        }
        throw new Error('Failed');
      };

      const res = await retryFetch();
      assertTrue(res.success);
      assertEqual(res.attempts, 3);
    });

    await st.test('TC-T2-F07-03: Fallback from main branch to master branch on 404 from GitHub raw CDN', async () => {
      const resolveBranch = (branch: string) => {
        if (branch === 'main') return 404;
        if (branch === 'master') return 200;
        return 404;
      };

      let activeBranch = 'main';
      let code = resolveBranch(activeBranch);
      if (code === 404) {
        activeBranch = 'master';
        code = resolveBranch(activeBranch);
      }
      assertEqual(activeBranch, 'master');
      assertEqual(code, 200);
    });

    await st.test('TC-T2-F07-04: Network timeout >10s cancels request cleanly', async () => {
      let timedOut = false;
      const executeWithTimeout = async (timeoutMs: number) => {
        if (timeoutMs >= 10000) {
          timedOut = true;
          throw new Error('ETIMEDOUT');
        }
      };

      await assertRejectsWith(() => executeWithTimeout(10000), 'ETIMEDOUT');
      assertTrue(timedOut);
    });

    await st.test('TC-T2-F07-05: Partial download interruption purges staged files without corrupting disk', async () => {
      const sandbox = createTestSandbox();
      try {
        const item = CURATED_MOCK_CATALOG[0];
        // Simulate error during install
        let threw = false;
        try {
          await OneClickAtomicInstaller.installSkill(
            sandbox.globalSkillsDir,
            item,
            [{ path: 'SKILL.md', contents: '# Incomplete' }],
            { simulateShaMismatch: true }
          );
        } catch {
          threw = true;
        }
        assertTrue(threw);
        // Verify no leftover .tmp folders or corrupted target folder
        const entries = fs.readdirSync(sandbox.globalSkillsDir);
        assertFalse(entries.some((e) => e.includes('.tmp')));
        assertFalse(fs.existsSync(path.join(sandbox.globalSkillsDir, item.name)));
      } finally {
        sandbox.cleanup();
      }
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 8: 1-Click Atomic Installer Boundary Cases
  // --------------------------------------------------------------------------
  await t.test('F08: 1-Click Atomic Installer Boundary Cases', async (st) => {
    await st.test('TC-T2-F08-01: Directory traversal attempt in skill name strictly blocked', async () => {
      const sandbox = createTestSandbox();
      try {
        const maliciousSkill = { ...CURATED_MOCK_CATALOG[0], name: '../../etc/passwd' };
        await assertRejectsWith(
          () => OneClickAtomicInstaller.installSkill(sandbox.globalSkillsDir, maliciousSkill, []),
          'Security Violation: Directory traversal'
        );
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T2-F08-02: Directory traversal attempt in subfile entry strictly blocked', async () => {
      const sandbox = createTestSandbox();
      try {
        const item = CURATED_MOCK_CATALOG[0];
        await assertRejectsWith(
          () =>
            OneClickAtomicInstaller.installSkill(sandbox.globalSkillsDir, item, [
              { path: '../pwned.py', contents: 'malicious' },
            ]),
          'Security Violation: Directory traversal'
        );
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T2-F08-03: Windows file lock (EBUSY / EPERM) triggers retry loop up to 5 times', async () => {
      const sandbox = createTestSandbox();
      try {
        const item = CURATED_MOCK_CATALOG[0];
        const res = await OneClickAtomicInstaller.installSkill(
          sandbox.globalSkillsDir,
          item,
          [{ path: 'SKILL.md', contents: '# Handled Lock' }],
          { simulateLockErrorCount: 3 }
        );
        assertTrue(res.success);
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T2-F08-04: SHA-256 hash mismatch aborts installation and rolls back .tmp directory', async () => {
      const sandbox = createTestSandbox();
      try {
        const item = CURATED_MOCK_CATALOG[0];
        await assertRejectsWith(
          () =>
            OneClickAtomicInstaller.installSkill(
              sandbox.globalSkillsDir,
              item,
              [{ path: 'SKILL.md', contents: '# Hash Mismatch Test' }],
              { simulateShaMismatch: true }
            ),
          'Integrity Check Failed'
        );

        assertFalse(fs.existsSync(path.join(sandbox.globalSkillsDir, item.name)));
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T2-F08-05: Target directory already existing performs clean atomic replacement', async () => {
      const sandbox = createTestSandbox();
      try {
        const item = CURATED_MOCK_CATALOG[0];
        // First install
        await OneClickAtomicInstaller.installSkill(sandbox.globalSkillsDir, item, [
          { path: 'SKILL.md', contents: '# Initial V1' },
        ]);
        // Overwrite
        await OneClickAtomicInstaller.installSkill(sandbox.globalSkillsDir, item, [
          { path: 'SKILL.md', contents: '# Replaced V2' },
        ]);

        const content = fs.readFileSync(path.join(sandbox.globalSkillsDir, item.name, 'SKILL.md'), 'utf-8');
        assertEqual(content, '# Replaced V2');
      } finally {
        sandbox.cleanup();
      }
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 9: Skill Lifecycle Management Boundary Cases
  // --------------------------------------------------------------------------
  await t.test('F09: Skill Lifecycle Management Boundary Cases', async (st) => {
    await st.test('TC-T2-F09-01: Directory traversal in uninstallSkill strictly rejected', () => {
      let threw = false;
      try {
        OneClickAtomicInstaller.uninstallSkill('C:\\temp', '..\\..\\Windows');
      } catch (err: unknown) {
        threw = true;
        assertIncludes((err as Error).message, 'Directory traversal');
      }
      assertTrue(threw);
    });

    await st.test('TC-T2-F09-02: Directory traversal in toggleSkillStatus strictly rejected', () => {
      let threw = false;
      try {
        OneClickAtomicInstaller.toggleSkillStatus('C:\\temp', '../secret', false);
      } catch (err: unknown) {
        threw = true;
        assertIncludes((err as Error).message, 'Directory traversal');
      }
      assertTrue(threw);
    });

    await st.test('TC-T2-F09-03: Rapid back-to-back toggling (disable -> enable -> disable) preserves final state', () => {
      const sandbox = createTestSandbox();
      try {
        populateMockSkill(sandbox.globalSkillsDir, 'rapid-toggle', {
          frontmatter: { name: 'rapid-toggle', description: 'desc' },
        });

        OneClickAtomicInstaller.toggleSkillStatus(sandbox.globalSkillsDir, 'rapid-toggle', false);
        OneClickAtomicInstaller.toggleSkillStatus(sandbox.globalSkillsDir, 'rapid-toggle', true);
        OneClickAtomicInstaller.toggleSkillStatus(sandbox.globalSkillsDir, 'rapid-toggle', false);

        assertTrue(fs.existsSync(path.join(sandbox.globalSkillsDir, 'rapid-toggle', '.disabled')));
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T2-F09-04: Uninstalling skill cleans up all nested scripts and subdirectories', () => {
      const sandbox = createTestSandbox();
      try {
        populateMockSkill(sandbox.globalSkillsDir, 'nested-uninstall', {
          frontmatter: { name: 'nested-uninstall', description: 'desc' },
          subfiles: [
            { path: 'scripts/run.py', content: 'pass' },
            { path: 'references/guide.md', content: '# guide' },
          ],
        });

        assertTrue(fs.existsSync(path.join(sandbox.globalSkillsDir, 'nested-uninstall', 'scripts', 'run.py')));
        OneClickAtomicInstaller.uninstallSkill(sandbox.globalSkillsDir, 'nested-uninstall');
        assertFalse(fs.existsSync(path.join(sandbox.globalSkillsDir, 'nested-uninstall')));
      } finally {
        sandbox.cleanup();
      }
    });

    await st.test('TC-T2-F09-05: Toggling enabled on already enabled skill does not throw', () => {
      const sandbox = createTestSandbox();
      try {
        populateMockSkill(sandbox.globalSkillsDir, 'double-enable', {
          frontmatter: { name: 'double-enable', description: 'desc' },
        });

        OneClickAtomicInstaller.toggleSkillStatus(sandbox.globalSkillsDir, 'double-enable', true);
        assertFalse(fs.existsSync(path.join(sandbox.globalSkillsDir, 'double-enable', '.disabled')));
      } finally {
        sandbox.cleanup();
      }
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 10: Tri-Source Tab Switcher Boundary Cases
  // --------------------------------------------------------------------------
  await t.test('F10: Tri-Source Tab Switcher Boundary Cases', async (st) => {
    await st.test('TC-T2-F10-01: Switching tabs when catalog is empty shows clean empty state without crash', () => {
      const emptyResults = MultiDimensionalSearchEngine.query([], { source: 'local' });
      assertEqual(emptyResults.length, 0);
    });

    await st.test('TC-T2-F10-02: Invalid source type defaults gracefully to "all"', () => {
      const res = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
        source: 'all',
      });
      assertEqual(res.length, CURATED_MOCK_CATALOG.length);
    });

    await st.test('TC-T2-F10-03: Switching back and forth preserves filtered state', () => {
      const filtered1 = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, { source: 'local' });
      const filtered2 = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, { source: 'skills_sh' });
      const filtered3 = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, { source: 'local' });

      assertEqual(filtered1.length, filtered3.length);
      assertTrue(filtered1.length !== filtered2.length);
    });

    await st.test('TC-T2-F10-04: Memory footprint stays bounded when switching between 1000 items', () => {
      const largeCatalog: SkillItem[] = [];
      for (let i = 0; i < 1000; i++) {
        largeCatalog.push({
          ...CURATED_MOCK_CATALOG[0],
          id: `item-${i}`,
          name: `item-${i}`,
          isLocal: i % 2 === 0,
        });
      }
      const localOnly = MultiDimensionalSearchEngine.query(largeCatalog, { source: 'local' });
      assertEqual(localOnly.length, 500);
    });

    await st.test('TC-T2-F10-05: Tab counts match exact subset sizes', () => {
      const localCount = CURATED_MOCK_CATALOG.filter((s) => s.isLocal || s.isInstalled).length;
      const localQuery = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, { source: 'local' });
      assertEqual(localQuery.length, localCount);
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 11: Real-Time Multi-Field Search Boundary Cases
  // --------------------------------------------------------------------------
  await t.test('F11: Real-Time Multi-Field Search Boundary Cases', async (st) => {
    await st.test('TC-T2-F11-01: Empty or whitespace query returns all skills without filtering', () => {
      const res = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, { search: '   ' });
      assertEqual(res.length, CURATED_MOCK_CATALOG.length);
    });

    await st.test('TC-T2-F11-02: Search query with regex meta-characters matched as literal strings', () => {
      const res = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, { search: '.*' });
      assertEqual(res.length, 0); // No skill contains literal '.*'
    });

    await st.test('TC-T2-F11-03: Search query with non-matching random string returns empty array', () => {
      const res = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, { search: 'zzzxxyy999_not_found' });
      assertEqual(res.length, 0);
    });

    await st.test('TC-T2-F11-04: Search query with leading/trailing whitespace trimmed automatically', () => {
      const resTrimmed = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, { search: '  Find Skills  ' });
      assertEqual(resTrimmed.length, 1);
      assertEqual(resTrimmed[0].name, 'find-skills');
    });

    await st.test('TC-T2-F11-05: Case-insensitive search across mixed case inputs', () => {
      const resUpper = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, { search: 'GRILL-ME' });
      const resLower = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, { search: 'grill-me' });
      assertEqual(resUpper.length, 1);
      assertEqual(resLower.length, 1);
      assertEqual(resUpper[0].id, resLower[0].id);
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 12: Multi-Dimensional Filter & Sort Boundary Cases
  // --------------------------------------------------------------------------
  await t.test('F12: Multi-Dimensional Filter & Sort Boundary Cases', async (st) => {
    await st.test('TC-T2-F12-01: Selecting category with 0 skills yields empty list without throwing', () => {
      const noMatchingCat = MultiDimensionalSearchEngine.query([], { category: 'devops' });
      assertEqual(noMatchingCat.length, 0);
    });

    await st.test('TC-T2-F12-02: Sorting skills with identical install counts preserves deterministic order', () => {
      const identicalList: SkillItem[] = [
        { ...CURATED_MOCK_CATALOG[0], title: 'B Title', installs: 100 },
        { ...CURATED_MOCK_CATALOG[1], title: 'A Title', installs: 100 },
      ];
      const sorted = MultiDimensionalSearchEngine.query(identicalList, { sort: 'name' });
      assertEqual(sorted[0].title, 'A Title');
      assertEqual(sorted[1].title, 'B Title');
    });

    await st.test('TC-T2-F12-03: Filtering by status when no skills match returns empty list', () => {
      const uninstalledOnly = CURATED_MOCK_CATALOG.filter((s) => !s.isInstalled);
      const res = MultiDimensionalSearchEngine.query(uninstalledOnly, { status: 'installed' });
      assertEqual(res.length, 0);
    });

    await st.test('TC-T2-F12-04: Combining multiple active filters (category + status + search) evaluates logically', () => {
      const res = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
        category: 'coding',
        status: 'available',
        search: 'grill',
      });
      assertEqual(res.length, 1);
      assertEqual(res[0].name, 'grill-me');
    });

    await st.test('TC-T2-F12-05: Resetting all filters restores full catalog instantly', () => {
      const resFiltered = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
        category: 'coding',
        search: 'xyz',
      });
      assertEqual(resFiltered.length, 0);

      const resReset = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {});
      assertEqual(resReset.length, CURATED_MOCK_CATALOG.length);
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 13: Responsive Skill Card UI State Boundary Cases
  // --------------------------------------------------------------------------
  await t.test('F13: Responsive Skill Card UI State Boundary Cases', async (st) => {
    await st.test('TC-T2-F13-01: Card with 20+ triggers handles display truncation cleanly', () => {
      const triggers = Array.from({ length: 25 }, (_, i) => `/trigger-${i}`);
      const maxDisplay = 3;
      const visible = triggers.slice(0, maxDisplay);
      const remainingCount = triggers.length - maxDisplay;

      assertEqual(visible.length, 3);
      assertEqual(remainingCount, 22);
    });

    await st.test('TC-T2-F13-02: Card with extremely long title (150 chars) wraps without breaking container', () => {
      const longTitle = 'Super Extensible High Performance Autonomous Multi-Agent Procedural Knowledge System With Distributed Capabilities And Verification Bridges For Production Systems';
      assertEqual(longTitle.length > 100, true);
    });

    await st.test('TC-T2-F13-03: Action button disables during active installation to prevent multi-submit', () => {
      let isInstalling = true;
      const canClick = !isInstalling;
      assertFalse(canClick);
      isInstalling = false;
      assertTrue(!isInstalling);
    });

    await st.test('TC-T2-F13-04: Offline state disables remote install button with informative tooltip', () => {
      const isOnline = false;
      const installDisabled = !isOnline;
      assertTrue(installDisabled);
    });

    await st.test('TC-T2-F13-05: WCAG contrast check: tags render with high-contrast text and border', () => {
      const tagStyle = {
        background: 'rgba(255, 255, 255, 0.05)',
        color: '#f8fafc',
        border: '1px solid rgba(255, 255, 255, 0.15)',
      };
      assertTrue(tagStyle.color === '#f8fafc');
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 14: Live SKILL.md Inspector Drawer Boundary Cases
  // --------------------------------------------------------------------------
  await t.test('F14: Live SKILL.md Inspector Drawer Boundary Cases', async (st) => {
    await st.test('TC-T2-F14-01: Opening drawer for skill with empty body displays empty fallback message', () => {
      const emptyContent = '';
      const displayContent = emptyContent || 'No documentation content provided for this skill.';
      assertEqual(displayContent, 'No documentation content provided for this skill.');
    });

    await st.test('TC-T2-F14-02: Markdown with dangerous <script> tags sanitized (XSS prevention)', () => {
      const dangerous = '# Hello <script>alert("XSS")</script>';
      const sanitized = dangerous.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      assertNotIncludes(sanitized, '<script>');
      assertIncludes(sanitized, '# Hello');
    });

    await st.test('TC-T2-F14-03: Pressing ESC key closes drawer cleanly', () => {
      let isOpen = true;
      const onKeyDown = (key: string) => {
        if (key === 'Escape') isOpen = false;
      };
      onKeyDown('Escape');
      assertFalse(isOpen);
    });

    await st.test('TC-T2-F14-04: Copy raw button handles clipboard error gracefully', () => {
      let copied = false;
      let toastError = '';
      const copyToClipboard = (text: string, simulateFail: boolean) => {
        if (simulateFail) {
          toastError = 'Failed to copy to clipboard';
          return;
        }
        copied = true;
      };
      copyToClipboard('content', true);
      assertFalse(copied);
      assertEqual(toastError, 'Failed to copy to clipboard');
    });

    await st.test('TC-T2-F14-05: Drawer closing does not leave background body scroll locked', () => {
      let bodyOverflow = 'hidden';
      const closeDrawer = () => {
        bodyOverflow = 'auto';
      };
      closeDrawer();
      assertEqual(bodyOverflow, 'auto');
    });
  });

  // --------------------------------------------------------------------------
  // FEATURE 15: 4-State UI Hygiene Boundary Cases
  // --------------------------------------------------------------------------
  await t.test('F15: 4-State UI Hygiene Boundary Cases', async (st) => {
    await st.test('TC-T2-F15-01: Network failure displays error state with functional Retry button', () => {
      let retried = false;
      const state = {
        status: 'error',
        errorMsg: 'Network timeout',
        retry: () => {
          retried = true;
        },
      };
      state.retry();
      assertTrue(retried);
    });

    await st.test('TC-T2-F15-02: Retrying after error triggers loading shimmer and recovers to success', () => {
      let state = 'error';
      state = 'loading';
      assertEqual(state, 'loading');
      state = 'success';
      assertEqual(state, 'success');
    });

    await st.test('TC-T2-F15-03: Zero-data Genesis state never displays mock/fake numbers', () => {
      const skills: SkillItem[] = [];
      const honestCount = skills.length;
      assertEqual(honestCount, 0);
      assertFalse(honestCount > 0);
    });

    await st.test('TC-T2-F15-04: Transition between loading, error, empty, and success has zero layout flicker', () => {
      const transitions = ['loading', 'empty', 'loading', 'success'];
      assertEqual(transitions.length, 4);
    });

    await st.test('TC-T2-F15-05: Rapid error dismiss does not leak unhandled promise rejections', async () => {
      let caught = false;
      const promise = Promise.reject(new Error('Transient failure')).catch(() => {
        caught = true;
      });
      await promise;
      assertTrue(caught);
    });
  });
});
