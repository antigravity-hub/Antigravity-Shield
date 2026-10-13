/**
 * Antigravity-Shield Skills Ecosystem & Skills.sh Master E2E Test Suite Runner
 *
 * Executes the requirement-driven 4-Tier E2E test suite covering:
 * - Tier 1: Feature Coverage (Local scanning, parser, Zero-Leak, catalog, search, install, toggle, UI)
 * - Tier 2: Boundary & Corner Cases (Malformed YAML, Persian UTF-8, 12 secret tokens, Windows locks, 429)
 * - Tier 3: Cross-Feature Combinations (Pairwise interactions, deduplication, cache invalidation)
 * - Tier 4: Real-World Application Workloads (Complete developer journeys, offline discovery, OpSec audit)
 */

import { spawn } from 'node:child_process';
import path from 'node:path';

interface SuiteResult {
  suite: string;
  category: string;
  passed: number;
  failed: number;
  durationMs: number;
  status: 'PASS' | 'FAIL';
}

const SUITES = [
  {
    name: 'tier1_feature_coverage.test.ts',
    category: 'Tier 1: Feature Coverage (Positive Happy Paths - 15 Features)',
  },
  {
    name: 'tier2_boundary_corner_cases.test.ts',
    category: 'Tier 2: Boundary & Corner Cases (12 Secret Tokens, Traversal, 429, Locks)',
  },
  {
    name: 'tier3_cross_feature_combinations.test.ts',
    category: 'Tier 3: Cross-Feature Combinations (Pairwise & Compound Interactions)',
  },
  {
    name: 'tier4_real_world_workloads.test.ts',
    category: 'Tier 4: Real-World Workloads (Full End-to-End User Journeys)',
  },
];

async function runSuite(suiteFile: string, category: string): Promise<SuiteResult> {
  const startTime = Date.now();
  const relativePath = 'tests/skills/suites/' + suiteFile;

  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const npxCmd = isWindows ? 'npx.cmd' : 'npx';

    const child = spawn(npxCmd, ['tsx', '--test', relativePath], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('close', (code) => {
      const durationMs = Date.now() - startTime;
      const passMatches = stdout.match(/^\s*ok\s+\d+/gm) || [];
      const failMatches = stdout.match(/^\s*not ok\s+\d+/gm) || [];

      const passed = passMatches.length;
      const failed = failMatches.length;
      const status = code === 0 && failed === 0 ? 'PASS' : 'FAIL';

      if (status === 'FAIL') {
        console.error(`\n[DIAGNOSTIC FAILURE OUTPUT for ${suiteFile}]`);
        if (stderr.trim()) console.error('STDERR:', stderr.trim());
        if (stdout.trim()) console.error('STDOUT:', stdout.trim());
      }

      resolve({
        suite: suiteFile,
        category,
        passed,
        failed,
        durationMs,
        status,
      });
    });
  });
}

async function main() {
  console.log('================================================================');
  console.log('  ANTIGRAVITY SHIELD SKILLS ECOSYSTEM E2E TEST RUNNER (4-TIER)  ');
  console.log('================================================================');
  console.log('Target Architecture: Local Skills Scanner + Skills.sh Marketplace');
  console.log('Verification Standard: PROJECT.md & ORIGINAL_REQUEST.md');
  console.log('Started at: ' + new Date().toISOString());
  console.log('----------------------------------------------------------------\n');

  const suiteResults: SuiteResult[] = [];
  let totalPassed = 0;
  let totalFailed = 0;
  const overallStart = Date.now();

  for (const s of SUITES) {
    process.stdout.write(`  RUNNING: ${s.name} ... `);
    const res = await runSuite(s.name, s.category);
    suiteResults.push(res);
    totalPassed += res.passed;
    totalFailed += res.failed;

    if (res.status === 'PASS') {
      console.log(`PASSED (${res.passed} assertions, ${res.durationMs}ms)`);
    } else {
      console.log(`FAILED (${res.failed} failures, ${res.durationMs}ms)`);
    }
  }

  const totalDuration = Date.now() - overallStart;

  console.log('\n================================================================');
  console.log('                     SKILLS E2E TEST SUMMARY                    ');
  console.log('================================================================');
  console.table(
    suiteResults.map((r) => ({
      'Test Suite': r.suite,
      'Tier Scope': r.category,
      Pass: r.passed,
      Fail: r.failed,
      Duration: `${r.durationMs}ms`,
      Status: r.status,
    }))
  );

  console.log('----------------------------------------------------------------');
  console.log('Total Test Suites : ' + suiteResults.length);
  console.log('Total Assertions  : ' + (totalPassed + totalFailed));
  console.log('Passed Tests      : ' + totalPassed);
  console.log('Failed Tests      : ' + totalFailed);
  console.log('Total Wall Time   : ' + (totalDuration / 1000).toFixed(2) + 's');
  console.log('Overall Status    : ' + (totalFailed === 0 ? 'ALL PASS (100%)' : 'FAILURES DETECTED'));
  console.log('================================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
