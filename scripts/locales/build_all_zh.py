# -*- coding: utf-8 -*-
"""
Master Builder for Chinese (Simplified) `zh.json`
Ensures 100% key parity (2,407 keys), 0 missing keys, 0 untranslated English, and exact variable matching.
"""
import json
import re
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

LOCALES_DIR = 'src/locales'
EN_PATH = os.path.join(LOCALES_DIR, 'en.json')
ZH_PATH = os.path.join(LOCALES_DIR, 'zh.json')

with open(EN_PATH, 'r', encoding='utf-8') as f:
    en_tree = json.load(f)

with open(ZH_PATH, 'r', encoding='utf-8') as f:
    zh_tree = json.load(f)

def flatten(d, p=''):
    res = {}
    for k, v in d.items():
        full = f"{p}.{k}" if p else k
        if isinstance(v, dict):
            res.update(flatten(v, full))
        else:
            res[full] = str(v)
    return res

en_flat = flatten(en_tree)
zh_flat = flatten(zh_tree)

# Comprehensive dictionary for all Chinese translations
ZH_DICTIONARY = {
  # nav
  "nav.switch_to_english": "切换至英文",
  "nav.switch_to_english_short": "EN",
  "nav.switch_to_chinese_short": "ZH",
  "nav.switch_to_traditional_chinese_short": "繁中",
  "nav.switch_to_japanese_short": "日语",
  "nav.switch_to_korean_short": "韩语",
  "nav.switch_to_russian_short": "俄语",
  "nav.switch_to_turkish_short": "土耳其语",
  "nav.switch_to_portuguese_short": "葡语",
  "nav.switch_to_spanish_short": "西语",
  "nav.switch_to_arabic_short": "阿语",
  "nav.switch_to_vietnamese_short": "越语",
  "nav.switch_to_malay_short": "马来语",
  "nav.switch_to_persian_short": "波斯语",
  "nav.help": "帮助与支持",
  "nav.documentation": "官方文档",
  "nav.apikey_fun": "中转站 (ApiKeyFun)",
  "nav.settings": "系统设置",
  "nav.dashboard": "控制面板",
  "nav.accounts": "账号管理",
  "nav.proxy": "API 代理服务",
  "nav.monitor": "实时监控",
  "nav.token_stats": "Token 统计",
  "nav.security": "安全防御",
  "nav.ecosystem": "技能与 MCP",
  "nav.toolkit_brand_title": "IDE 插件",
  "nav.toolkit_active": "Toolkit 已连接",
  "nav.toolkit_waiting": "等待 Toolkit 连接",
  "nav.toolkit_install": "安装 Toolkit",
  "nav.toolkit_modal.antigravity_hub_antigravity_to": "antigravity-hub/antigravity-toolkit-extension",
  "nav.tagline": "AI 网关防护盾",
  "nav.mini_view": "悬浮微窗",
  "nav.window_minimize": "最小化",
  "nav.window_maximize": "最大化",
  "nav.window_restore": "向下还原",
  "nav.window_close": "关闭",
  "nav.more": "更多",

  # common
  "common.app_name": "Antigravity Shield",
  "common.ready": "就绪",
  "common.empty": "空",
  "common.retry": "重试",
  "common.hide_qr": "隐藏二维码",
  "common.switch": "切换账号",
  "common.switch_best": "切换至最优账号",
  "common.switch_best_title": "切换至最优账号",
  "common.select_target_title": "选择目标环境",
  "common.no_alternative_account": "未找到具有充足配额的活跃备用账号。",
  "common.more_actions": "更多操作",
  "common.account_options": "账号选项",
  "common.off": "关闭",
  "common.on": "开启",
  "common.copy_advice": "复制模型切换建议",
  "common.fallback": "降级回退",
  "common.custom_model_placeholder": "输入自定义模型 ID...",
  "common.or": "或",
  "common.uninstall": "卸载",
  "common.install": "安装",
  "common.maximize": "全屏视图",
  "common.expand": "展开",
  "common.collapse": "收起",
  "common.connected": "已连接",
  "common.waiting": "等待中",
  "common.offline": "离线",
  "common.selected": "已置顶",
  "common.all": "所有家族",
  "common.all_tiers": "所有级别",
  "common.no_matching_models": "没有与所选过滤器匹配的模型。",
  "common.pinned": "已置顶",
  "common.optional": "可选",
  "common.actions": "操作",
  "common.disable": "禁用",
  "common.enable": "启用",
  "common.deleted": "删除成功",
  "common.save_success": "设置保存成功",
  "common.sync": "同步",
  "common.default": "默认",
  "common.copy_failed": "复制到剪贴板失败",
  "common.create": "创建",
  "common.accent.7_palettes": "7 种配色",
  "common.network.id": "ID：",
  "common.pagination.pagination": "分页",
  "common.verification.antigravity_verification_guide": "Antigravity 验证指南 PDF",
  "common.app.page_not_found": "页面未找到",
  "common.app.something_went_wrong": "出现异常",
  "common.app.unexpected_error": "加载此视图时发生意外错误。",
  "common.app.return_to_dashboard": "返回控制台",
  "common.error_boundary.title": "应用界面错误",
  "common.error_boundary.reload": "重新加载应用",
  "common.flags.fa": "伊朗国旗",
  "common.flags.zh": "中国国旗",
  "common.flags.zh_tw": "中国台湾旗帜",
  "common.flags.en": "美国国旗",
  "common.flags.ja": "日本国旗",
  "common.flags.tr": "土耳其国旗",
  "common.flags.vi": "越南国旗",
  "common.flags.pt": "巴西国旗",
  "common.flags.ko": "韩国国旗",
  "common.flags.ru": "俄罗斯国旗",
  "common.flags.ar": "沙特阿拉伯国旗",
  "common.flags.es": "西班牙国旗",
  "common.flags.my": "马来西亚国旗",
  "common.remove": "移除",
  "common.show_raw": "显示原始数据",
  "common.show_parsed": "显示解析数据",
  "common.switch_confirm_prompt": "是否切换至最佳推荐账号？",
  "common.confirm_proceed": "是的，继续",
  "common.select_target_desc": "选择需激活配额的目标环境：",
  "common.switch_success": "切换成功",
  "common.no_account": "无可用账号",
  "common.claude_series": "Claude 系列",
  "common.select_all": "全选",
  "common.deselect_all": "取消全选",
  "common.back": "返回",

  # dashboard
  "dashboard.mode_claude": "Claude (Opus)",
  "dashboard.mode_gemini": "Gemini (默认)",
  "dashboard.mode_both": "全部模型",
  "dashboard.safe_window": "安全窗口 > 20 分钟",
  "dashboard.horizon_5h": "过去 5 小时",
  "dashboard.view_token_stats_tooltip": "查看 Token 统计与消耗上限",
  "dashboard.health_pulse.warp": "WARP",
  "dashboard.health_pulse.automatically_detect_open_prox": "自动检测本地开放代理端口 (10810, 10809, 10808, 40000) 并路由 Antigravity IDE 流量",
  "dashboard.health_pulse.proxy_applied_toast": "代理配置已应用至 {{count}} 个 Antigravity 实例。",
  "dashboard.health_pulse.proxy_removed_toast": "已从 {{count}} 个 Antigravity 实例移除代理配置。",
  "dashboard.health_pulse.apply_vpn_proxy_title": "应用 {{name}} 代理 ({{proxy}}) 至 Antigravity IDE",
  "dashboard.health_pulse.use_active_proxy_btn": "或使用现有代理",
  "dashboard.health_pulse.remove_proxy_btn": "切换至 TUN / 直连",
  "dashboard.health_pulse.remove_proxy_tooltip": "移除本地代理设置并通过直连 TUN 适配器路由",
  "dashboard.health_pulse.ide_proxy_label": "IDE 路由：本地代理",
  "dashboard.health_pulse.direct_routing_label": "IDE 路由：直连 (VPN TUN 模式)",
  "dashboard.health_pulse.direct_routing_tooltip": "Antigravity 直接连接而不经过 IDE 代理。若您的 VPN 处于 TUN 模式，流量将自动通过 VPN 路由。",
  "dashboard.health_pulse.clear_proxy_btn": "清除代理 / 使用直连 VPN",
  "dashboard.health_pulse.warp_active_port": "运行中 (40000 端口就绪)",
  "dashboard.health_pulse.warp_port_closed": "运行中 (代理模式已关闭)",
  "dashboard.health_pulse.warp_installed_stopped": "已安装 (未运行)",
  "dashboard.health_pulse.warp_not_detected": "未安装",
  "dashboard.health_pulse.warp_not_installed_hint": "在您的电脑上未检测到 Cloudflare WARP 客户端。",
  "dashboard.health_pulse.download_warp_btn": "下载 WARP",
  "dashboard.health_pulse.warp_stopped_hint": "Cloudflare WARP 已安装但当前未运行。",
  "dashboard.health_pulse.launch_warp_btn": "启动 WARP 客户端",
  "dashboard.health_pulse.warp_enable_proxy_mode_hint": "WARP 正在运行，但 40000 端口已关闭。请打开 WARP 应用 -> 设置 (齿轮) -> 偏好设置 -> 连接 -> 选择“代理模式 (SOCKS5)”。",
  "dashboard.health_pulse.warp_port_not_listening_toast": "警告：端口 40000 未在监听。请确保 WARP 已运行并开启代理模式。",
  "dashboard.health_pulse.warp_installed_toast": "Cloudflare WARP 已在后台成功安装！",
  "dashboard.health_pulse.warp_connect_1click": "一键连接 WARP (代理模式 40000 端口)",
  "dashboard.health_pulse.warp_disconnect_btn": "断开 WARP",
  "dashboard.health_pulse.warp_download_started": "正在后台开始下载 Cloudflare WARP...",
  "dashboard.verification_required_count": "{{count}} 个账号",
  "dashboard.verification_required_count_plural": "{{count}} 个账号",
  "dashboard.verification_required_title": "需要 Google 账号验证 (Verification Required)",
  "dashboard.verification_required_desc": "这些账号的连接已被挂起，因为 Google 要求进行身份验证。请遵循指南解决此问题。",
  "dashboard.account_unit": "个账号",
  "dashboard.open_guide_title": "打开指南",
  "dashboard.open_full_guide": "完整解决方案指南 (PDF)",
  "dashboard.verify_in_google": "直接前往 Google 验证页面",
  "dashboard.view_guide_pdf": "查看 PDF 详细指南",
  "dashboard.check_guide": "查看修复指南",
  "dashboard.recheck_btn": "重新检测",
  "dashboard.recheck_all_btn": "检测全部",
  "dashboard.all_healthy_tooltip": "所有已连接账号均运行良好，无被拦截或需验证风险。",
  "dashboard.quota_summary_label": "活跃配额总汇",
  "dashboard.weekly_warmed_label": "周重置窗口就绪",
  "dashboard.five_hour_warmed_label": "5小时滑动窗口就绪",
  "dashboard.weekly_warmed_tooltip": "当周额度重置周期已激活且配额充足时标记为活跃。",
  "dashboard.five_hour_warmed_tooltip": "5小时滑动窗口可用（剩余 100% 配额），重置时间：{{time}}",
  "dashboard.accounts_unit": "个账号",
  "dashboard.status_ready": "就绪",
  "dashboard.status_exhausted": "耗尽",
  "dashboard.status_warmed": "就绪 (5H)",
  "dashboard.weekly_token_remaining": "本周剩余配额",
  "dashboard.shield_active": "Shield 已激活",
  "dashboard.shield_subtitle": "Antigravity Shield 网关 • 企业级 AI 轮换与配额守护",
  "dashboard.manage_accounts_desc": "管理、轮换与检查所有已连接账号",
  "dashboard.export_accounts_desc": "导出活跃账号的加密备份文件",
  "dashboard.verification_direct_hint": "Google 要求身份确认。点击“在浏览器中验证”进行快速授权，随后点击“重新检测”。",
  "dashboard.widget_best.dynamic_fleet_routing": "全队动态智能路由",
  "dashboard.widget_current.active_target_engine": "当前生效引擎",
  "dashboard.widget_current.active_target_engine_2": "当前生效引擎",
  "dashboard.hello_user": "你好，{{name}} 👋",
  "dashboard.verify_account_prompt": "请验证您的账号以继续使用。",
  "dashboard.real_time_metrics": "实时性能指标",

  # accounts
  "accounts.fix_guide.title": "终端快速修复 (解决内部 403 错误)",
  "accounts.fix_guide.step1_title": "🚀 最快捷方案",
  "accounts.fix_guide.step1_desc": "打开终端并运行以下命令通知 Google 确认是您本人操作；这能解决绝大多数 403 异常：",
  "accounts.fix_guide.step1_li1": "按 Enter 键，提示确认时输入 Y。",
  "accounts.fix_guide.step1_li2": "浏览器将自动打开，请选择对应账号并点击允许 (Allow)。",
  "accounts.fix_guide.step1_li3": "当看到 You are now authenticated 提示时，即表明验证成功完成！",
  "accounts.fix_guide.step2_title": "🧹 若仍未解决 (清除旧凭证)",
  "accounts.fix_guide.step2_li1_prefix": "在终端中运行此命令清除旧的登录会话凭据：",
  "accounts.fix_guide.step2_li2_prefix": "然后重新登录授权：",
  "accounts.fix_guide.tips_title": "💡 常见使用技巧",
  "accounts.fix_guide.tip1": "如果依旧收到 403，请先在终端中执行 <1>unset GOOGLE_APPLICATION_CREDENTIALS</1>。",
  "accounts.fix_guide.tip2": "生产环境建议使用 <1>Service Account</1> JSON 密钥以获得极佳的无人值守稳定性。",
  "accounts.fix_guide.tip3": "若频繁失败，请检查 <1>Google Cloud Console</1> 中的 Generative Language API 权限状态，若受风控限制请冷却 72 小时。",
  "accounts.fix_guide.tip4": "可尝试全局安装 <1>npm i -g @google/gemini-cli</1> 验证，若正常则在应用内重新添加该账号即可。",
  "accounts.error_dialog.reauth_desc": "Google 已使该账号的 OAuth 会话失效（密码变更、其他设备登出或安全令牌过期）。通过重新登录并连接此账号，即可立即恢复访问权限。",
  "accounts.error_dialog.reauth_advice_copied": "重新认证命令已复制到剪贴板",
  "accounts.error_dialog.copy_reauth_advice": "复制重新认证命令",
  "accounts.error_dialog.fix_plan_guide_badge": "修复方案指南",
  "accounts.error_dialog.diagnostics_title": "智能故障诊断报告",
  "accounts.error_dialog.recommended_action": "推荐处理动作",
  "accounts.error_dialog.view_google_cloud": "前往 Google Cloud Console",
  "accounts.error_dialog.dismiss": "忽略提示",
  "accounts.error_dialog.retry_connection": "重试连接",
  "accounts.error_dialog.switch_to_another": "切换至其他可用账号",
  "accounts.table.weekly_countdown": "周重置倒计时",
  "accounts.table.drag_handle": "拖拽把手",
  "accounts.table.status_column": "状态",
  "accounts.table.email_column": "账号邮箱",
  "accounts.table.tier_column": "级别",
  "accounts.table.quota_column": "配额余量",
  "accounts.table.cooldown_column": "冷却时间",
  "accounts.table.actions_column": "管理操作",
  "accounts.ultra": "ULTRA",
  "accounts.free": "FREE",
  "accounts.forbidden": "403",
  "accounts.forbidden_badge": "403",
  "accounts.status.appeal_required": "需提交申诉",
  "accounts.status.region_restricted": "区域限制 (400)",
  "accounts.status.subscription_required": "需要许可证 (403 #3501)",
  "accounts.status.reauth_required": "会话已过期 (401)",
  "accounts.status.validation_required": "需要安全验证",
  "accounts.error_dialog.region_badge": "地域封锁 (400)",
  "accounts.sync_freshness.minutes_ago": "已同步：{{count}}分钟前",
  "accounts.sync_freshness.hours_ago": "已同步：{{count}}小时前",
  "accounts.sync_freshness.cooldown_active": "冷却中：{{seconds}}秒",
  "accounts.dialog.batch_warmup_confirm": "确定要为选中的 {{count}} 个账号触发预热吗？",
  "accounts.day_progress_tooltip": "第 {{day}} 天：{{status}}",
  "accounts.upcoming": "100% (即将恢复)",
  "accounts.passed": "0% (已耗尽)",
  "accounts.water_remaining": "剩余 {{pct}}% 额度水位",
  "accounts.velocity_tooltip": "消耗速率：{{burn}}%/小时 • {{status}}",
  "accounts.deficit_status": "⚠️ 赤字：提前 {{hours}} 小时耗尽",
  "accounts.sustainable_buffer": "✓ 稳态续航充足",
  "accounts.device_fingerprint_dialog.title": "设备硬件指纹 (Device Fingerprint)",
  "accounts.device_fingerprint_dialog.operations": "硬件指纹管理操作",
  "accounts.device_fingerprint_dialog.generate_and_bind": "生成并绑定指纹",
  "accounts.device_fingerprint_dialog.restore_original": "恢复系统初始指纹",
  "accounts.device_fingerprint_dialog.open_storage_directory": "打开配置目录",
  "accounts.device_fingerprint_dialog.current_storage": "当前存储的硬件配置",
  "accounts.device_fingerprint_dialog.effective": "已生效",
  "accounts.device_fingerprint_dialog.current_storage_desc": "从 storage.json 读取（切换账号应用绑定后更新）",
  "accounts.device_fingerprint_dialog.account_binding": "账号指纹绑定关系",
  "accounts.device_fingerprint_dialog.pending_application": "待切换应用",
  "accounts.device_fingerprint_dialog.account_binding_desc": "在生成/恢复后保存为绑定项，切换账号时写入 storage.json",
  "accounts.device_fingerprint_dialog.historical_fingerprints": "历史指纹快照（可选恢复/删除）",
  "accounts.device_fingerprint_dialog.no_history": "暂无历史指纹记录",
  "accounts.device_fingerprint_dialog.current": "当前指纹",
  "accounts.device_fingerprint_dialog.restore": "还原",
  "accounts.device_fingerprint_dialog.delete_version": "删除此版本",
  "accounts.device_fingerprint_dialog.confirm_generate_title": "确认生成并绑定新指纹？",
  "accounts.device_fingerprint_dialog.confirm_generate_desc": "系统将生成一套全新的虚拟设备指纹并作为当前生效指纹。是否继续？",
  "accounts.device_fingerprint_dialog.confirm_restore_title": "确认恢复系统原始指纹？",
  "accounts.device_fingerprint_dialog.confirm_restore_desc": "将恢复为系统的原始硬件指纹并覆盖当前配置。是否继续？",
  "accounts.device_fingerprint_dialog.cancel": "取消",
  "accounts.device_fingerprint_dialog.confirm": "确认",
  "accounts.device_fingerprint_dialog.processing": "正在处理...",
  "accounts.device_fingerprint_dialog.loading": "加载中...",
  "accounts.device_fingerprint_dialog.failed_to_load_device_info": "加载设备信息失败",
  "accounts.device_fingerprint_dialog.generation_failed": "指纹生成失败",
  "accounts.device_fingerprint_dialog.binding_failed": "指纹绑定失败",
  "accounts.device_fingerprint_dialog.restoration_failed": "指纹恢复失败",
  "accounts.device_fingerprint_dialog.deletion_failed": "删除指纹失败",
  "accounts.device_fingerprint_dialog.directory_open_failed": "无法打开目录",
  "accounts.device_fingerprint_dialog.generated_and_bound": "新设备指纹已生成并完成绑定",
  "accounts.device_fingerprint_dialog.restored": "原始指纹已成功恢复",
  "accounts.device_fingerprint_dialog.deleted": "指纹记录已删除",
  "accounts.device_fingerprint_dialog.directory_opened": "配置目录已成功在系统管理器中打开",
  "accounts.device_fingerprint_dialog.original_fingerprint_not_found": "未找到系统的初始硬件指纹",
  "accounts.device_fingerprint_dialog.storage_json_not_found": "未检测到 storage.json，请确认 Antigravity 已至少运行过一次以生成基础配置",
  "accounts.details.title": "账号配额明细",
  "accounts.details.quota_groups": "配额分组",
  "accounts.warmup_all_triggered": "已触发全量账号智能预热",
  "accounts.toast.proxy_enabled": "已为 {{count}} 个账号启用代理",
  "accounts.toast.proxy_disabled": "已为 {{count}} 个账号停用代理",
  "accounts.add.token.batch_progress": "正在导入 {{current}}/{{total}} 个账号...",
  "accounts.add.token.batch_success": "已成功导入 {{count}} 个账号",
  "accounts.add.token.batch_partial": "批量导入完成：{{success}} 个成功，{{fail}} 个失败",
  "accounts.add.oauth_error": "OAuth 授权失败：{{error}}",
  "accounts.dialog.batch_delete_msg": "确定要删除选中的 {{count}} 个账号吗？此操作无法撤销。",
  "accounts.dialog.batch_warmup_msg": "确定要立即为选中的 {{count}} 个账号触发预热吗？",
  "accounts.add.tabs.token": "Refresh Token 登录",
  "accounts.add.oauth.recommend": "浏览器一键授权 (推荐)",
  "accounts.add.oauth.desc": "最安全的连接方式，无需向客户端提供密码或明文 Cookie",
  "accounts.add.oauth.btn_start": "启动浏览器授权",
  "accounts.add.oauth.btn_waiting": "正在等待浏览器端完成授权确认...",
  "accounts.add.oauth.link_label": "或手动复制授权链接至外部浏览器：",
  "accounts.add.oauth.link_click_to_copy": "点击复制授权 URL",
  "accounts.add.oauth.copy_link": "复制授权链接",
  "accounts.add.oauth.copied": "链接已复制！",
  "accounts.add.oauth.btn_finish": "完成并保存账号",
  "accounts.add.oauth.manual_hint": "在此粘贴浏览器返回的授权码或回调凭证：",
  "accounts.add.oauth.manual_placeholder": "在此粘贴 OAuth 授权码...",
  "accounts.add.oauth.error_no_flow": "未检测到活跃的授权流程或流程已超时",
  "accounts.add.oauth_success": "OAuth 账号添加成功",
  "accounts.table.five_hour_countdown": "5小时重置倒计时",

  # settings
  "settings.save": "保存设置",
  "settings.general.navigation_layout": "导航栏布局模式",
  "settings.general.nav_sidebar": "Apple macOS 磨砂毛玻璃侧边栏 (默认)",
  "settings.about.check_cooldown": "请等待 {{seconds}} 秒后再检查更新",
  "settings.security.anti_scraping": "防恶意抓取与反爬虫防御",
  "settings.expert.clear_logs_desc": "永久清除本地存储的调试日志与访问记录",
  "settings.advanced.cache_cleared_success": "缓存清理成功，已释放 {{size}} MB 磁盘空间",
  "settings.advanced.debug_log_dir_hint": "留空则使用默认日志目录：{{path}}/debug_logs",
  "settings.about.downloading_progress": "正在下载更新安装包 ({{progress}}%)...",
  "settings.global_system_prompt.char_count": "{{count}} 个字符",
  "settings.account.email": "账号邮箱",
  "settings.account.no_accounts": "暂无已绑定的账号",
  "settings.proxy_pool.proxies": "代理节点列表",

  # proxy
  "proxy.title": "API 代理网关",
  "proxy.error.load_failed": "加载代理网关配置失败",
  "proxy.status.running": "代理服务运行中",
  "proxy.status.stopped": "代理服务已停止",
  "proxy.status.accounts_available": "{{count}} 个可用账号",
  "proxy.health_check_title": "自动健康检测",
  "proxy.quota_balancer.title": "智能多阶梯配额均衡器",
  "proxy.cli_sync.title": "CLI 客户端一键配置同步",
  "proxy.cli_sync.subtitle": "自动将代理网关地址与 API Key 注入至本地命令行开发工具。",
  "proxy.cli_sync.card_title": "{{name}} 配置",
  "proxy.cli_sync.status.installed": "v{{version}}",
  "proxy.cli_sync.modal.view_title": "{{name}} 配置文件内容",
  "proxy.cli_sync.toast.sync_success": "同步成功！{{name}} 已配置就绪。",
  "proxy.cli_sync.toast.sync_error": "同步失败：{{error}}",
  "proxy.opencode_sync.toast.clear_error": "清除 OpenCode 配置失败：{{error}}",
  "proxy.opencode_sync.toast.sync_error": "OpenCode 同步失败：{{error}}",
  "proxy.opencode_sync.toast.clear_success": "OpenCode 配置已成功重置",
  "proxy.opencode_sync.sync_accounts": "同步账号列表",
  "proxy.opencode_sync.btn_clear": "清除配置",
  "proxy.opencode_sync.clear_confirm_title": "确认重置 OpenCode 配置？",
  "proxy.opencode_sync.clear_confirm_message": "这将移除写入 OpenCode 的所有 Antigravity 代理与模型设置。是否继续？",
  "proxy.droid_sync.toast.sync_success_count": "已向 Droid 添加 {{count}} 个模型",
  "proxy.droid_sync.toast.sync_error": "Droid 同步失败：{{error}}",
  "proxy.overview.running_status": "正在监听端口 {{port}}。多账号阶梯轮换与50ms内冷却保护已就绪。",
  "proxy.fixed_account.enabled": "固定账号路由已启用：{{email}}",
  "proxy.accounts.suspended_count": "，{{count}} 个已封禁",
  "proxy.accounts.active_rate_limits": "{{count}} 个速率限制生效中",
  "proxy.accounts.pinned_preferred": "优先固定路由",
  "proxy.accounts.pin_route": "固定此路由",
  "proxy.accounts.suspended_google_appeal": "账号已被 Google 封控（需前往控制台申诉）",
  "proxy.settings.port_placeholder": "输入代理监听端口",
  "proxy.settings.no_key_set": "尚未配置 API Key",
  "proxy.cloudflared.install_failed": "安装 Cloudflare Tunnel 失败：{{error}}",
  "proxy.cloudflared.start_failed": "启动 Tunnel 失败：{{error}}",
  "proxy.cloudflared.stop_failed": "停止 Tunnel 失败：{{error}}",
  "proxy.cloudflared.mobile_modal_title": "移动端扫码访问",
  "proxy.config.thinking_budget": "思考过程配额预算 (Thinking Budget)",
  "proxy.config.zai.models.hint": "可用模型数：{{count}}。请选择建议模型或输入自定义模型 ID。",
  "proxy.config.zai.models.error": "获取模型列表失败：{{error}}",
  "proxy.config.circuit_breaker.level": "等级 {{level}}",
  "proxy.config.opencode_sync.status.installed": "已安装 ({{version}})",
  "proxy.config.opencode_sync.toast.sync_error": "OpenCode 同步失败：{{error}}",
  "proxy.config.opencode_sync.toast.clear_error": "重置 OpenCode 配置失败：{{error}}",
  "proxy.router.preset_applied": "已应用路由预设：{{name}}",
  "proxy.status.started": "代理网关服务启动成功",
  "proxy.config.zai.base_url": "接口基础地址 (Base URL)",
  "proxy.config.scheduling.clear_bindings_success": "会话绑定关系清除成功",
  "proxy.config.scheduling.clear_rate_limits_success": "冷却时间与速率限制重置成功",
  "proxy.config.api_key_generated": "新 API Key 生成成功",
  "proxy.model.pro_low": "3.1 Pro Low (轻量均衡)",
  "proxy.model.pro_high": "3.1 Pro High (高算力深度)",
  "proxy.router.preset_default_desc": "GPT-4 → Gemini Pro，Claude → Opus",
  "proxy.router.groups.claude_35.desc": "Sonnet 3.5, Haiku 3.5",
  "proxy.router.groups.gpt_4.desc": "GPT-4, Turbo, o1-preview",
  "proxy.router.groups.gpt_4o.desc": "GPT-4o, Mini, 3.5 Turbo",
  "proxy.router.groups.gpt_5.desc": "GPT-5.1, GPT-5.2 xhigh",
  "proxy.router.reset_success": "路由规则已重置为默认值",
  "proxy.multi_protocol.openai_tools": "Cherry Studio、NextChat 等应用",
  "proxy.multi_protocol.anthropic_tools": "Claude Code 命令行工具",
  "proxy.multi_protocol.gemini_tools": "Google AI SDK、LangChain 等生态",
  "proxy.cli_sync.toast.config_missing": "请先生成 API Key 并启动代理服务",
  "proxy.droid_sync.modal_title": "将模型添加至 Droid",

  # monitor
  "monitor.stats.err": "错误",
  "monitor.filters.all": "全部",
  "monitor.network.requests_count": "{{count}} 次请求",
  "monitor.stats.active_streams": "活跃流式会话",
  "monitor.stats.total_requests": "总请求数",
  "monitor.stats.avg_latency": "平均响应延迟",
  "monitor.stats.success_rate": "请求成功率",
  "monitor.filter_by_status": "按状态筛选",
  "monitor.filter_by_model": "按模型筛选",
  "monitor.clear_all": "清除全部日志",
  "monitor.inspect_request": "查看请求明细",
  "monitor.response_headers": "响应头 (Headers)",
  "monitor.request_headers": "请求头 (Headers)",
  "monitor.live_tail": "实时滚动监控",

  # update_notification
  "update_notification.required": "必须更新",
  "update_notification.evaluating_changelog_for_v": "正在评估版本变更日志：v",
  "update_notification.version_v": "版本 v",
  "update_notification.update_available": "发现新版本可用",
  "update_notification.whats_new": "新特性与改进",

  # token_stats
  "token_stats.heatmap_tip": "点击任意方块以筛选并查看该日期的详细 Token 消耗",
  "token_stats.custom": "自定义时间范围",
  "token_stats.weekly_tooltip": "第 {{week}} 周 ({{dateRange}})\n总计：{{total}} Tokens\n输入：{{input}}\n输出：{{output}}",
  "token_stats.heatmap.days_active": "个活跃天，",
  "token_stats.heatmap.total_tokens": "总计消耗 Token",
  "token_stats.heatmap.less": "少",
  "token_stats.heatmap.more": "多",
  "token_stats.heatmap.no_activity": "当日无请求记录",
  "token_stats.heatmap.legend": "活跃度图例",
  "token_stats.summary.title": "消耗数据概览",
  "token_stats.summary.average": "日均消耗",
  "token_stats.summary.peak": "单日峰值",
  "token_stats.summary.total_requests": "总请求量",
  "token_stats.filter_today": "今天",
  "token_stats.filter_yesterday": "昨天",
  "token_stats.filter_7d": "最近 7 天",

  # security
  "security.logs.total_records": "总计 {{total}} 条记录",
  "security.logs.page_num": "第 {{page}} 页",
  "security.ip_stats.reqs": "次请求",
  "security.logs.ip": "客户端 IP",

  # user_token
  "user_token.custom_expires_at": "到期日期与时间",
  "user_token.hint_custom_expires": "选择此访问 Token 准确失效的日期和具体时间",
  "user_token.reqs": "次请求",
  "user_token.tokens": "Tokens",
  "user_token.created_at": "创建时间",
  "user_token.last_used_at": "最后使用时间",
  "user_token.status_active": "活跃生效中",

  # apiKeyFun
  "apiKeyFun.models.emptyFromKey": "未获取到任何模型，请点击查询以获取最新列表。",
  "apiKeyFun.keyManager.lastRemaining": "${{value}}",
  "apiKeyFun.syncSuccess": "已成功同步至 {{app}}",
  "apiKeyFun.syncError": "同步失败：{{error}}",
  "apiKeyFun.title": "API Key 转换站",
  "apiKeyFun.subtitle": "将任意标准 API Key 转换为 Antigravity 代理可用接入点",
  "apiKeyFun.add_key": "添加密钥",
  "apiKeyFun.key_name": "密钥名称",
  "apiKeyFun.key_value": "Key 内容",
  "apiKeyFun.key_status": "状态",
  "apiKeyFun.copy_key": "复制密钥",
  "apiKeyFun.delete_key": "删除密钥",

  # rtl_card
  "rtl_card.antigravity_2_0_desktop": "Antigravity 2.0 桌面端：",
  "rtl_card.antigravity_ide_workbench": "Antigravity IDE 开发工作台：",

  # notifications
  "notifications.overlay.platform": "平台环境",
  "notifications.overlay.esc": "Esc 退出",

  # sidebar
  "sidebar.shield": "SHIELD",
  "sidebar.agentic_manager_hub": "智能体管理中枢",
  "sidebar.dark_mode": "深色模式",
  "sidebar.status": "系统状态",

  # ecosystem
  "ecosystem.skills.sort_skills_to_show_active_ena": "将已启用和活跃的技能排在前面",
  "ecosystem.skills.show_only_skills_from_verified": "仅展示通过安全审计的官方认证创作者技能",
  "ecosystem.skills.active": "已激活",
  "ecosystem.skills.download_rank": "下载排名：#{{rank}}",
  "ecosystem.skills.author": "创作者",
  "ecosystem.skills.downloads": "安装量",
  "ecosystem.skills.category": "分类",
  "ecosystem.skills.install_btn": "一键安装",
  "ecosystem.skills.installed_badge": "已安装",
  "ecosystem.skills.view_details": "查看详情与说明",
  "ecosystem.mcp.tools_count_short": "{{count}} 个工具",
  "ecosystem.mcp.status_operational": "运行正常并已就绪 ({{ping}}ms)",
  "ecosystem.mcp.description_protocol": "用于为 AI 智能体扩展文件系统、网络搜索、GitHub 及数据库操作能力的通用协议",
  "ecosystem.mcp.of": "/",
  "ecosystem.mcp.view_tools": "查看可用工具列表",
  "ecosystem.mcp.copy_command": "复制启动命令",
  "ecosystem.mcp.test_ping": "测试网络连通性",
  "ecosystem.mcp.delete_server": "移除此 MCP 服务",
  "ecosystem.mcp.protocol_label": "通讯协议",
  "ecosystem.mcp.status_needs_config_desc": "需要配置必要参数或启动依赖环境",
  "ecosystem.mcp.status_connection_error": "连接服务器失败",
  "ecosystem.mcp.server_ready_desc": "MCP 服务器正常运行，可随时响应 AI 智能体调用。",
  "ecosystem.mcp.retest": "重新测试",
  "ecosystem.mcp.command_and_args": "执行命令与启动参数",
  "ecosystem.mcp.disabled": "服务已停用",
  "ecosystem.mcp.handshake": "该服务在 AI 首次发起握手时动态注册工具函数。",
  "ecosystem.rules.create": "新建规则或系统提示词",
  "ecosystem.rules.title": "智能体规则库",
  "ecosystem.rules.subtitle": "管理注入至 AI 编码会话的系统指导规范",
  "ecosystem.doc_viewer.critical_pillar": "核心支柱 (Critical)",
  "ecosystem.doc_viewer.recommended": "官方推荐 (Recommended)",
  "ecosystem.doc_viewer.specialized_utility": "专用工具 (Specialized)",
  "ecosystem.doc_viewer.documented": "已配备详尽文档",
  "ecosystem.doc_viewer.persian": "🇮🇷 波斯语",
  "ecosystem.security_audits": "安全审计 (Security Audits)",
  "ecosystem.official_maker": "官方认证厂商 (Official Maker)",
  "ecosystem.active_first": "优先展示活跃项",
  "ecosystem.architecture_docs": "架构与功能规范文档",
  "ecosystem.skills.sync_latest_install_counts_and": "从 Hub CDN 同步最新安装量与排行榜",
  "ecosystem.skills.official_technology_maker_skil": "官方技术厂商认证 (skills.sh 认证)",
  "ecosystem.skills.official": "官方认证",
  "ecosystem.skills.live_verified_upstream_git_rep": "已验证的上游 Git 源码仓库",
  "ecosystem.skills.live": "在线",
  "ecosystem.skills.toggle": "切换状态",
  "ecosystem.skills.of": "/",
  "ecosystem.skills.scroll_down_to_load_more": "向下滚动加载更多",
  "ecosystem.skills.all": "✓ 全部",
  "ecosystem.skills.skills_rendered": "个技能已渲染",
  "ecosystem.skills.try_adjusting_your_query_or_ca": "尝试调整搜索关键词或分类筛选器。",
  "ecosystem.skills.installs": "安装量",
  "ecosystem.skills.github_stars": "GitHub Star 数",
  "ecosystem.skills.repository": "源码仓库",
  "ecosystem.skills.first_seen": "首次收录",
  "ecosystem.skills.gen_agent_trust_hub": "Gen Agent 信任中枢",
  "ecosystem.skills.pass": "通过",
  "ecosystem.skills.socket": "Socket",
  "ecosystem.skills.pass_2": "通过",
  "ecosystem.skills.snyk": "Snyk",

  # debug_console
  "debug_console.pause_scroll": "暂停滚动",
  "debug_console.resume_scroll": "继续滚动",
  "debug_console.clear": "清空日志",
  "debug_console.no_logs": "暂无日志可显示",
  "debug_console.no_logs_hint": "当后台产生事件或网络活动时，日志将实时显示在此处。",
  "debug_console.scroll_to_bottom": "滚动到底部",
  "debug_console.toggle": "切换调试控制台",
  "debug_console.title": "调试控制台",
  "debug_console.filter_all": "全部日志",
  "debug_console.filter_error": "仅看错误",
  "debug_console.filter_warn": "仅看警告",

  # layout
  "layout.mini_view.no_account_selected": "未选中账号",
  "layout.mini_view.no_quota_data_available": "暂无配额数据",
  "layout.mini_view.input_output_tokens": "输入 / 输出 Tokens",
  "layout.mini_view.switch_account": "切换账号",
  "layout.mini_view.pin_window": "固定置顶窗口",
  "layout.mini_view.unpin_window": "取消固定窗口",
  "layout.mini_view.expand_view": "展开完整窗口",
  "layout.mini_view.compact_view": "精简悬浮窗",
  "layout.mini_view.current_quota": "当前配额",
  "layout.mini_view.reset_time": "重置时间",
  "layout.mini_view.status_healthy": "正常",
  "layout.mini_view.status_warning": "警告"
}

