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

test('Tier 4: Real-World Application Workloads (Full End-to-End User Journeys)', async (t) => {
  // --------------------------------------------------------------------------
  // JOURNEY 1: Complete Developer Lifecycle Journey (Discover -> Install -> Inspect -> Toggle -> Uninstall)
  // --------------------------------------------------------------------------
  await t.test('RW-01: Complete Developer Lifecycle Journey (Vercel Find-Skills)', async (st) => {
    const sandbox = createTestSandbox();
    try {
      // Step 1: Genesis state - 0 local skills
      let localSkills = MultiRootLocalScanner.scanDirectories([
        { path: sandbox.globalSkillsDir, isPlugin: false },
      ]);
      assertEqual(localSkills.length, 0);

      // Step 2: Discover candidate in Marketplace
      const searchResults = MultiDimensionalSearchEngine.query(CURATED_MOCK_CATALOG, {
        source: 'skills_sh',
        search: '/find-skills',
      });
      assertEqual(searchResults.length, 1);
      const targetSkill = searchResults[0];
      assertEqual(targetSkill.name, 'find-skills');
      assertFalse(targetSkill.isInstalled);

      // Step 3: 1-Click Install
      const installRes = await OneClickAtomicInstaller.installSkill(sandbox.globalSkillsDir, targetSkill, [
        {
          path: 'SKILL.md',
          contents: `---
name: find-skills
description: Discover and install skills for AI agents based on task context.
triggers: ["/find-skills", "search skills"]
version: 1.0.0
author: Vercel Labs
category: coding
---

# Find Skills

Automated procedural guidance for agent skills discovery.`,
        },
        {
          path: 'scripts/matcher.py',
          contents: 'def match_skills(): return True',
        },
        {
          path: 'references/api_docs.md',
          contents: '# Skills.sh API Documentation',
        },
      ]);
      assertTrue(installRes.success);
      assertTrue(fs.existsSync(path.join(sandbox.globalSkillsDir, 'find-skills', 'metadata.json')));

      // Step 4: Re-scan local environment
      localSkills = MultiRootLocalScanner.scanDirectories([
        { path: sandbox.globalSkillsDir, isPlugin: false },
      ]);
      assertEqual(localSkills.length, 1);
      const installedItem = localSkills[0];
      assertTrue(installedItem.isInstalled);
      assertTrue(installedItem.isEnabled);
      assertEqual(installedItem.category, 'coding');

      // Step 5: Live SKILL.md Inspector Drawer inspection
      const rawContent = fs.readFileSync(path.join(sandbox.globalSkillsDir, 'find-skills', 'SKILL.md'), 'utf-8');
      const parsed = ResilientFrontmatterParser.parse(rawContent);
      assertEqual(parsed.title, 'Find Skills');
      assertIncludes(parsed.body, 'Automated procedural guidance');

      // Step 6: Toggle skill off (muted)
      OneClickAtomicInstaller.toggleSkillStatus(sandbox.globalSkillsDir, 'find-skills', false);
      localSkills = MultiRootLocalScanner.scanDirectories([
        { path: sandbox.globalSkillsDir, isPlugin: false },
      ]);
      assertFalse(localSkills[0].isEnabled);

      // Step 7: Toggle skill back on (active)
      OneClickAtomicInstaller.toggleSkillStatus(sandbox.globalSkillsDir, 'find-skills', true);
      localSkills = MultiRootLocalScanner.scanDirectories([
        { path: sandbox.globalSkillsDir, isPlugin: false },
      ]);
      assertTrue(localSkills[0].isEnabled);

      // Step 8: Search by trigger confirms active state
      const triggerSearch = MultiDimensionalSearchEngine.query(localSkills, {
        search: '/find-skills',
      });
      assertEqual(triggerSearch.length, 1);
      assertTrue(triggerSearch[0].isEnabled);

      // Step 9: Uninstall skill
      const uninstalled = OneClickAtomicInstaller.uninstallSkill(sandbox.globalSkillsDir, 'find-skills');
      assertTrue(uninstalled);
      assertFalse(fs.existsSync(path.join(sandbox.globalSkillsDir, 'find-skills')));

      // Step 10: Re-scan confirms return to 0 local skills
      localSkills = MultiRootLocalScanner.scanDirectories([
        { path: sandbox.globalSkillsDir, isPlugin: false },
      ]);
      assertEqual(localSkills.length, 0);
    } finally {
      sandbox.cleanup();
    }
  });

  // --------------------------------------------------------------------------
  // JOURNEY 2: Deep Local Multi-Root Offline Discovery Journey
  // --------------------------------------------------------------------------
  await t.test('RW-02: Deep Local Multi-Root Offline Discovery Journey', (st) => {
    const sandbox = createTestSandbox();
    try {
      // 1. Populate multi-root workspace (Global, Custom, Science)
      // Global: apple-design, animate, ponytail
      populateMockSkill(sandbox.globalSkillsDir, 'apple-design', {
        frontmatter: { name: 'apple-design', description: 'Apple fluid motion', category: 'design' },
      });
      populateMockSkill(sandbox.globalSkillsDir, 'animate', {
        frontmatter: { name: 'animate', description: 'Motion from scratch', category: 'design' },
      });
      populateMockSkill(sandbox.globalSkillsDir, 'ponytail', {
        frontmatter: { name: 'ponytail', description: 'Lazy senior dev mode', category: 'coding' },
      });

      // Custom: backend-architect, ui-ux-pro-max, medical-biostatistics (Persian UTF-8)
      populateMockSkill(sandbox.customSkillsDir, 'backend-architect', {
        frontmatter: { name: 'backend-architect', description: 'Backend architectures', category: 'architecture' },
      });
      populateMockSkill(sandbox.customSkillsDir, 'ui-ux-pro-max', {
        frontmatter: { name: 'ui-ux-pro-max', description: 'Design intelligence system', category: 'design' },
      });
      populateMockSkill(sandbox.customSkillsDir, 'medical-biostatistics', {
        frontmatter: { name: 'medical-biostatistics', description: 'تحلیل آماری زیستی', category: 'science' },
        body: '# تحلیل تخصصی داده های پزشکی',
      });

      // Science: alphafold-database, chembl-database, pubmed-database
      populateMockSkill(sandbox.scienceSkillsDir, 'alphafold-database', {
        frontmatter: { name: 'alphafold-database', description: 'AlphaFold 3D protein analysis', category: 'science' },
        subfiles: [
          { path: 'scripts/plddt.py', content: 'def plddt(): pass' },
          { path: 'references/methods.md', content: '# Methods' },
        ],
      });
      populateMockSkill(sandbox.scienceSkillsDir, 'chembl-database', {
        frontmatter: { name: 'chembl-database', description: 'Bioactive molecules and IC50 metrics', category: 'science' },
      });
      populateMockSkill(sandbox.scienceSkillsDir, 'pubmed-database', {
        frontmatter: { name: 'pubmed-database', description: 'Literature search via NCBI', category: 'science' },
      });

      // Add adjacent private files in roots (threat simulation)
      fs.writeFileSync(path.join(sandbox.globalSkillsDir, '.env'), 'OPENAI_API_KEY=sk-test123', 'utf-8');
      fs.writeFileSync(path.join(sandbox.customSkillsDir, 'mcp_config.json'), '{"key":"secret"}', 'utf-8');

      // 2. Perform comprehensive multi-root scan
      const scanned = MultiRootLocalScanner.scanDirectories([
        { path: sandbox.globalSkillsDir, isPlugin: false },
        { path: sandbox.customSkillsDir, isPlugin: true },
        { path: sandbox.scienceSkillsDir, isPlugin: true },
      ]);
      assertEqual(scanned.length, 9);

      // 3. Verify zero leak of adjacent credentials
      for (const item of scanned) {
        assertNotIncludes(item.content || '', 'OPENAI_API_KEY');
        assertNotIncludes(item.content || '', '{"key":"secret"}');
      }

      // 4. Filter by Category: Science
      const scienceSkills = MultiDimensionalSearchEngine.query(scanned, {
        category: 'science',
      });
      assertEqual(scienceSkills.length, 4); // medical-biostatistics, alphafold, chembl, pubmed

      // 5. Inspect AlphaFold multi-file assets
      const alphafold = scanned.find((s) => s.name === 'alphafold-database');
      assertTrue(alphafold !== undefined);
      assertTrue(fs.existsSync(path.join(sandbox.scienceSkillsDir, 'alphafold-database', 'scripts', 'plddt.py')));

      // 6. Verify Persian UTF-8 skill preserved without corruption
      const bioStat = scanned.find((s) => s.name === 'medical-biostatistics');
      assertTrue(bioStat !== undefined);
      assertIncludes(bioStat?.description || '', 'تحلیل آماری زیستی');
    } finally {
      sandbox.cleanup();
    }
  });

  // --------------------------------------------------------------------------
  // JOURNEY 3: Adversarial Resilient Deployment Under Network Chaos & File Locks
  // --------------------------------------------------------------------------
  await t.test('RW-03: Adversarial Deployment Under Network Chaos & File Locks', async (st) => {
    const sandbox = createTestSandbox();
    try {
      // 1. Simultaneous bulk installation of 4 skills with simulated network / file-lock chaos
      const candidates = CURATED_MOCK_CATALOG.slice(0, 4);

      const installPromises = candidates.map(async (candidate, index) => {
        const simulateLock = index === 1 ? 2 : 0; // Skill 1 experiences Windows file-lock delay
        const res = await OneClickAtomicInstaller.installSkill(
          sandbox.globalSkillsDir,
          candidate,
          [
            {
              path: 'SKILL.md',
              contents: `---
name: ${candidate.name}
description: ${candidate.description}
category: ${candidate.category}
---
# ${candidate.title}`,
            },
          ],
          { simulateLockErrorCount: simulateLock }
        );
        return res;
      });

      const results = await Promise.all(installPromises);
      assertEqual(results.length, 4);
      assertTrue(results.every((r) => r.success));

      // 2. Malicious package injection attempt: directory traversal attack
      const maliciousCandidate: SkillItem = {
        ...CURATED_MOCK_CATALOG[0],
        name: '../../Windows/System32/hacked',
      };

      let threw = false;
      try {
        await OneClickAtomicInstaller.installSkill(sandbox.globalSkillsDir, maliciousCandidate, [
          { path: 'SKILL.md', contents: 'malicious' },
        ]);
      } catch (err: unknown) {
        threw = true;
        assertIncludes((err as Error).message, 'Directory traversal');
      }
      assertTrue(threw);

      // 3. Verify target directory contains only the 4 legitimate skills and NO leaked .tmp folders
      const dirEntries = fs.readdirSync(sandbox.globalSkillsDir);
      assertEqual(dirEntries.length, 4);
      assertFalse(dirEntries.some((e) => e.includes('.tmp')));
    } finally {
      sandbox.cleanup();
    }
  });

  // --------------------------------------------------------------------------
  // JOURNEY 4: Enterprise OpSec Audit Journey (Zero-Leak Boundary Gate)
  // --------------------------------------------------------------------------
  await t.test('RW-04: Enterprise OpSec Audit Journey (Zero-Leak Boundary Gate)', (st) => {
    const testSlackToken = ['xoxb', '112233445566', '778899001122', 'abcdefghijklmnopqrstuvwx'].join('-');
    const testGoogleKey = ['AIza', 'SyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q'].join('');
    const rawEnterpriseDoc = `---
name: production-deployment-gateway
description: Internal corporate deployment guide
---

# Production Deployment Gateway

## Confidential Infrastructure Configuration
- AWS Master Key: AKIAIOSFODNN7EXAMPLE
- OpenAI Production Secret: sk-proj-ProductionSecretKey99887766554433221100
- Slack Alerts Webhook Token: ${testSlackToken}
- Exa Production Index: 12345678-abcd-1234-abcd-1234567890ab
- Notion Internal KB: ntn_99887766554433221100aabbccddeeff
- Google AI Core Key: ${testGoogleKey}
- Bearer Auth Header: Bearer corp_bearer_token_xyz_99887766
- Local Log Archive: C:\\Users\\ersha\\.gemini\\config\\skills\\deployment\\audit.log
- Direct Secret: api_key = "CorporateDatabaseSecretPassword123"
`;

    // 1. AST Parsing
    const parsed = ResilientFrontmatterParser.parse(rawEnterpriseDoc);
    assertEqual(parsed.name, 'production-deployment-gateway');

    // 2. OpSec Redaction Gate
    const sanitizedOutput = ZeroLeakRedactor.redactText(parsed.body, 'ersha');

    // 3. Negative assertions: Verify zero leakage of plain credentials
    assertNotIncludes(sanitizedOutput, 'AKIAIOSFODNN7EXAMPLE');
    assertNotIncludes(sanitizedOutput, 'sk-proj-ProductionSecretKey99887766554433221100');
    assertNotIncludes(sanitizedOutput, testSlackToken);
    assertNotIncludes(sanitizedOutput, '12345678-abcd-1234-abcd-1234567890ab');
    assertNotIncludes(sanitizedOutput, 'ntn_99887766554433221100aabbccddeeff');
    assertNotIncludes(sanitizedOutput, testGoogleKey);
    assertNotIncludes(sanitizedOutput, 'corp_bearer_token_xyz_99887766');
    assertNotIncludes(sanitizedOutput, 'C:\\Users\\ersha');
    assertNotIncludes(sanitizedOutput, 'CorporateDatabaseSecretPassword123');

    // 4. Positive assertions: Verify structured redaction markers
    assertIncludes(sanitizedOutput, 'AKIA****************');
    assertIncludes(sanitizedOutput, 'sk-********************************');
    assertIncludes(sanitizedOutput, 'xoxb-**********-**********-************************');
    assertIncludes(sanitizedOutput, '********-****-****-****-************');
    assertIncludes(sanitizedOutput, 'ntn_********************************');
    assertIncludes(sanitizedOutput, 'AIza***********************************');
    assertIncludes(sanitizedOutput, 'Bearer [REDACTED_TOKEN]');
    assertIncludes(sanitizedOutput, '~\\.gemini\\config\\skills\\deployment\\audit.log');
    assertIncludes(sanitizedOutput, '[REDACTED_SECRET]');
  });
});
