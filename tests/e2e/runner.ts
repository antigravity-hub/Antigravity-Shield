/**
 * Antigravity-Shield Master E2E Test Suite Runner
 *
 * Executes the comprehensive 4-Tier regression test suite covering
 * all 14 hardened features and the 7 critical hardened pathways.
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
    name: 'oauth_concurrency_timeout.test.ts',
    category: 'Features 5, 6, 7 (OAuth Concurrency & 15s Timeout Engine)',
  },
  {
    name: 'context_deduplication.test.ts',
    category: 'Feature 8 (Context Reconciliation & Non-Duplication)',
  },
  {
    name: 'url_sanitization.test.ts',
    category: 'Feature 4 (Production Route Whitelisting & Scrubbing)',
  },
  {
    name: 'error_categorization_and_quarantine.test.ts',
    category: 'Features 3 & 11 (429 RateLimit vs 403 Safe Quarantine)',
  },
  {
    name: 'device_fingerprint_isolation.test.ts',
    category: 'Feature 2 (DeviceProfile Virtual Hardware Fingerprinting)',
  },
  {
    name: 'gemini_tool_leak_recovery.test.ts',
    category: 'Features 9 & 10 (Thinking Pruning & Tool Recovery Bridge)',
  },
  {
    name: 'geo_fallback.test.ts',
    category: 'Features 11 & 12 (Geo 400 Reclassification & Proxy Pool Failover)',
  },
];

async function runSuite(suiteFile: string, category: string): Promise<SuiteResult> {
  const startTime = Date.now();
  const relativePath = 'tests/e2e/suites/' + suiteFile;

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
      const status = (code === 0 && failed === 0) ? 'PASS' : 'FAIL';

      if (status === 'FAIL') {
        console.error('\n[DIAGNOSTIC FAILURE OUTPUT for ' + suiteFile + ']');
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
  console.log('  ANTIGRAVITY-SHIELD HARDENED E2E TEST RUNNER (4-TIER FRAMEWORK)');
  console.log('================================================================');
  console.log('Target Environment: Antigravity-Shield Local Proxy Gateway');
  console.log('Verification Standard: TEST_INFRA.md & PROJECT.md');
  console.log('Started at: ' + new Date().toISOString());
  console.log('----------------------------------------------------------------\n');

  const suiteResults: SuiteResult[] = [];
  let totalPassed = 0;
  let totalFailed = 0;
  const overallStart = Date.now();

  for (const s of SUITES) {
    process.stdout.write('  RUNNING: ' + s.name + ' ... ');
    const res = await runSuite(s.name, s.category);
    suiteResults.push(res);
    totalPassed += res.passed;
    totalFailed += res.failed;

    if (res.status === 'PASS') {
      console.log('PASSED (' + res.passed + ' tests, ' + res.durationMs + 'ms)');
    } else {
      console.log('FAILED (' + res.failed + ' failed, ' + res.durationMs + 'ms)');
    }
  }

  const totalDuration = Date.now() - overallStart;

  console.log('\n================================================================');
  console.log('                      E2E TEST SUITE SUMMARY                    ');
  console.log('================================================================');
  console.table(
    suiteResults.map((r) => ({
      'Test Suite': r.suite,
      'Hardened Scope': r.category,
      'Pass': r.passed,
      'Fail': r.failed,
      'Duration': r.durationMs + 'ms',
      'Status': r.status,
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
