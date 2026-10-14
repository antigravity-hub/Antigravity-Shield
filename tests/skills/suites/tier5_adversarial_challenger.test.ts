/**
 * Tier 5: Adversarial Challenger Test Suite (Milestone 1 & 2)
 *
 * Exhaustive empirical stress testing for:
 * 1. searchSkillsCatalog with edge cases, whitespace, trigger prefixes, special regex chars, compound filters
 * 2. Search multi-field matching (title, name, slug, description, author, owner, repo, tags, triggers)
 * 3. Persian UTF-8 queries and non-ASCII character handling
 * 4. Catalog helper routines and domain constraints
 */

import { describe, it } from 'node:test';
import {
  searchSkillsCatalog,
  getSkillsByCategory,
  getOfficialSkills,
  getSkillsBySource,
  getTrendingSkills,
  getSkillById,
  getCatalogCategories,
  SKILLS_SH_CATALOG,
} from '../../../src/config/skillsCatalog';
import {
  assertEqual,
  assertTrue,
  assertFalse,
  assertGreaterThanOrEqual,
  assertIncludes,
} from '../harness/assertions';

describe('Tier 5 Adversarial Challenger: Search Engine & Catalog Stress Suite', () => {
  // =========================================================================
  // 1. Edge-Case Queries & Delimiters
  // =========================================================================
  it('ADV-SEARCH-1: Empty and whitespace queries match entire catalog or respect filters', () => {
    const totalCount = SKILLS_SH_CATALOG.length;
    assertGreaterThanOrEqual(totalCount, 30, 'Catalog should contain at least 30 curated skills');

    // Exactly empty string
    const emptyResults = searchSkillsCatalog('');
    assertEqual(emptyResults.length, totalCount, 'Empty query must return all skills');

    // Whitespace only
    const whitespaceResults = searchSkillsCatalog('     \t\n  ');
    assertEqual(whitespaceResults.length, totalCount, 'Whitespace-only query must trim and return all skills');

    // Empty query with category filter
    const codingOnly = searchSkillsCatalog('', { category: 'coding' });
    assertTrue(codingOnly.length > 0 && codingOnly.length < totalCount);
    assertTrue(codingOnly.every((s) => s.category === 'coding'));

    // Empty query with official filter
    const officialOnly = searchSkillsCatalog('', { onlyOfficial: true });
    assertTrue(officialOnly.length > 0 && officialOnly.length < totalCount);
    assertTrue(officialOnly.every((s) => s.isOfficial === true));
  });

  it('ADV-SEARCH-2: Trigger prefixes ("/", "/command") match accurately without syntax corruption', () => {
    // Bare slash prefix
    const slashResults = searchSkillsCatalog('/');
    assertTrue(slashResults.length > 0, 'Bare slash should match items containing / in triggers, repos, or IDs');

    // Exact trigger command
    const findSkills = searchSkillsCatalog('/find-skills');
    assertTrue(findSkills.some((s) => s.name === 'find-skills'), 'Should match find-skills by trigger');

    // Trigger prefix match
    const grillMe = searchSkillsCatalog('/grill-me');
    assertTrue(grillMe.some((s) => s.name === 'grill-me'), 'Should match grill-me by trigger');

    // Partial trigger prefix
    const grillPrefix = searchSkillsCatalog('/grill');
    assertTrue(grillPrefix.some((s) => s.name === 'grill-me'));
    assertTrue(grillPrefix.some((s) => s.name === 'grill-with-docs'));

    // TDD trigger
    const tdd = searchSkillsCatalog('/tdd');
    assertTrue(tdd.some((s) => s.name === 'tdd'));
  });

  it('ADV-SEARCH-3: Hostile regex special characters do not crash or throw exceptions', () => {
    const hostileInputs = [
      '*',
      '?',
      '+',
      '[',
      ']',
      '(',
      ')',
      '{',
      '}',
      '\\',
      '^',
      '$',
      '|',
      '.',
      '.*',
      '[a-z]+',
      '(?:secret)',
      '#',
      '@',
      '!',
      '%',
      '&',
      '"',
      "'",
      '<>',
      '<script>alert(1)</script>',
      '\0',
      '\\\\',
    ];

    for (const hostile of hostileInputs) {
      let results: unknown = null;
      let didThrow = false;
      try {
        results = searchSkillsCatalog(hostile);
      } catch {
        didThrow = true;
      }

      assertFalse(didThrow, `searchSkillsCatalog threw an exception on hostile query: "${hostile}"`);
      assertTrue(Array.isArray(results), `searchSkillsCatalog must return array for query: "${hostile}"`);
    }
  });

  it('ADV-SEARCH-4: Case-insensitivity across Latin and mixed-casing inputs', () => {
    const q1 = searchSkillsCatalog('FIND-SKILLS');
    const q2 = searchSkillsCatalog('find-skills');
    const q3 = searchSkillsCatalog('FiNd-SkIlLs');

    assertEqual(q1.length, q2.length, 'Search must be case-insensitive');
    assertEqual(q2.length, q3.length, 'Search must be case-insensitive');
    assertTrue(q1.length > 0);

    const r1 = searchSkillsCatalog('REACT');
    const r2 = searchSkillsCatalog('react');
    assertEqual(r1.length, r2.length);
    assertTrue(r1.length > 0);
  });

  // =========================================================================
  // 2. Multi-Dimensional & Compound Filtering
  // =========================================================================
  it('ADV-SEARCH-5: Compound filtering across category, installed status, official, and source', () => {
    // Coding + Official
    const codingOfficial = searchSkillsCatalog('', {
      category: 'coding',
      onlyOfficial: true,
    });
    assertTrue(codingOfficial.every((s) => s.category === 'coding' && s.isOfficial === true));

    // Design + Skills.sh source
    const designSkillsSh = searchSkillsCatalog('', {
      category: 'design',
      source: 'skills.sh',
    });
    assertTrue(designSkillsSh.every((s) => s.category === 'design' && s.sourceType === 'skills.sh'));

    // Query + Category + Official
    const reactOfficial = searchSkillsCatalog('react', {
      category: 'coding',
      onlyOfficial: true,
    });
    assertTrue(reactOfficial.length > 0);
    assertTrue(reactOfficial.every((s) => s.category === 'coding' && s.isOfficial === true));

    // Local source filtering
    const localSkills = searchSkillsCatalog('', { source: 'local' });
    assertTrue(localSkills.every((s) => s.sourceType === 'local'));

    // Category 'all' behaves identically to omitting category
    const allCategory = searchSkillsCatalog('', { category: 'all' });
    assertEqual(allCategory.length, SKILLS_SH_CATALOG.length);
  });

  it('ADV-SEARCH-6: Multi-field matching across all 9 schema dimensions', () => {
    // 1. Title match
    const titleHits = searchSkillsCatalog('Discovery');
    assertTrue(titleHits.some((s) => s.title.includes('Discovery')));

    // 2. Name match
    const nameHits = searchSkillsCatalog('prototype');
    assertTrue(nameHits.some((s) => s.name === 'prototype'));

    // 3. Slug match
    const slugHits = searchSkillsCatalog('grill-me');
    assertTrue(slugHits.some((s) => s.slug === 'grill-me'));

    // 4. Description match
    const descHits = searchSkillsCatalog('hallucinations');
    assertTrue(descHits.some((s) => s.description.includes('hallucinations')));

    // 5. Author match
    const authorHits = searchSkillsCatalog('Matt Pocock');
    assertTrue(authorHits.length >= 4, 'Matt Pocock author should match multiple skills');

    // 6. Owner match
    const ownerHits = searchSkillsCatalog('vercel-labs');
    assertTrue(ownerHits.some((s) => s.owner === 'vercel-labs'));

    // 7. Repo match
    const repoHits = searchSkillsCatalog('skills');
    assertTrue(repoHits.length > 0);

    // 8. Tag match
    const tagHits = searchSkillsCatalog('TDD');
    assertTrue(tagHits.some((s) => s.tags.includes('TDD')));

    // 9. Trigger match
    const triggerHits = searchSkillsCatalog('red green refactor');
    assertTrue(triggerHits.some((s) => s.name === 'tdd'));
  });

  // =========================================================================
  // 3. Persian / Non-ASCII & Missing Results
  // =========================================================================
  it('ADV-SEARCH-7: Persian query handling and non-existent query results', () => {
    // Non-existent skill query returns empty array
    const emptyResult = searchSkillsCatalog('xyz-completely-non-existent-skill-99999');
    assertEqual(emptyResult.length, 0, 'Non-existent query should return 0 results');

    // Persian query check: should execute without errors
    const persianQuery = 'پزشکی و زیستی';
    const persianHits = searchSkillsCatalog(persianQuery);
    assertTrue(Array.isArray(persianHits));
  });

  // =========================================================================
  // 4. Catalog Helper Verification & Category Breakdown
  // =========================================================================
  it('ADV-SEARCH-8: Catalog helper functions maintain mathematical consistency', () => {
    const categories = getCatalogCategories();
    assertGreaterThanOrEqual(categories.length, 8, 'Should have 8 categories (all + 7 domains)');

    const allCat = categories.find((c) => c.id === 'all');
    assertTrue(allCat !== undefined);
    assertEqual(allCat!.count, SKILLS_SH_CATALOG.length);

    // Verify sum of domain categories equals total
    const domainSum = categories
      .filter((c) => c.id !== 'all')
      .reduce((acc, c) => acc + c.count, 0);
    assertEqual(domainSum, SKILLS_SH_CATALOG.length, 'Sum of domain categories must equal total catalog size');

    // Test getSkillsByCategory
    const codingSkills = getSkillsByCategory('coding');
    assertTrue(codingSkills.every((s) => s.category === 'coding'));
    const allSkills = getSkillsByCategory('all');
    assertEqual(allSkills.length, SKILLS_SH_CATALOG.length);

    // Test getOfficialSkills
    const officialSkills = getOfficialSkills();
    assertTrue(officialSkills.every((s) => s.isOfficial === true));

    // Test getTrendingSkills
    const trending = getTrendingSkills(5);
    assertEqual(trending.length, 5);
    for (let i = 1; i < trending.length; i++) {
      assertTrue((trending[i - 1].installs ?? 0) >= (trending[i].installs ?? 0));
    }

    // Test getSkillById with ID and slug
    const byId = getSkillById('vercel-labs/skills/find-skills');
    assertTrue(byId !== undefined);
    assertEqual(byId!.name, 'find-skills');

    const bySlug = getSkillById('find-skills');
    assertTrue(bySlug !== undefined);
    assertEqual(bySlug!.id, 'vercel-labs/skills/find-skills');

    const byUpper = getSkillById('VERCEL-LABS/SKILLS/FIND-SKILLS');
    assertTrue(byUpper !== undefined);

    const nonExistent = getSkillById('non-existent-id');
    assertEqual(nonExistent, undefined);
  });
});
