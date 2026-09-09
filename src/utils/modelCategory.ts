/**
 * 模型分类工具函数（无 React / icons 依赖，可在 Node 环境直接导入）
 */

export type ModelCategory = 'gemini-pro' | 'gemini-flash' | 'gemini-pro-image' | 'gemini-flash-image' | 'claude' | 'other';

export function categorizeModel(name: string): ModelCategory {
    const n = name.trim().toLowerCase();
    const isGemini = n.startsWith('gemini-');
    const isImage = (isGemini && n.includes('image')) || n.startsWith('image') || n.startsWith('imagen');
    if (isImage) return n.includes('flash') ? 'gemini-flash-image' : 'gemini-pro-image';
    if (isGemini && n.includes('flash')) return 'gemini-flash';
    if (isGemini && n.includes('pro')) return 'gemini-pro';
    if (n.includes('claude') || n.includes('opus') || n.includes('sonnet') || n.includes('haiku')) return 'claude';
    return 'other';
}

export interface ModelDisplayNameInput {
    name: string;
    display_name?: string;
}

const DEFAULT_MODEL_LABELS: Record<string, string> = {
    'gemini-3.8-pro': 'Gemini 3.8 Pro',
    'gemini-3.8-pro-high': 'Gemini 3.8 Pro High',
    'gemini-3.8-flash': 'Gemini 3.8 Flash',
    'gemini-3.8-flash-tiered': 'Gemini 3.8 Flash',
    'gemini-3.8-flash-thinking': 'Gemini 3.8 Flash (Thinking)',
    'gemini-pro-agent': 'Gemini 3.1 Pro (High)',
    'gemini-3.1-pro-high': 'Gemini 3.1 Pro High',
    'gemini-3-pro-high': 'Gemini 3.1 Pro High',
    'gemini-3.1-pro': 'Gemini 3.1 Pro',
    'gemini-3.1-pro-low': 'Gemini 3.1 Pro Low',
    'gemini-3-pro-low': 'Gemini 3.1 Pro Low',
    'gemini-2.5-pro': 'Gemini 2.5 Pro',
    'gemini-3-flash-agent': 'Gemini 3 Flash (High)',
    'gemini-3.5-flash': 'Gemini 3.5 Flash',
    'gemini-3.1-flash': 'Gemini 3.1 Flash',
    'gemini-3-flash': 'Gemini 3 Flash',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-3.1-flash-image': 'Gemini 3.1 Flash Image',
    'gemini-3-pro-image': 'Gemini 3 Image',
    'claude-sonnet-4-6': 'Claude Sonnet 4.6 (Thinking)',
    'claude-opus-4-6-thinking': 'Claude Opus 4.6 (Thinking)',
    'claude-sonnet-4-5': 'Claude Sonnet 4.5 (Thinking)',
    'claude-haiku-4-5': 'Claude Haiku 4.5',
};

/**
 * 智能自动格式化模型显示名称：
 * 将未知或新发布的 Gemini/Claude 模型名称（如 gemini-3.8-pro）自动格式化为美观的标签（Gemini 3.8 Pro），无需手动录入。
 */
