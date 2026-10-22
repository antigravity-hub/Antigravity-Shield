# -*- coding: utf-8 -*-
import json
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from scripts.i18n.engine import load_en, load_locale, sync_and_write

# Comprehensive translation patch for remaining untranslated keys in Simplified Chinese
ZH_REMAINING_PATCH = {
    "settings.general.nav_topbar": "经典顶部导航栏",
    "settings.advanced.need_cli_path": "需要先在上方设置或检测 CLI 路径",
    "settings.about.copyright": "版权所有 © 2025-2026 Antigravity。保留所有权利。",
    "settings.about.download_page": "下载页面",
    "settings.save_failed_reverted": "保存失败，已恢复原设置",
    "settings.web_mode_limitation": "（Web 模式下不支持）",
    "settings.30s_default": "30秒（默认）",
    
    # Proxy / Droid Sync / Opencode Sync
    "proxy.droid_sync.select_models": "选择要添加的模型",
    "proxy.droid_sync.no_models": "请在上方选择要添加的模型",
    "proxy.droid_sync.btn_confirm_sync": "写入配置文件",
    "proxy.droid_sync.toast.no_models_selected": "请至少选择一个模型",
    "proxy.droid_sync.custommodels_preview": "customModels 预览",
    "proxy.opencode_sync.sync_queue_preview": "同步队列预览",
    "proxy.opencode_sync.btn_view": "查看配置",
    "proxy.overview.test_connection": "测试实时探测",
    "proxy.overview.pool_status": "轮转引擎",
    "proxy.overview.view_quotas": "查看账号与配额",
    "proxy.overview.endpoints_title": "通用协议端点",
    "proxy.overview.start_the_proxy_service_to_ena": "启动代理服务以支持 Cursor、Claude Code 和 Windsurf 的下游连接。",
    "proxy.overview.active_accounts": "活跃账号",
    "proxy.overview.failover_latency": "故障转移延迟",
    "proxy.overview.protocol_support": "协议支持",
    "proxy.overview.plug_any_downstream_client_dir": "将任何下游客户端直接连接到这些本地端点。",
    "proxy.overview.settings_gt_models_gt_openai_a": "设置 > 模型 > OpenAI API Key",
    "proxy.fixed_account.disabled": "已禁用固定账号路由",
    "proxy.tabs.overview": "概览与状态",
    "proxy.tabs.accounts": "账号与配额",
    "proxy.tabs.diagnostics": "诊断面板",
    "proxy.tabs.settings": "设置与网络",
    "proxy.cli_sync.title": "CLI 客户端一键同步",
    "proxy.cli_sync.subtitle": "自动将代理地址与 API Key 配置同步到本地开发工具中。",
    "proxy.cli_sync.model_select": "选择目标模型",
    "proxy.cli_sync.btn_sync": "同步配置",
    "proxy.cli_sync.btn_restore": "恢复官方默认",
    "proxy.cli_sync.btn_restore_backup": "恢复备份",
    "proxy.cli_sync.restore_confirm": "确定将 {{name}} 的配置恢复为官方默认地址吗？",
    "proxy.cli_sync.restore_backup_confirm": "找到备份文件，是否恢复？",
    "proxy.cli_sync.sync_confirm_title": "确认同步",
    "proxy.cli_sync.sync_confirm_message": "准备配置 {{name}}。⚠️ 警告：这将覆盖现有本地配置文件。是否继续？",
    "proxy.cli_sync.toast.sync_success": "成功同步 {{name}} 配置",
    "proxy.cli_sync.toast.sync_error": "同步失败：{{error}}",
    "proxy.cli_sync.toast.restore_success": "成功恢复 {{name}} 官方配置",
    "proxy.cli_sync.toast.restore_error": "恢复失败：{{error}}",
    "proxy.cli_sync.toast.backup_restored": "成功从备份恢复 {{name}} 配置",
    "proxy.cli_sync.claude.tool_desc": "Anthropic 官方 CLI 工具",
    "proxy.cli_sync.opencode.tool_desc": "基于终端的多模型 AI 编程助手",
    "proxy.cli_sync.droid.tool_desc": "Factory Droid CLI 编程助手",
    "proxy.cli_sync.status.not_installed": "未安装",
    "proxy.cli_sync.status.configured": "已配置代理",
    "proxy.cli_sync.status.custom": "自定义配置",
    "proxy.cli_sync.status.official": "官方默认",
    "proxy.cli_sync.status.checking": "检测中...",
    "proxy.cli_sync.status.unknown": "未知状态",
    "proxy.cli_sync.status.active": "已激活",
    "proxy.cli_sync.status.backup_available": "有备份可用",
    "proxy.cli_sync.status.permission_denied": "权限不足",
    "proxy.cli_sync.badge.recommended": "推荐",
    "proxy.cli_sync.badge.legacy": "旧版",
    "proxy.cli_sync.help.header": "配置助手与指南",
    "proxy.cli_sync.help.body": "点击上方同步按钮即可自动修改各工具的配置文件。如需手动配置，请参考右侧端点地址。",
    "proxy.cli_sync.help.learn_more": "了解更多配置详情",
    
    # Notifications / Overlay
    "notifications.overlay.platform": "平台",
    "notifications.overlay.esc": "Esc",
    "notifications.quota_critical_alert": "配额严重告急预警: 账号 {{email}} 上的 {{target}}{{model}} 配额仅剩 {{percentage}}%。",
    "notifications.quota_alert_title": "Antigravity Shield - 低配额警告",
    "notifications.auto_switch_title": "Antigravity Shield - 账号自动切换",
    "notifications.quota_exhausted_title": "Antigravity Shield - 配额耗尽",
    "notifications.auto_switch_success": "⚡ 自动切换完成: {{target}}{{model}} 达到 {{percent}}%。已自动切换至 {{to}} (剩余 {{score}}% 配额)。",
    "notifications.auto_switch_claude_success": "⚡ 自动切换完成: 账号 {{from}} 的 {{target}}Claude 配额已耗尽。已切换至 {{to}} (剩余 {{score}}% Claude 配额)。",
    "notifications.auto_switch_fallback_gemini": "⚡ 自动切换完成: 降级回退切换至 {{to}} (剩余 {{score}}% Gemini 配额)。",
    "notifications.auto_switch_gemini_success": "⚡ 自动切换完成: 账号 {{from}} 的 {{target}}Gemini 配额已耗尽。已切换至 {{to}} (剩余 {{score}}% Gemini 配额)。",
    "notifications.all_quotas_depleted": "⚠️ 所有可用账号的配额已全部用尽。",
    "notifications.target_platform": "平台 (Harness)",
    "notifications.target_ide_and_platform": "IDE 与平台",
    "notifications.overlay_title": "Antigravity Shield - 智能切换",
    "notifications.overlay_quota_for": "以下配额已耗尽：",
    "notifications.overlay_switch_to": "切换至：",
    "notifications.overlay_quota_badge": "配额",
    "notifications.overlay_switch_now": "立即切换",
    "notifications.overlay_snooze": "稍后提醒 (5分钟)",
    "notifications.overlay_cancel": "取消",
    "notifications.overlay_dismiss": "关闭",
    "notifications.overlay_auto_dismiss": "将在几秒后自动关闭",
    "notifications.overlay_auto_dismiss_timer": "将在 {{seconds}} 秒后自动关闭",
    "notifications.overlay_from_account": "当前账号",
    "notifications.overlay_depleted_badge": "已耗尽",
    "notifications.overlay_waiting": "正在接收 Shield 遥测信号...",
    "notifications.overlay_default_model": "AI 模型",
    
    # RTL Card
    "rtl_card.antigravity_2_0_desktop": "Antigravity 2.0 桌面端：",
    "rtl_card.antigravity_ide_workbench": "Antigravity IDE 开发工作区：",

    # Dashboard & Accounts
    "dashboard.real_time_metrics": "实时性能指标",
    "dashboard.active_sessions": "活跃会话",
    "dashboard.requests_today": "今日请求数",
    "dashboard.token_velocity": "Token 消耗速率",
    "dashboard.fleet_health": "全局舰队健康度",
    "dashboard.quota_headroom": "配额安全裕度",
    "dashboard.switch_notice": "智能切换通知",
    "dashboard.quick_switch": "快速切换",
    "dashboard.model_breakdown": "模型消耗细分",
    "dashboard.cooldown_active": "冷却激活中",
    "dashboard.no_cooldown": "所有账号就绪",
    "dashboard.live_telemetry": "实时遥测",
    "dashboard.system_operational": "系统运行正常",
    "dashboard.verify_account_prompt": "请验证您的账号以继续使用。",
    "accounts.status.appeal_required": "需要申诉",
    "accounts.toast.proxy_enabled": "已为 {{count}} 个账号启用代理",
    "accounts.toast.proxy_disabled": "已为 {{count}} 个账号禁用代理",
    "accounts.add.token.batch_progress": "正在导入 {{current}}/{{total}} 个账号...",
    "accounts.add.token.batch_success": "成功导入 {{count}} 个账号",
    "accounts.add.token.batch_partial": "导入完成：{{success}} 个成功，{{fail}} 个失败",
    "accounts.add.oauth_error": "OAuth 认证失败：{{error}}",
    "accounts.dialog.batch_delete_msg": "确定要删除选中的 {{count}} 个账号吗？此操作无法撤销。",
    "accounts.dialog.batch_warmup_msg": "确定要为选中的 {{count}} 个账号立即启动预热吗？",
    "accounts.dialog.batch_warmup_confirm": "确定为选中的 {{count}} 个账号启动会话预热吗？",
    "accounts.device_fingerprint_dialog.title": "设备硬件指纹 (Device Fingerprint)",
    "accounts.device_fingerprint_dialog.operations": "设备指纹操作",
    "accounts.device_fingerprint_dialog.generate_and_bind": "生成并绑定到账号",
    
    # ApiKeyFun
    "apiKeyFun.title": "API Key 密钥库",
    "apiKeyFun.subtitle": "统一管理并同步本地反向代理的访问凭证",
    "apiKeyFun.add_key": "添加新密钥",
    "apiKeyFun.key_name": "密钥名称",
    "apiKeyFun.key_value": "密钥内容",
    "apiKeyFun.key_status": "密钥状态",
    "apiKeyFun.copy_key": "复制密钥",
    "apiKeyFun.delete_key": "删除密钥",
    "apiKeyFun.models.emptyFromKey": "尚未获取到模型列表。请发起查询以获取可用模型。",
    "apiKeyFun.syncSuccess": "已成功同步至 {{app}}",
    "apiKeyFun.syncError": "同步失败：{{error}}",
    
    # User Token
    "user_token.custom_expires_at": "自定义过期时间",
    "user_token.hint_custom_expires": "指定该 Token 的精确过期日期与时间",
    "user_token.reqs": "请求",
    "user_token.tokens": "Tokens",
    "user_token.created_at": "创建时间",
    "user_token.last_used_at": "最后使用",
    "user_token.status_active": "活跃",

    # Debug Console
    "debug_console.pause_scroll": "暂停滚动",
    "debug_console.resume_scroll": "继续滚动",
    "debug_console.clear": "清空日志",
    "debug_console.no_logs": "暂无系统日志",
    "debug_console.no_logs_hint": "系统运行时产生的调试日志将在此处实时显示。",
    "debug_console.scroll_to_bottom": "滚动到底部",
    "debug_console.toggle": "切换调试控制台",
    "debug_console.title": "调试控制台",
    "debug_console.filter_all": "全部日志",
    "debug_console.filter_error": "仅错误",
    "debug_console.filter_warn": "仅警告"
}

def apply_patch():
    with open('scripts/locales/zh_final_dict.json', 'r', encoding='utf-8') as f:
        zh_dict = json.load(f)
    zh_dict.update(ZH_REMAINING_PATCH)
    with open('scripts/locales/zh_final_dict.json', 'w', encoding='utf-8') as f:
        json.dump(zh_dict, f, ensure_ascii=False, indent=2)

    res = sync_and_write('zh', zh_dict)
    print("Simplified Chinese patched and synced.")
    return res

if __name__ == '__main__':
    apply_patch()
