#!/usr/bin/env node

/**
 * Antigravity Shield API Proxy E2E Test Suite Runner
 *
 * Executes the authoritative 4-Tier regression test suite:
 * - Tier 1: Feature Coverage (Happy Paths for OpenAI, Claude, Models, Aliases)
 * - Tier 2: Boundary & Corner Cases (Empty payload, Missing params, 401, 429 Failover, Abort)
 * - Tier 3: Cross-Feature Combinations (Streaming + Tools, Alias + Cooldown, Thinking)
 * - Tier 4: Real-World Agent Scenarios (Cursor, Claude Code CLI, Windsurf, Python SDK)
 */

import { runTier1Tests } from './suites/tier1_feature_coverage.mjs';
import { runTier2Tests } from './suites/tier2_boundary_cases.mjs';
import { runTier3Tests } from './suites/tier3_cross_features.mjs';
import { runTier4Tests } from './suites/tier4_real_world.mjs';
import { runTier5Tests } from './suites/tier5_adversarial_stress.mjs';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

async function main() {
  const startTime = Date.now();

  console.log(`${colors.cyan}${colors.bold}================================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}  ANTIGRAVITY SHIELD API PROXY E2E TEST SUITE (5-TIER FRAMEWORK)${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}================================================================${colors.reset}`);
  console.log(`${colors.dim}Target Architecture: Axum Proxy Gateway & Protocol Mappers${colors.reset}`);
  console.log(`${colors.dim}Verification Specification: TEST_INFRA.md & PROJECT.md${colors.reset}`);
  console.log(`${colors.dim}Started at: ${new Date().toISOString()}${colors.reset}\n`);

  const suites = [
    { name: 'Tier 1: Feature Coverage (Happy Paths)', runner: runTier1Tests },
    { name: 'Tier 2: Boundary & Corner Cases', runner: runTier2Tests },
    { name: 'Tier 3: Cross-Feature Combinations', runner: runTier3Tests },
    { name: 'Tier 4: Real-World Scenarios', runner: runTier4Tests },
    { name: 'Tier 5: Adversarial Stress & Stream Safety', runner: runTier5Tests },
  ];

  const summary = [];
  let totalPassed = 0;
  let totalFailed = 0;

  for (const s of suites) {
    process.stdout.write(`  RUNNING: ${colors.bold}${s.name}${colors.reset} ... `);
    const sStart = Date.now();
    try {
      const res = await s.runner();
      const sDuration = Date.now() - sStart;
      totalPassed += res.passed;
      totalFailed += res.failed;

      const isPass = res.failed === 0;
      const statusText = isPass
        ? `${colors.green}PASSED${colors.reset} (${res.passed} tests, ${sDuration}ms)`
        : `${colors.red}FAILED${colors.reset} (${res.failed} failed, ${res.passed} passed, ${sDuration}ms)`;

      console.log(statusText);

      summary.push({
        Suite: res.name,
        Tier: res.tier,
        Passed: res.passed,
        Failed: res.failed,
        Duration: `${sDuration}ms`,
        Status: isPass ? 'PASS' : 'FAIL'
      });

      if (res.errors && res.errors.length > 0) {
        for (const err of res.errors) {
          console.error(`    ${colors.red}✖ ${err.name}:${colors.reset} ${err.error}`);
          if (err.stack) {
            console.error(`${colors.dim}${err.stack.split('\n').slice(1, 4).join('\n')}${colors.reset}`);
          }
        }
      }
    } catch (fatalErr) {
      const sDuration = Date.now() - sStart;
      totalFailed++;
      console.log(`${colors.red}CRASHED${colors.reset} (${sDuration}ms)`);
      console.error(fatalErr);
      summary.push({
        Suite: s.name,
        Tier: 'Fatal Error',
        Passed: 0,
        Failed: 1,
        Duration: `${sDuration}ms`,
        Status: 'CRASH'
      });
    }
  }

  const totalDuration = Date.now() - startTime;

  console.log(`\n${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}                    API PROXY E2E SUMMARY REPORT                ${colors.reset}`);
  console.log(`${colors.cyan}================================================================${colors.reset}`);
  console.table(summary);

  console.log('----------------------------------------------------------------');
  console.log(`Total Test Suites : ${summary.length}`);
  console.log(`Total Assertions  : ${totalPassed + totalFailed}`);
  console.log(`Passed Tests      : ${colors.green}${totalPassed}${colors.reset}`);
  console.log(`Failed Tests      : ${totalFailed > 0 ? colors.red + totalFailed + colors.reset : '0'}`);
  console.log(`Total Wall Time   : ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`Overall Status    : ${totalFailed === 0 ? colors.green + 'ALL PASS (100%)' + colors.reset : colors.red + 'FAILURES DETECTED' + colors.reset}`);
  console.log(`${colors.cyan}================================================================${colors.reset}\n`);

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