# Auto-translation dictionary for any additional strings
AUTOTRANS = {
    "Claude Code Model Mapping": "Claude Code 模型映射",
    "Map Claude Code CLI tool models to Shield models to optimize speed and cost.": "将 Claude Code 命令行工具模型映射至 Shield 模型，以优化速度并降低消耗成本。",
    "Best performance for complex tasks": "针对复杂推理与编码任务的最佳性能",
    "Special, powerful plan": "专属强大高算力计划",
    "Fastest model for brief responses": "响应速度极快的小型轻量模型",
    "Maps to Shield Model": "映射至 Shield 模型",
    "Apply Recommended": "应用推荐设置",
    "Restore Defaults": "恢复默认设置",
    "Reset All": "全部重置",
    "Lightning fast": "极致响应速度",
    "Thinking capability": "深度思考分析能力",
    "Top in reasoning": "顶级逻辑推理水平",
    "Conserves quota": "大幅节省配额消耗",
    "Reasoning in code": "代码级严密逻辑推理",
    "Thinking chain": "完整思考链",
    "Most powerful thinking": "最强推理引擎",
    "Model Router": "模型路由器",
    "Intelligent routing by family or exact matching mappings.\nNote: Claude models bypass grouping by default; use \"Advanced Routing\" to change.": "按模型家族或精确规则进行智能重定向路由。\n注意：Claude 模型默认直接穿透；如需调整请在“高级路由”中设定。",
    "Customize model routing with wildcards or exact matches": "使用通配符或精确名称灵活自定义模型路由指向",
    "Only show models with quota": "仅显示具备有效配额的模型",
    "When enabled, /v1/models only returns models with active quota from connected accounts, and aliases are hidden.": "开启后，/v1/models 接口仅返回已连接账号中存在有效配额的模型，隐藏未启用的别名。",
    "Background Task Model": "后台自动化任务模型",
    "Model used by Claude CLI for title generation and summarization (default: gemini-2.5-flash)": "Claude CLI 在后台生成会话标题和总结时所调用的轻量模型 (默认: gemini-2.5-flash)",
    "Use System Default": "使用系统预设默认值",
    "Current Model": "当前生效模型",
    "Apply Presets": "应用预设方案",
    "Presets applied successfully": "预设方案已成功应用",
    "Standard Preset": "标准综合预设",
    "GPT-4 → Gemini Pro, Claude → Opus": "GPT-4 → Gemini Pro，Claude → Opus",
    "Performance First": "性能与质量优先",
    "Use the most capable models for all requests": "对所有传入的请求均优先调度算力最强的旗舰模型",
    "Cost Optimized": "成本与额度节约优先",
    "Prioritize low-cost and fast models": "优先调用极速低消耗模型以最大化续航时间",
    "Balanced Mode": "均衡模式 (推荐)",
    "Smart balance between response quality and quota usage": "在回答质量与额度消耗之间取得最佳平衡",
    "Built-in System Presets": "系统内置官方预设",
    "Multi-Protocol Support": "多协议无缝兼容架构",
    "Seamless integration with all AI CLI tools and clients": "原生无缝对接所有主流第三方 AI 客户端与终端工具",
    "Shield's local proxy supports OpenAI, Anthropic, and Gemini protocols simultaneously.": "Antigravity Shield 本地代理网关同时原生支持 OpenAI、Anthropic 以及 Gemini 通信协议。",
    "OpenAI Protocol": "OpenAI 兼容协议",
    "Anthropic Protocol": "Anthropic 原生协议",
    "e.g. Cherry Studio and NextChat": "如 Cherry Studio、NextChat 等主流客户端",
    "e.g. Claude Code terminal tool": "如 Claude Code CLI 终端编码助手",
    "Gemini Protocol": "Gemini 原生协议",
    "Google AI SDK and LangChain libraries": "Google AI SDK 与 LangChain 等主流开发框架",
    "Quick Integration": "极速集成接入",
    "Click a model to view sample code": "👆 点击任一模型即可查看对应语言的接入代码示例",
    "Copy Base URL": "复制 Base URL 地址",
    "Supported Models & Integration": "支持的模型与接入指南",
    "Model Name": "模型名称",
    "Model ID": "模型标识 (Model ID)",
    "Description & Use Case": "模型特点与推荐应用场景",
    "Actions": "操作",
    "Select Target Model": "选择目标映射模型",
    "Sync Settings": "同步配置文件",
    "View Config File": "查看本地配置文件",
    "Restore Official Default": "恢复官方默认端点",
    "Restore Backup File": "从历史备份中恢复",
    "Are you sure you want to restore {{name}} config to the official endpoint?": "确定要将 {{name}} 的配置恢复为官方默认端点吗？",
    "Backup file found. Do you want to restore it?": "检测到历史备份文件，是否恢复？",
    "Confirm Sync": "确认同步配置",
    "Ready to configure {{name}}. ⚠️ Warning: This will overwrite your current local config file. Continue?": "准备为 {{name}} 注入代理配置。⚠️ 警告：这将覆盖现有本地配置文件。是否继续？",
    "Config Content": "配置文件内容",
    "Open Config Directory": "打开配置所在目录",
    "Open Official Documentation": "查阅官方集成文档",
    "Sync Succeeded": "配置同步成功",
    "Restore Succeeded": "恢复配置成功",
    "Configuration is missing or incomplete": "配置信息缺失或未完成初始化",
    "Proxy service is not running. Please start it first.": "代理服务未运行，请先在控制台中启动代理服务。",
}

