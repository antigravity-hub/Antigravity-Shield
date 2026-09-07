/**
 * Standalone assertion script for categorizeModel and getModelProtectionKey.
 *
 * Imports from the standalone utils module (no @lobehub/icons dependency,
 * runs under plain Node.js via npx tsx).
 *
 * Run: npx tsx src/config/__tests__/modelConfig.test.ts
 */
import {
    categorizeModel,
    getModelProtectionKey,
    getModelDisplayName,
    findQuotaModel,
    findImageQuotaModel,
    ensurePinnedImageSelector,
    DEFAULT_IMAGE_PIN_SELECTOR,
    resolveQuotaModels,
    type ModelCategory,
} from '../../utils/modelCategory';
// Compile-time guard: if findImageQuotaModel is removed from the config re-export,
// the type alias test below fails with TS2724 on `pnpm tsc --noEmit`.
function __noop<T>(): void { const _x: T[] = []; void _x; }
type _ConfigFindImageQuotaModel = typeof import('../../config/modelConfig').findImageQuotaModel;
__noop<_ConfigFindImageQuotaModel>();

let passed = 0;
let failed = 0;

function test(description: string, fn: () => void): void {
    try {
        fn();
        passed++;
    } catch (e: unknown) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  FAIL: ${description}  — ${msg}`);
    }
}

function assertEqual<T>(actual: T, expected: T): void {
    if (actual !== expected) {
        throw new Error(`expected "${expected}", got "${actual}"`);
    }
}

const categorizeCases: Array<[string, ModelCategory]> = [
    // canonical
    ['gemini-3.5-flash', 'gemini-flash'],
    ['gemini-3.1-pro', 'gemini-pro'],
    // physical / variants
    ['gemini-3-flash-agent', 'gemini-flash'],
    ['gemini-3.5-flash-low', 'gemini-flash'],
    ['gemini-3.5-flash-extra-low', 'gemini-flash'],
    ['gemini-pro-agent', 'gemini-pro'],
    ['gemini-3.1-pro-low', 'gemini-pro'],
    // legacy
    ['gemini-3-flash', 'gemini-flash'],
    ['gemini-3-pro-high', 'gemini-pro'],
    ['gemini-3.1-pro-high', 'gemini-pro'],
    ['gemini-3-pro-low', 'gemini-pro'],
    // image split
    ['gemini-3.1-flash-image', 'gemini-flash-image'],
    ['gemini-3-pro-image', 'gemini-pro-image'],
    ['imagen-3.0', 'gemini-pro-image'],
    // claude
    ['claude-sonnet-4-6', 'claude'],
    ['claude-opus-4-6-thinking', 'claude'],
    // edge / other providers
    ['gpt-4o', 'other'],
    ['gpt-oss-120b-medium', 'other'],
];

for (const [name, expected] of categorizeCases) {
    test(`categorizeModel("${name}")`, () => {
        assertEqual(categorizeModel(name), expected);
    });
}

const protectionCases: Array<[string, string | null]> = [
    ['gemini-3.5-flash', 'gemini-3-flash'],
    ['gemini-3.1-pro', 'gemini-3-pro-high'],
    ['gemini-3.1-flash-image', 'gemini-3.1-flash-image'],
    ['gemini-3-pro-image', 'gemini-3-pro-image'],
    ['claude-sonnet-4-6', 'claude'],
    ['gpt-4o', null],
];

for (const [name, expected] of protectionCases) {
    test(`getModelProtectionKey("${name}")`, () => {
        assertEqual(getModelProtectionKey(name), expected);
    });
}

// ── getModelDisplayName ──────────────────────────────────────────────────────

type ModelInput = { name: string; display_name?: string } | null | undefined;

const displayNameCases: Array<[ModelInput, string | undefined, string]> = [
    [{ name: 'gemini-3-pro-high', display_name: 'Gemini 3.1 Pro High' }, undefined, 'Gemini 3.1 Pro High'],
    [{ name: 'gemini-3-flash' }, undefined, 'gemini-3-flash'],
    [{ name: 'gemini-3.1-flash-image', display_name: undefined }, undefined, 'gemini-3.1-flash-image'],
    [undefined, 'Claude 系列', 'Claude 系列'],
    [null, undefined, ''],
    [{ name: 'claude-opus-4-6-thinking', display_name: 'Claude Opus 4.6 TK' }, undefined, 'Claude Opus 4.6 TK'],
];

for (const [model, fallback, expected] of displayNameCases) {
    const label = model === null
        ? 'getModelDisplayName(null)'
        : model === undefined
            ? `getModelDisplayName(undefined, '${fallback}')`
            : `getModelDisplayName({name:'${model.name}'${model.display_name ? `, display_name:'${model.display_name}'` : ''}})`;
    test(label, () => {
        assertEqual(getModelDisplayName(model, fallback), expected);
    });
}

// ── findQuotaModel ──────────────────────────────────────────────────────────

const findCases: Array<[Array<{ name: string }>, ModelCategory, string | null]> = [
    // Pro: preferred chain
    [[{ name: 'gemini-pro-agent' }, { name: 'gemini-3.1-pro-low' }], 'gemini-pro', 'gemini-pro-agent'],
    [[{ name: 'gemini-2.5-pro' }], 'gemini-pro', 'gemini-2.5-pro'],
    // Flash: preferred chain
    [[{ name: 'gemini-3-flash-agent' }, { name: 'gemini-3.5-flash-low' }], 'gemini-flash', 'gemini-3-flash-agent'],
    // Claude: preferred chain
    [[{ name: 'claude-sonnet-4-6' }, { name: 'claude-opus-4-6-thinking' }], 'claude', 'claude-sonnet-4-6'],
    [[{ name: 'claude-opus-4-6-thinking' }], 'claude', 'claude-opus-4-6-thinking'],
    // Empty
    [[], 'gemini-pro', null],
    // Fallback to categorizeModel
    [[{ name: 'gemini-3.5-flash-extra-low' }], 'gemini-flash', 'gemini-3.5-flash-extra-low'],
];

for (const [models, category, expected] of findCases) {
    test(`findQuotaModel(${category}, ${models.length} models)`, () => {
        const result = findQuotaModel(models, category);
        assertEqual(result?.name ?? null, expected);
    });
}

// ── resolveQuotaModels image-selector regression ──────────────────────────────

const imageModels = [{ name: 'gemini-3.1-flash-image', percentage: 80 }];

test('resolveQuotaModels: legacy gemini-3-pro-image resolves flash-image + category:gemini-image', () => {
    const results = resolveQuotaModels(imageModels, ['gemini-3-pro-image']);
    assertEqual(results.length, 1);
    assertEqual(results[0].selectionKey, 'category:gemini-image');
    assertEqual(results[0].model?.name, 'gemini-3.1-flash-image');
});

test('resolveQuotaModels: current gemini-3.1-flash-image resolves same model + key', () => {
    const results = resolveQuotaModels(imageModels, ['gemini-3.1-flash-image']);
    assertEqual(results.length, 1);
    assertEqual(results[0].selectionKey, 'category:gemini-image');
    assertEqual(results[0].model?.name, 'gemini-3.1-flash-image');
});

test('resolveQuotaModels: both image selectors dedupe to one selection', () => {
    const results = resolveQuotaModels(imageModels, ['gemini-3-pro-image', 'gemini-3.1-flash-image']);
    assertEqual(results.length, 1);
    assertEqual(results[0].selectionKey, 'category:gemini-image');
    assertEqual(results[0].model?.name, 'gemini-3.1-flash-image');
});

test('resolveQuotaModels: legacy image selector with no image API model returns unresolved', () => {
    const results = resolveQuotaModels([{ name: 'gemini-3.5-flash', percentage: 50 }], ['gemini-3-pro-image']);
    assertEqual(results.length, 1);
    assertEqual(results[0].selectionKey, 'category:gemini-image');
    assertEqual(results[0].model, undefined);
});

test('resolveQuotaModels: exact match keeps discrete pinned models instead of collapsing into category', () => {
    const models = [
        { name: 'gemini-3.7-flash-low', percentage: 90 },
        { name: 'gemini-3.7-flash-high', percentage: 95 },
        { name: 'gemini-3-flash-agent', percentage: 80 },
    ];
    const results = resolveQuotaModels(models, ['gemini-3.7-flash-low', 'gemini-3.7-flash-high']);
    assertEqual(results.length, 2);
    assertEqual(results[0].selectionKey, 'model:gemini-3.7-flash-low');
    assertEqual(results[0].model?.name, 'gemini-3.7-flash-low');
    assertEqual(results[1].selectionKey, 'model:gemini-3.7-flash-high');
    assertEqual(results[1].model?.name, 'gemini-3.7-flash-high');
});

// ── findImageQuotaModel ───────────────────────────────────────────────────

const imageNameCases: Array<[Array<{ name: string }>, string | null]> = [
    [[{ name: 'gemini-3.1-flash-image' }, { name: 'gemini-3-pro-image' }], 'gemini-3.1-flash-image'],
    [[{ name: 'gemini-3-pro-image' }], 'gemini-3-pro-image'],
    [[{ name: 'gemini-3.5-flash' }], null],
];

for (const [models, expected] of imageNameCases) {
    test(`findImageQuotaModel(${models.length} models)`, () => {
        const result = findImageQuotaModel(models);
        assertEqual(result?.name ?? null, expected);
    });
}

// ── ensurePinnedImageSelector (account management pin gap) ─────────────────

test('ensurePinnedImageSelector: empty list gains default image pin', () => {
    const result = ensurePinnedImageSelector([]);
    assertEqual(result.length, 1);
    assertEqual(result[0], DEFAULT_IMAGE_PIN_SELECTOR);
});

test('ensurePinnedImageSelector: live user pin list without image gains flash-image', () => {
    const livePins = [
        'gemini-3-pro-high',
        'gemini-3-flash',
        'claude-sonnet-4-5-thinking',
        'gemini-3.1-pro-high',
        'gemini-3.1-pro-low',
        'claude-sonnet-4-6',
    ];
    const result = ensurePinnedImageSelector(livePins);
    assertEqual(result.includes(DEFAULT_IMAGE_PIN_SELECTOR), true);
    assertEqual(result.length, livePins.length + 1);
});

test('ensurePinnedImageSelector: existing flash-image pin is unchanged', () => {
    const pins = ['gemini-pro-agent', 'gemini-3.1-flash-image'];
    const result = ensurePinnedImageSelector(pins);
    assertEqual(result.length, 2);
    assertEqual(result.join(','), pins.join(','));
});

test('ensurePinnedImageSelector: existing pro-image pin is unchanged', () => {
    const pins = ['gemini-3-pro-image', 'gemini-3-flash'];
    const result = ensurePinnedImageSelector(pins);
    assertEqual(result.length, 2);
    assertEqual(result.includes(DEFAULT_IMAGE_PIN_SELECTOR), false);
});

test('resolveQuotaModels + ensurePinnedImageSelector: live pin gap resolves Gemini 3.1 Flash Image', () => {
    const livePins = [
        'gemini-3-pro-high',
        'gemini-3-flash',
        'claude-sonnet-4-5-thinking',
        'gemini-3.1-pro-high',
        'gemini-3.1-pro-low',
        'claude-sonnet-4-6',
    ];
    const apiModels = [
        { name: 'gemini-pro-agent', percentage: 80 },
        { name: 'gemini-3-flash-agent', percentage: 70 },
        { name: 'gemini-3.1-flash-image', percentage: 92, display_name: 'Gemini 3.1 Flash Image' },
        { name: 'claude-sonnet-4-6', percentage: 50 },
    ];
    const results = resolveQuotaModels(apiModels, ensurePinnedImageSelector(livePins));
    const image = results.find(r => r.selectionKey === 'category:gemini-image');
    assertEqual(image?.model?.name, 'gemini-3.1-flash-image');
    assertEqual(image?.model?.display_name, 'Gemini 3.1 Flash Image');
});

if (failed > 0) {
    throw new Error(`${failed} test(s) failed`);
}