function autoFormatModelName(name: string): string {
    return name
        .split('-')
        .map(word => {
            if (word.toLowerCase() === 'gemini') return 'Gemini';
            if (word.toLowerCase() === 'claude') return 'Claude';
            if (word.toLowerCase() === 'pro') return 'Pro';
            if (word.toLowerCase() === 'flash') return 'Flash';
            if (word.toLowerCase() === 'thinking') return '(Thinking)';
            if (word.toLowerCase() === 'high') return 'High';
            if (word.toLowerCase() === 'low') return 'Low';
            if (word.toLowerCase() === 'image') return 'Image';
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
}

export function getModelDisplayName(
    model: ModelDisplayNameInput | null | undefined,
    fallback?: string,
): string {
    if (model) {
        if (model.display_name && model.display_name.trim()) return model.display_name.trim();
        if (model.name) {
            return DEFAULT_MODEL_LABELS[model.name] || autoFormatModelName(model.name);
        }
    }
    return fallback ?? '';
}

/**
 * 获取紧凑短名称（如 G3.1 Flash, G3.1 Pro, G3 Image, Claude 4.6），适合紧凑卡片/表格展示。
 */
export function getModelShortDisplayName(
    model: ModelDisplayNameInput | null | undefined,
    fallback?: string,
): string {
    const full = getModelDisplayName(model, fallback);
    if (!full) return fallback ?? '';
    return full
        .replace(/Gemini\s+/i, 'G')
        .replace(/\s*\(Thinking\)/i, '')
        .replace(/\s*\(High\)/i, '')
        .replace(/\s*\(Low\)/i, '')
        .trim();
}

/**
 * 提取模型版本号（如 gemini-3.7-flash -> 3.7, gemini-3-flash -> 3.0, gemini-pro-agent -> 3.1 等）
 */
function extractModelScore(name: string): number {
    const n = name.toLowerCase();

    // 预设或特定 agent 映射基准
    let baseVersion = 0;
    const match = n.match(/gemini-(\d+(?:\.\d+)?)/);
    if (match) {
        baseVersion = parseFloat(match[1]);
    } else if (n === 'gemini-pro-agent') {
        baseVersion = 3.1;
    } else if (n === 'gemini-flash-agent') {
        baseVersion = 3.0;
    } else if (n.includes('claude-sonnet-4-6') || n.includes('claude-opus-4-6')) {
        baseVersion = 4.6;
    } else if (n.includes('claude-sonnet-4-5') || n.includes('claude-haiku-4-5')) {
        baseVersion = 4.5;
    }

    // 质量/规格梯度加权 (High / Tiered > Medium > Normal > Agent > Low)
    let tierBonus = 0.05;
    if (n.includes('high') || n.includes('tiered')) {
        tierBonus = 0.08;
    } else if (n.includes('medium')) {
        tierBonus = 0.06;
    } else if (n.includes('agent')) {
        tierBonus = 0.05;
    } else if (n.includes('extra-low')) {
        tierBonus = 0.01;
    } else if (n.includes('low') || n.includes('lite')) {
        tierBonus = 0.02;
    }

    return baseVersion + tierBonus;
}

/**
 * 动态查找配额模型：按类别筛选候选模型，并自动选出版本最高、性能规格最强的旗舰模型。
 * 完全自适应 Google AI / Gemini API 发布的任意新版本模型（如 3.8, 3.9, 4.0 等）。
 */
export function findQuotaModel<T extends { name: string }>(
    models: T[] | undefined,
    category: ModelCategory,
): T | undefined {
    if (!models || models.length === 0) return undefined;

    // 筛选出属于该类别的所有模型
    const candidates = models.filter(m => categorizeModel(m.name) === category);
    if (candidates.length === 0) return undefined;

    // 按动态算力评分降序排序，始终选中最高版本
    return candidates.sort((a, b) => extractModelScore(b.name) - extractModelScore(a.name))[0];
}

export function getModelProtectionKey(name: string): string | null {
    switch (categorizeModel(name)) {
        case 'gemini-flash': return 'gemini-3-flash';
        case 'gemini-pro': return 'gemini-3-pro-high';
        case 'gemini-flash-image': return 'gemini-3.1-flash-image';
        case 'gemini-pro-image': return 'gemini-3-pro-image';
        case 'claude': return 'claude';
        default: return null;
    }
}

/**
 * 在任意图片类别中查找第一个实际模型。
 * 用于让新旧 image selector 共享同一配额槽位。
 */
export function findImageQuotaModel<T extends { name: string }>(
    models: T[] | undefined,
): T | undefined {
    if (!models || models.length === 0) return undefined;
    return models.find(m => {
        const c = categorizeModel(m.name);
        return c === 'gemini-flash-image' || c === 'gemini-pro-image';
    });
}

/** 账号管理 pin 列表缺省图像选择器时补入代表 Image，与仪表盘对齐。 */
export const DEFAULT_IMAGE_PIN_SELECTOR = 'gemini-3.1-flash-image';

export function ensurePinnedImageSelector(selectorIds: string[] | undefined): string[] {
    const pinned = selectorIds ? [...selectorIds] : [];
    const hasImage = pinned.some(id => {
        const category = categorizeModel(id);
        return category === 'gemini-flash-image' || category === 'gemini-pro-image';
    });
    if (hasImage) return pinned;
    pinned.push(DEFAULT_IMAGE_PIN_SELECTOR);
    return pinned;
}

export interface QuotaModelSelection<T> {
    selectorId: string;
    selectionKey: string;
    model: T | undefined;
}

export function resolveQuotaModels<T extends { name: string }>(
    models: T[] | undefined,
    selectorIds: string[],
): QuotaModelSelection<T>[] {
    const seen = new Set<string>();
    const results: QuotaModelSelection<T>[] = [];

    for (const selectorId of selectorIds) {
        const normalizedId = selectorId.trim().toLowerCase();
        const category = categorizeModel(normalizedId);

        const isImage = category === 'gemini-pro-image' || category === 'gemini-flash-image';

        // Exact-match first: a pinned id that names a real quota model must render
        // that model, not collapse into its category slot.
        const exact = !isImage
            ? models?.find(m => m.name.trim().toLowerCase() === normalizedId)
            : undefined;
        if (exact) {
            const selectionKey = `model:${normalizedId}`;
            if (seen.has(selectionKey)) continue;
            seen.add(selectionKey);
            results.push({ selectorId, selectionKey, model: exact });
            continue;
        }

        const selectionKey = isImage
            ? 'category:gemini-image'
            : category === 'other'
                ? `model:${normalizedId}`
                : `category:${category}`;

        if (seen.has(selectionKey)) continue;
        seen.add(selectionKey);

        const model = isImage
            ? findImageQuotaModel(models)
            : category === 'other'
                ? models?.find(m => m.name.trim().toLowerCase() === normalizedId)
                : findQuotaModel(models, category);

        results.push({ selectorId, selectionKey, model });
    }
    return results;
}
