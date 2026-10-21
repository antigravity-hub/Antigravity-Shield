import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

REPO_URL = "https://github.com/antigravity-hub/Antigravity-Shield"

HEADER_TS = f"/**\n * Antigravity Shield — AI Proxy & Fleet Management Engine\n * Repository: {REPO_URL}\n */\n"
HEADER_RS = f"// Antigravity Shield — AI Proxy & Fleet Management Engine\n// Repository: {REPO_URL}\n\n"

# Comprehensive dictionary of Chinese comments / expressions to English
TRANSLATIONS = [
    # Table & Account UI
    (r"账号表格组件", "Account Table Component"),
    (r"支持拖拽排序功能，用户可以通过拖拽行来调整账号顺序", "Supports drag-and-drop reordering of accounts"),
    (r"可拖拽的表格行组件", "Draggable table row component"),
    (r"账号行内容组件", "Account row content component"),
    (r"使用 @dnd-kit/sortable 实现拖拽功能", "Implements drag-and-drop using @dnd-kit/sortable"),
    (r"采用乐观更新策略：先更新本地状态再调用后端持久化，以提供流畅的拖拽体验", "Optimistic update strategy: update local state first then persist to backend for smooth UX"),
    (r"渲染邮箱、配额、最后使用时间和操作按钮等列", "Renders email, quota, last used timestamp, and action buttons"),
    (r"按优先级查找配额模型", "Find quota model by priority"),
    (r"获取要显示的模型列表", "Get list of models to display"),
    (r"配置拖拽传感器", "Configure drag sensor"),
    (r"拖拽传感器", "Drag sensor"),
    (r"拖拽结束处理", "Handle drag end"),
    (r"拖拽悬浮预览层", "Drag overlay preview layer"),
    (r"复选框", "Checkbox"),
    (r"拖拽手柄", "Drag handle"),
    (r"邮箱与状态", "Email and status"),
    (r"最后使用时间", "Last used time"),
    (r"订阅类型徽章", "Subscription tier badge"),
    (r"订阅类型", "Subscription tier"),
    (r"自定义标签", "Custom label"),
    (r"操作按钮", "Action buttons"),
    (r"刷新按钮", "Refresh button"),
    (r"切换按钮", "Switch button"),
    (r"删除按钮", "Delete button"),
    (r"查看详情", "View details"),
    (r"复制邮箱", "Copy email"),
    (r"快捷操作", "Quick actions"),
    (r"模型配额", "Model quota"),
    (r"未设置", "Not set"),
    (r"无数据", "No data"),
    (r"正在刷新", "Refreshing"),
    (r"正在切换", "Switching"),

    # Lifecycle & System
    (r"监听托盘切换账号事件", "Listen for tray account switch events"),
    (r"启动时显式调用 Rust 命令显示窗口", "Explicitly invoke Rust command to display window on launch"),
    (r"避免白屏闪烁", "Prevent white flash on startup"),
    (r"深度解析解析错误消息", "Deep parsing of error message"),
    (r"自动复制到剪贴板\? 可选，这里只设置状态让用户手动复制", "Optional auto-copy to clipboard; here we set state for manual copy"),
    (r"针对 Docker/Web 模式的强制鉴权保护层", "Mandatory authentication protection layer for Docker/Web modes"),
    (r"新增: 是否允许自定义输入", "Whether custom input is allowed"),
    (r"新增:分页大小变更", "Page size change handler"),
    (r"全局窗口拖拽区域 - 使用 JS 手动触发拖拽，解决 HTML 属性失效问题", "Global window drag region - uses JS drag trigger to prevent HTML attribute dropping"),
    (r"7 种 UI 奢华主题高亮色选择器", "7 UI luxury accent theme color selector"),
    (r"类型定义", "Type definitions"),
    (r"工具函数", "Utility functions"),
    (r"辅助函数", "Helper functions"),
    (r"常量定义", "Constants"),
    (r"状态管理", "State management"),

    # Commands & Backend
    (r"获取当前代理状态", "Get current proxy status"),
    (r"启动代理服务", "Start proxy service"),
    (r"停止代理服务", "Stop proxy service"),
    (r"重启代理服务", "Restart proxy service"),
    (r"更新代理配置", "Update proxy configuration"),
    (r"获取账号列表", "Get account list"),
    (r"添加账号", "Add account"),
    (r"删除账号", "Delete account"),
    (r"更新账号", "Update account"),
    (r"切换账号", "Switch account"),
    (r"刷新配额", "Refresh quota"),
    (r"刷新全部配额", "Refresh all quotas"),
    (r"验证账号", "Verify account"),
    (r"导出账号", "Export accounts"),
    (r"导入账号", "Import accounts"),
    (r"获取系统配置", "Get system configuration"),
    (r"保存系统配置", "Save system configuration"),
    (r"重置系统配置", "Reset system configuration"),
    (r"清理缓存", "Clear cache"),
    (r"获取调用日志", "Get call logs"),
    (r"清空调用日志", "Clear call logs"),
    (r"获取速率限制", "Get rate limits"),
    (r"重置速率限制", "Reset rate limits"),
    (r"生成 API 密钥", "Generate API key"),
    (r"验证 API 密钥", "Validate API key"),
    (r"检查更新", "Check for updates"),
    (r"下载更新", "Download update"),
    (r"安装更新", "Install update"),
    (r"获取设备指纹", "Get device fingerprint"),
    (r"刷新设备指纹", "Refresh device fingerprint"),

    # Security & IP
    (r"IP 黑名单管理", "IP Blacklist Management"),
    (r"IP 白名单管理", "IP Whitelist Management"),
    (r"添加 IP 到黑名单", "Add IP to blacklist"),
    (r"从黑名单移除 IP", "Remove IP from blacklist"),
    (r"添加 IP 到白名单", "Add IP to whitelist"),
    (r"从白名单移除 IP", "Remove IP from whitelist"),
    (r"检查 IP 是否允许访问", "Check if IP is allowed access"),
    (r"记录安全事件", "Record security event"),
    (r"查询安全日志", "Query security logs"),

    # Proxy & Mapping
    (r"模型映射逻辑", "Model mapping logic"),
    (r"处理 OpenAI 请求", "Handle OpenAI request"),
    (r"处理 Anthropic 请求", "Handle Anthropic request"),
    (r"处理 Gemini 请求", "Handle Gemini request"),
    (r"流式响应处理", "Streaming response handling"),
    (r"非流式响应处理", "Non-streaming response handling"),
    (r"错误重试机制", "Error retry mechanism"),
    (r"负载均衡策略", "Load balancing strategy"),
    (r"会话保持机制", "Session affinity mechanism"),
    (r"上游客户端连接池", "Upstream client connection pool"),
    (r"注入认证头", "Inject authorization header"),
    (r"解析请求体", "Parse request body"),
    (r"格式化响应体", "Format response body"),
    (r"转换模型名称", "Translate model name"),
    (r"计算 Token 消耗", "Calculate token consumption"),
    (r"记录 Token 统计", "Record token statistics"),

    # Common comment verbs & phrases
    (r"// 初始化", "// Initialize"),
    (r"// 配置", "// Configure"),
    (r"// 处理", "// Handle"),
    (r"// 检查", "// Check"),
    (r"// 验证", "// Verify"),
    (r"// 获取", "// Get"),
    (r"// 设置", "// Set"),
    (r"// 更新", "// Update"),
    (r"// 保存", "// Save"),
    (r"// 删除", "// Delete"),
    (r"// 重置", "// Reset"),
    (r"// 转换", "// Transform"),
    (r"// 过滤", "// Filter"),
    (r"// 排序", "// Sort"),
    (r"// 返回", "// Return"),
    (r"// 如果", "// If"),
    (r"// 否则", "// Otherwise"),
    (r"// 注意", "// Note"),
    (r"// 警告", "// Warning"),
    (r"// 兼容", "// Compatibility"),
    (r"// 优化", "// Optimize"),
    (r"// 临时", "// Temporary"),
    (r"// 修复", "// Fix"),
    (r"// 成功", "// Success"),
    (r"// 失败", "// Failure"),
    (r"// 默认值", "// Default value"),
    (r"// 兜底", "// Fallback"),
    (r"// 降级", "// Fallback degradation"),
    (r"// 占位", "// Placeholder"),
    (r"// 标记", "// Flag"),
    (r"// 同步", "// Synchronize"),
    (r"// 异步", "// Asynchronous"),
]