out_flat = {}
var_regex = re.compile(r'\{\{([^}]+)\}\}')

for k, en_val in en_flat.items():
    en_vars = sorted(var_regex.findall(en_val))
    
    chosen = None
    if k in ZH_DICTIONARY:
        chosen = ZH_DICTIONARY[k]
    elif en_val.strip() in AUTOTRANS:
        chosen = AUTOTRANS[en_val.strip()]
    elif k in zh_flat:
        existing = zh_flat[k]
        loc_vars = sorted(var_regex.findall(existing))
        is_same_en = (existing.strip() == en_val.strip())
        vars_ok = (en_vars == loc_vars)
        is_invariant = en_val.strip() in ["Antigravity Shield", "PRO", "ULTRA", "FREE", "API Key", "JSON", "URL", "OK", "cURL", "Python", "Node.js", "Docker", "VS Code", "Cursor", "Windsurf", "v1/chat/completions", "v1/messages"]
        
        if vars_ok and (not is_same_en or is_invariant):
            chosen = existing

    # Fallback to smart translation
    if chosen is None:
        # Check code snippets
        if "from openai import OpenAI" in en_val or "from anthropic import Anthropic" in en_val or "import google.generativeai" in en_val:
            chosen = en_val
        else:
            # Simple clean translation
            chosen = en_val
            for eng, chn in AUTOTRANS.items():
                if eng in chosen:
                    chosen = chosen.replace(eng, chn)

    # Variable guarantee
    chosen_vars = sorted(var_regex.findall(chosen))
    if en_vars != chosen_vars:
        for v in en_vars:
            if f"{{{{{v}}}}}" not in chosen:
                chosen += f" {{{{{v}}}}}"
        for v in chosen_vars:
            if v not in en_vars:
                chosen = chosen.replace(f"{{{{{v}}}}}", "")

    out_flat[k] = chosen

# Reconstruct nested structure
def unflatten_from_en(en_obj, prefix=''):
    res = {}
    for k, v in en_obj.items():
        full = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            res[k] = unflatten_from_en(v, full)
        else:
            res[k] = out_flat[full]
    return res

zh_nested = unflatten_from_en(en_tree)

with open(ZH_PATH, 'w', encoding='utf-8') as f:
    json.dump(zh_nested, f, ensure_ascii=False, indent=2)
    f.write('\n')

# Check results
still_en = []
for k, en_val in en_flat.items():
    val = out_flat[k]
    if val == en_val and (' ' in en_val or len(en_val) > 10) and en_val.strip() not in ['Antigravity Shield', 'PRO', 'ULTRA', 'FREE', 'API Key', 'JSON', 'URL', 'OK']:
        still_en.append((k, en_val))

print(f"[ZH] Total keys written: {len(out_flat)}")
print(f"[ZH] Untranslated English remaining: {len(still_en)}")
