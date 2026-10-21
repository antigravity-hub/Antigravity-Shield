# -*- coding: utf-8 -*-
"""
Script to systematically translate Chinese comments in src/ and src-tauri/src/ into English,
and add professional repository headers.
"""
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

REPO_URL = "https://github.com/antigravity-hub/Antigravity-Shield"
HEADER_TS = f"/**\n * Antigravity Shield — AI Proxy & Fleet Management Engine\n * Repository: {REPO_URL}\n */\n"
HEADER_RS = f"// Antigravity Shield — AI Proxy & Fleet Management Engine\n// Repository: {REPO_URL}\n\n"

# Common translation mappings for Chinese phrases in comments
PHRASES = [
    # General architecture & async
    (r"异步安全的账号 JSON 更新函数", "Asynchronous safe account JSON updater function"),
    (r"读取文件失败", "Failed to read file"),
    (r"解析 JSON 失败", "Failed to parse JSON"),
    (r"序列化 JSON 失败", "Failed to serialize JSON"),
    (r"写入文件失败", "Failed to write file"),
    (r"健康分数", "Health score"),
    (r"配额刷新时间戳（用于排序优化）", "Quota refresh timestamp (used for sort optimization)"),
    (r"账号文件路径，用于更新", "Account file path, used for disk persistence"),
    (r"403 细分分类与安全隔离协议", "403 Classification and Quarantine Protocol"),
    (r"验证挑战 \(VALIDATION_REQUIRED\)：提取 URL，施加 10 分钟验证冷却与内存隔离，不写盘注销", "Validation challenge (VALIDATION_REQUIRED): extract URL, apply 10m cooldown quarantine, do not unregister on disk"),
    (r"确认的永久违规/封号：仅在有确切证据时落盘写入 is_forbidden", "Confirmed permanent ban: persist is_forbidden only with explicit evidence"),
    (r"瞬时 403 \(网络/WAF/边缘 IP 拦截\)：实行 5 分钟内存隔离区冷却，保持磁盘文件完好", "Transient 403 (network/WAF/edge blocking): apply 5m in-memory quarantine, preserve disk integrity"),
    (r"提取验证或申诉链接（如果存在）", "Extract verification or appeal URL (if present)"),
    (r"回退正则匹配", "Fallback regex matching"),
    (r"针对 403 Forbidden 错误文本进行三级细分判定", "Three-tier classification for 403 Forbidden error response"),
    (r"优先判定 VALIDATION_REQUIRED 挑战", "Check for VALIDATION_REQUIRED challenge first"),
    (r"10 分钟冷却", "10-minute cooldown"),
    (r"判定确切的永久封号/违规", "Check for confirmed permanent account suspension"),
    (r"其它所有 403 均视为可恢复瞬态错误，施加 5 分钟内存隔离", "All other 403 errors are treated as recoverable transients with 5-minute memory quarantine"),
    (r"5 分钟冷却", "5-minute cooldown"),
    (r"内存隔离记录", "In-memory quarantine record"),
    (r"隔离开始时间戳（秒）", "Quarantine start timestamp (seconds)"),
    (r"隔离解除时间戳（秒）", "Quarantine expiry timestamp (seconds)"),
    (r"限流跟踪器", "Rate limit tracker"),
    (r"内存安全隔离区", "In-memory security quarantine pool"),
    (r"调度配置", "Routing & scheduling configuration"),
    (r"会话与账号映射", "Session to account mapping"),
    (r"按账号分配的同步刷新锁", "Per-account synchronization lock"),
    (r"用于实现 Double-Checked Locking，防止并发请求导致单个账号短时间内多次调用 OAuth Refresh", "Implements Double-Checked Locking to prevent concurrent requests from triggering redundant OAuth refreshes"),
    (r"异步 SingleFlight 合并表", "Async SingleFlight inflight deduplication map"),
    (r"Key 为 account_id，Value 为结果观察者，确保并发请求共享同一个上游探测结果", "Key is account_id, value is observer channel; ensures concurrent requests share a single upstream probe"),
    (r"记录账号连续 invalid_grant 失败次数，防止单次偶发网络抖动误停用账号", "Tracks consecutive invalid_grant failures to prevent premature deactivation from transient glitches"),
    (r"支持优雅关闭时主动 abort 后台任务", "Supports graceful shutdown abort for background tasks"),
    (r"创建新的 TokenManager", "Creates a new TokenManager instance"),
    (r"初始化 inflight 表", "Initialize inflight deduplication table"),
    (r"安全解析指定账号的文件路径，防止路径遍历漏洞", "Safely resolve account file path to prevent directory traversal"),
    (r"获取配额保护是否启用（优先从内存缓存读取，TTL 为 10 秒，避免热路径频繁读盘）", "Check if quota protection is enabled (in-memory cached with 10s TTL)"),
    (r"刷新单个账号的 access_token 并同步更新内存与磁盘（带 Double-Checked Locking 防并发）", "Refresh account access_token and update memory/disk with Double-Checked Locking"),
    (r"提前 10 分钟平滑刷新", "Proactively refresh 10 minutes before expiry"),
    (r"双重检查：是否已被其他并发任务或后台刷新", "Double check: whether already refreshed by a concurrent task"),
    (r"磁盘写盘后台化", "Asynchronously persist to disk"),
    (r"主动扫描并刷新所有即将过期的 Token（提前 10 分钟），保证用户请求路径零阻塞", "Scan and refresh expiring tokens 10m in advance to ensure zero latency spikes"),
    (r"从磁盘读取账号列表", "Read account list from disk"),
    (r"保存账号列表到磁盘", "Save account list to disk"),
    (r"乐观更新 UI", "Optimistically update UI"),
    (r"乐观更新本地状态", "Optimistically update local state"),
    (r"尝试保存", "Attempt save"),
    (r"保存失败，回滚到原始快照", "Save failed, roll back to original snapshot"),
    (r"后端失败时回滚到原始顺序", "Roll back to previous order if backend persistence fails"),
    (r"联动逻辑：开启配额保护时，强制开启后台自动刷新 \(不仅仅是预热\)", "Coordinated logic: when quota protection is enabled, enforce background auto-refresh"),
    (r"验证自定义时间", "Validate custom expiration time"),
    (r"计算自定义过期时间戳", "Calculate custom expiration timestamp"),
    (r"使用双层包装: undefined = 不更新, null = 清空, string = 设置值", "Two-layer wrapper: undefined = keep, null = clear, string = set value"),
    (r"检查环境 \(可选\)", "Check runtime environment (optional)"),
    (r"Web 模式下 request 也是一个 function，所以这里不应抛错", "In web mode request is a function; handle gracefully"),
    (r"如果返回的是对象格式 \{ accounts: \[...\] \}, 则取其 accounts 属性", "If response is an object with { accounts: [...] }, extract accounts array"),
    (r"否则直接返回响应内容（假设为数组）", "Otherwise return response array directly"),
    (r"增强错误信息", "Enhanced error message"),
    (r"如果是 refresh_token 缺失错误,保持原样\(已包含详细说明\)", "Keep refresh_token missing error as-is (detailed instructions included)"),
    (r"其他错误添加上下文", "Add error context"),
    (r"重新排序账号列表", "Reorder account list"),
    (r"按新顺序排列的账号ID数组", "Array of account IDs in new order"),
    (r"设备指纹相关", "Device fingerprint operations"),
    (r"预热相关", "Smart warmup operations"),
    (r"导出账号相关", "Account export operations"),
    (r"自定义标签相关", "Custom label operations"),
    (r"新增 actions", "Additional actions"),
    (r"创建 ID 到账号的映射", "Create map of account ID to account object"),
    (r"按新顺序重建账号数组", "Reconstruct accounts array in new order"),
    (r"添加未在新顺序中的账号（保持原有顺序）", "Append any accounts not in new order (preserve original order)"),
    (r"Web 模式下不支持 Tauri 事件监听，跳过", "Tauri events not supported in web mode; skip"),
    (r"单个配额桶 \(weekly / 5h\)", "Single quota bucket (weekly / 5h)"),
    (r"模型组配额 \(如 Gemini Models / Claude and GPT models\)", "Model group quota (e.g. Gemini Models / Claude and GPT models)"),
    (r"Thinking Budget 配置 \(控制 AI 深度思考时的 Token 预算\)", "Thinking Budget config (controls token budget for deep thinking)"),
    (r"Thinking Budget 处理模式", "Thinking Budget processing mode"),
    (r"Thinking Effort 等级 \(仅 adaptive 模式\)", "Thinking Effort tier (adaptive mode only)"),
    (r"Thinking Budget 配置", "Thinking Budget configuration"),
    (r"模式选择", "Mode selection"),
    (r"自定义固定值（仅在 mode=custom 时生效），范围 1024-65536", "Custom fixed budget (mode=custom only), range 1024-65536"),
    (r"思考强度 \(仅在 mode=adaptive 时生效\)", "Thinking intensity (mode=adaptive only)"),
    (r"全局系统提示词配置", "Global system prompt configuration"),
    (r"是否启用", "Whether enabled"),
    (r"提示词内容", "System prompt content"),
    (r"Cloudflared \(CF隧道\) 类型定义", "Cloudflared tunnel type definitions"),
    (r"代理池类型定义", "Proxy pool type definitions"),
    (r"命令到 API 的映射", "Command to API route mapping"),
    (r"Tauri 环境：直接使用 invoke ...", "Tauri environment: invoke native IPC commands"),
    (r"Web 环境：映射到 HTTP API", "Web environment: map to local HTTP API endpoints"),
    (r"通用路径参数处理：替换 :key 为 args\[key\]", "Route parameter replacement: replace :key with args[key]"),
    (r"从 body 参数中移除已用于路径的参数", "Remove path parameters from request body"),
    (r"如果有多层包装，提取其内容作为 body", "Extract unwrapped payload for request body"),
    (r"增加防抖锁，避免重复事件导致 UI 抖动", "Debounce lock to prevent redundant UI state thrashing"),
    (r"如果是 204 No Content，直接返回 null", "Return null for 204 No Content response"),
    (r"拖拽手柄", "Drag handle"),
    (r"复选框", "Checkbox"),
    (r"订阅类型徽章", "Subscription tier badge"),
    (r"订阅类型", "Subscription tier"),
    (r"模型配额", "Model quotas"),
    (r"拖拽悬浮预览层", "Drag overlay preview"),
    (r"顶部工具栏: 搜索、过滤和操作按钮", "Top toolbar: search, filter, and action buttons"),
    (r"第一行: 搜索与过滤视图控制组", "Row 1: Search and filter view controls"),
    (r"搜索框", "Search input"),
    (r"自动排序开关与最后使用时间列显示开关", "Auto-sort and last-used column toggles"),
    (r"视图切换按钮组", "View mode switcher"),
    (r"账号列表内容区域", "Account list content area"),
    (r"排序逻辑", "Sort logic"),
    (r"移除冗余的顶层导入.*", "Cleaned redundant imports"),
]

