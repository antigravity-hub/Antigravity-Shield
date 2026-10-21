import re

def replace_in_file(path, replacements):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    for old, new in replacements:
        content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

# AccountCard.tsx
replace_in_file('src/components/accounts/AccountCard.tsx', [
    ('// 使用统一的modelconfig', '// Use unified model configuration'),
    ('// Custom label编辑status', '// Custom label editing state'),
    ('// Note：DEFAULT_MODELS 现在应该包含 shortLabel，我们需要确保它被正确映射', '// Note: Ensure shortLabel is mapped properly'),
    ('// 但 DEFAULT_MODELS 是从 MODEL_CONFIG 生成的，我们需要确保它包含 shortLabel', '// DEFAULT_MODELS is derived from MODEL_CONFIG, ensure shortLabel is present'),
    ('// 这里为了安全，直接从 MODEL_CONFIG get', '// Extract directly from MODEL_CONFIG for type safety'),
    ('// 也保留nonequotadata的 pinned model（显示 0%）', '// Retain pinned models without quota data (display 0%)'),
    ('// 暂时退化：如果没有 config 就不阻拦了？不，没有 pinned 就显示内置+有 display_name 的。', '// Fallback: show built-in models and models with display_name if none pinned'),
    ('// 应用排序并过滤过期model', '// Apply sorting and filter out legacy models'),
    ('// 解析周quota项 (当处于 weekly 视图时)', '// Parse weekly quota items (in weekly view mode)'),
    ('// 解析 5H quota项 (当处于 5h 视图时)', '// Parse 5-hour quota items (in 5h view mode)'),
    ('// 5H 倒计时计算', '// 5-hour countdown calculation'),
    ('{/* quota展示 */}', '{/* Quota display */}'),
    ('{/* quotareset倒计时: 5H 模式展示 5h滚动reset，Weekly 模式展示周阶梯 */}', '{/* Quota reset countdown: 5H rolling reset or weekly reset ladder */}'),
    ('{/* 标签编辑弹出框 */}', '{/* Label editing popover dialog */}'),
])

# AccountRow.tsx
replace_in_file('src/components/accounts/AccountRow.tsx', [
    ('// [重构] Find quota model by priority', '// [Refactor] Find quota model by priority'),
    ('// 颜色映射，避免动态类名被 Tailwind purge', '// Color map to prevent dynamic class purging in Tailwind'),
    ('{/* 序号 */}', '{/* Index */}'),
    ('{/* 邮箱 */}', '{/* Email */}'),
    ('{/* 最后使用 */}', '{/* Last used */}'),
])

# AccountTable.tsx
replace_in_file('src/components/accounts/AccountTable.tsx', [
    ('/** 拖拽排序回调，当user完成拖拽时触发 */', '/** Drag-sort callback invoked when user finishes dragging */'),
    ('// 子组件', '// Subcomponents'),
    ('// Custom label编辑status', '// Custom label editing state'),
    ('// Get: 要显示的model列表', '// Get: List of models to display'),
    ('// 根据 show_all status决定显示哪些model', '// Filter models based on show_all flag'),
    ('// 从本地存储读取每页条数', '// Read items per page from local storage'),
    ('// 修复：当搜索或过滤导致当前页超出总页数时，自动重置到第一页', '// Auto-reset to first page if filter reduces page count below current page'),
    ('// 处理点击外部关闭', '// Handle click outside to close popovers'),
    ('// 获取要显示列的唯一标识', '// Get unique identifier for visible column'),
])

# AccountErrorDialog.tsx
replace_in_file('src/components/accounts/AccountErrorDialog.tsx', [
    ('// 按照优先级尝试提取消息', '// Extract message by priority'),
    ('// 不handle', '// Skip handling'),
    ('// 识别errortype', '// Identify error type'),
    ('// 复制功能', '// Clipboard copy handler'),
])

print('Successfully cleaned comments in accounts components.')