# Patterns for generic Chinese cleanup in comments
GENERIC_PATTERNS = [
    (r"//\s*(\S.*?)$", None), # handled in line replacement
]

CHINESE_CHAR_RE = re.compile(r'[\u4e00-\u9fa5]')

def clean_file(filepath):
    ext = os.path.splitext(filepath)[1]
    is_rs = ext == '.rs'
    is_ts = ext in ('.ts', '.tsx')
    if not (is_rs or is_ts):
        return 0

    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()

    modified = False
    new_lines = []
    
    # Check if header already present
    header_present = False
    for line in lines[:10]:
        if "github.com/antigravity-hub/Antigravity-Shield" in line:
            header_present = True
            break
            
    if not header_present:
        if is_rs:
            new_lines.append(HEADER_RS)
            modified = True
        elif is_ts:
            new_lines.append(HEADER_TS)
            modified = True

    for line in lines:
        new_line = line
        if CHINESE_CHAR_RE.search(new_line):
            # Apply specific phrase translations
            for pat, rep in TRANSLATIONS:
                new_line = re.sub(pat, rep, new_line)
            
            # If still contains Chinese in comment, do systematic translation of common comment structures
            if CHINESE_CHAR_RE.search(new_line):
                # Common comment replacements
                substitutions = [
                    ("（用于排序优化）", " (used for sort optimization)"),
                    ("（可选）", " (optional)"),
                    ("（默认）", " (default)"),
                    ("（推荐）", " (recommended)"),
                    ("账号", "account"),
                    ("配额", "quota"),
                    ("模型", "model"),
                    ("用户", "user"),
                    ("配置", "config"),
                    ("服务", "service"),
                    ("状态", "status"),
                    ("类型", "type"),
                    ("数据", "data"),
                    ("请求", "request"),
                    ("响应", "response"),
                    ("成功", "success"),
                    ("失败", "failed"),
                    ("重试", "retry"),
                    ("重置", "reset"),
                    ("更新", "update"),
                    ("保存", "save"),
                    ("获取", "get"),
                    ("设置", "set"),
                    ("删除", "delete"),
                    ("添加", "add"),
                    ("检查", "check"),
                    ("验证", "validate"),
                    ("处理", "handle"),
                    ("初始化", "init"),
                    ("默认", "default"),
                    ("如果是", "if is"),
                    ("否则", "otherwise"),
                    ("注意", "note"),
                    ("警告", "warning"),
                    ("提示", "hint"),
                    ("信息", "info"),
                    ("错误", "error"),
                    ("异常", "exception"),
                    ("返回", "return"),
                    ("无", "none"),
                    ("空", "empty"),
                    ("全部", "all"),
                    ("当前", "current"),
                    ("活跃", "active"),
                    ("禁用", "disabled"),
                    ("启用", "enabled"),
                    ("锁定", "locked"),
                    ("解锁", "unlocked"),
                    ("秒", "s"),
                    ("毫秒", "ms"),
                    ("分钟", "min"),
                    ("小时", "h"),
                    ("天", "d"),
                ]
                for zh_w, en_w in substitutions:
                    if zh_w in new_line:
                        new_line = new_line.replace(zh_w, en_w)

        if new_line != line:
            modified = True
        new_lines.append(new_line)

    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        return 1
    return 0

total_updated = 0
for target in ['src', 'src-tauri/src']:
    for root, dirs, files in os.walk(target):
        if 'locales' in root:
            continue
        for f in files:
            p = os.path.join(root, f)
            total_updated += clean_file(p)

print(f"Completed! Cleaned comments and added official repo header in {total_updated} files.")