def clean_file(path):
    with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
        content = fp.read()

    # Check if file has Chinese characters
    if not re.search(r'[\u4e00-\u9fff]', content):
        return False

    new_content = content
    # Apply phrase mappings
    for pattern, replacement in PHRASES:
        new_content = re.sub(pattern, replacement, new_content)

    # General replacements for any leftover line comments
    # Replace single line comments // ... with english translations if matched
    lines = new_content.split('\n')
    modified_lines = []
    for line in lines:
        if '//' in line and re.search(r'[\u4e00-\u9fff]', line):
            # Try to replace common Chinese characters in comment
            line = re.sub(r'//\s*【新增】', '// [NEW] ', line)
            line = re.sub(r'//\s*【修复】', '// [FIX] ', line)
            line = re.sub(r'//\s*【优化】', '// [OPTIMIZE] ', line)
            line = re.sub(r'//\s*配置', '// Config: ', line)
            line = re.sub(r'//\s*初始化', '// Initialize: ', line)
            line = re.sub(r'//\s*状态', '// State: ', line)
            line = re.sub(r'//\s*处理', '// Process: ', line)
            line = re.sub(r'//\s*返回', '// Return: ', line)
            line = re.sub(r'//\s*如果', '// If ', line)
            line = re.sub(r'//\s*更新', '// Update: ', line)
            line = re.sub(r'//\s*删除', '// Delete: ', line)
            line = re.sub(r'//\s*保存', '// Save: ', line)
            line = re.sub(r'//\s*获取', '// Get: ', line)
            line = re.sub(r'//\s*重置', '// Reset: ', line)
            line = re.sub(r'//\s*检查', '// Check: ', line)
        modified_lines.append(line)

    new_content = '\n'.join(modified_lines)

    if new_content != content:
        with open(path, 'w', encoding='utf-8') as fp:
            fp.write(new_content)
        return True
    return False

# Add repo headers to key files
KEY_FILES = [
    ('src/main.tsx', HEADER_TS),
    ('src/App.tsx', HEADER_TS),
    ('src-tauri/src/main.rs', HEADER_RS),
    ('src-tauri/src/lib.rs', HEADER_RS),
    ('src-tauri/src/proxy/server.rs', HEADER_RS),
    ('src-tauri/src/proxy/token_manager.rs', HEADER_RS),
    ('src-tauri/src/modules/token_stats.rs', HEADER_RS),
    ('src/pages/Accounts.tsx', HEADER_TS),
    ('src/pages/Dashboard.tsx', HEADER_TS),
    ('src/pages/TokenStats.tsx', HEADER_TS),
]

for p, header in KEY_FILES:
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8') as f:
            c = f.read()
        if REPO_URL not in c:
            with open(p, 'w', encoding='utf-8') as f:
                f.write(header + c)
            print(f'Added repo header to {p}')

# Clean Chinese comments in src/
cleaned_count = 0
for root, _, files in os.walk('src'):
    for f in files:
        if f.endswith(('.ts', '.tsx')):
            if clean_file(os.path.join(root, f)):
                cleaned_count += 1

print(f'Cleaned comments in {cleaned_count} files in src/')
