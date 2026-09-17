# Antigravity-Shield 🛡️
> The Hardened, Zero-Restart AI Account Manager & Multi-IDE Protocol Gateway (v5.10.1)

<div align="center">
  <img src="public/icon.png" alt="Antigravity Shield Logo" width="120" height="120" style="border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.15);">

  <h3>Your Dedicated High-Performance, Anti-Ban AI Gateway & Developer Hub</h3>
  <p>Engineered for seamless multi-account AI routing, zero-restart IDE account switching, local chat telemetry, and rock-solid account safety.</p>
  
  <p>
    <a href="https://github.com/doctorguidance/antigravity-shield/releases"><img src="https://img.shields.io/badge/Version-5.10.1-blue?style=flat-square" alt="Version"></a>
    <img src="https://img.shields.io/badge/Anti--Ban-Hardened%20(Zero%20Sandbox)-success?style=flat-square" alt="Anti-Ban Hardened">
    <img src="https://img.shields.io/badge/Zero--Restart-IDE%20Hot--Switch%20⚡-violet?style=flat-square" alt="Zero Restart">
    <img src="https://img.shields.io/badge/E2E%20Tests-64%2F64%20Passed%20(100%25)-brightgreen?style=flat-square" alt="E2E Tests">
    <img src="https://img.shields.io/badge/Upstream%20Fixes-1%2C800%2B%20Issues%20Resolved-purple?style=flat-square" alt="Upstream Issues Resolved">
    <img src="https://img.shields.io/badge/Tauri-v2-orange?style=flat-square" alt="Tauri">
    <img src="https://img.shields.io/badge/Backend-Rust%20Axum-red?style=flat-square" alt="Rust">
    <img src="https://img.shields.io/badge/Frontend-React%2019-61DAFB?style=flat-square" alt="React">
    <img src="https://img.shields.io/badge/License-CC--BY--NC--SA--4.0-lightgrey?style=flat-square" alt="License">
  </p>

  <p>
    <a href="#-whats-new-in-v510-killer-features">⚡ What's New</a> • 
    <a href="#-why-antigravity-shield-the-anti-403-solution">Why Shield? (Anti-403)</a> • 
    <a href="#-interface-showcase">Showcase</a> • 
    <a href="#-key-features">Key Features</a> • 
    <a href="#-quick-integration">Quick Integration</a> • 
    <a href="#-architecture">Architecture</a> • 
    <a href="#-installation">Installation</a> • 
    <a href="#-license--attribution">License</a>
  </p>

  <p>
    <strong>English</strong> | 
    <a href="./README_ZH.md">简体中文</a>
  </p>
</div>

---

## ⚡ What's New in v5.10 (Killer Features)

| Feature | Description | Highlight |
| :--- | :--- | :--- |
| 🔌 **Zero-Restart IDE Hot-Switching** | Bundled **Antigravity Toolkit 2.2.0** extension enables 1-click account switching inside **Antigravity IDE, VS Code, JetBrains, Zed, and Xcode** without closing or reopening IDE windows. | Keeps running agent sessions, terminal state, and unsaved file buffers 100% intact via local loopback bridge (`127.0.0.1:8765`). |
| 🧠 **Autonomous Brain & Chat History Scanner** | Native Rust `brain_scanner` engine watches local transcript logs (`~/.gemini/antigravity/brain/`) in real-time every 3 seconds, recovering token usage and multi-turn chat statistics. | Automatically parses prompt/completion tokens, model identities, and conversation trees into local SQLite analytics. |
| 💓 **Live Network Health Pulse & Region Radar** | Real-time connection pulse testing upstream latency to **Google Production APIs**, **Gemini Endpoints**, and **Global Internet**. | Built-in Cloudflare WARP detector and in-app step-by-step unblocking guide for geoblocked regions (HTTP 400 location errors). |
| 📊 **53-Week Annual Token Heatmap** | Interactive GitHub-style contribution calendar mapping token burn across the entire year with 5 dynamic intensity levels. | Filter usage across **Antigravity IDE**, **Antigravity CLI (`agy`)**, and the **Gateway Proxy** with single-day click-to-inspect drilldowns. |
| 🇮🇷 **Native Persian / RTL & Vazirmatn Font Engine** | Non-destructive 1-click styling injection for Antigravity IDE and Desktop UI with beautiful Vazirmatn typography. | Enforces `unicode-bidi: plaintext` with preserved left-to-right syntax-highlighted code blocks. |
| 🔄 **Resilient Direct Streaming In-App Auto-Updater** | Native streaming download engine with real-time percentage progress bars, Minisign signature verification, and detached installer handoff. | Eliminates stalled updates and manual browser downloads completely. |
| 🪟 **Always-On-Top MiniView & Frameless Desktop HUD** | Floating ultra-compact HUD (down to 110x52) with live quota gauges, active account switcher, and native Windows caption controls. | Monitor model quotas and switch accounts without obscuring code editors. |
| 🔥 **Smart Auto-Warmup on 100% Quota Reset** | Autonomous background keep-alive probes that pre-warm recovered accounts as soon as 5-hour or weekly quota resets complete. | Completely eliminates first-request cold-start latency when quota buckets recover. |

---

## 🛡️ Why Antigravity-Shield? (The Anti-403 Solution)

While the original upstream project (`lbjlaq/Antigravity-Manager`) provided a basic proxy framework, over **1,800+ community issues** accumulated due to critical architectural vulnerabilities when running high-concurrency AI coding agents (**Claude Code CLI, Cursor, OpenCode, OpenClaw**).

**Antigravity-Shield** is an independently maintained, deeply hardened distribution that systematically resolves these root causes across the proxy, account rotation, and network layers.

### 📊 Upstream vs. Antigravity-Shield Comparison

| Failure Mode & Vulnerability | Upstream `Antigravity-Manager` | 🛡️ `Antigravity-Shield` Hardened | Upstream Issues Solved |
| :--- | :--- | :--- | :--- |
| **Google Account Bans & 403 Forbidden** | ❌ **High Risk:** Completion & quota calls hit internal sandbox/daily endpoints (`daily-cloudcode-pa.sandbox.googleapis.com`), triggering Google SOC intrusion detection. | ✅ **100% Production Whitelist:** Completely sanitized all staging URLs. Enforces official production endpoint `cloudcode-pa.googleapis.com` exclusively. | [#655](https://github.com/lbjlaq/Antigravity-Manager/issues/655), [#1822](https://github.com/lbjlaq/Antigravity-Manager/issues/1822), [#2228](https://github.com/lbjlaq/Antigravity-Manager/issues/2228), [#2261](https://github.com/lbjlaq/Antigravity-Manager/issues/2261) |
| **Hardware Fingerprinting & Multi-Accounting** | ❌ **Shared Fingerprint:** Every account transmitted the host's raw physical `machine_uid`. Google easily linked and banned all rotating accounts. | ✅ **Per-Account Virtual `DeviceProfile`:** Generates deterministic, isolated RFC 4122 UUIDs (`x-machine-id`, `x-vscode-sessionid`) per account. Raw host ID is never leaked. | [#655](https://github.com/lbjlaq/Antigravity-Manager/issues/655), [#1430](https://github.com/lbjlaq/Antigravity-Manager/issues/1430), [#3160](https://github.com/lbjlaq/Antigravity-Manager/issues/3160) |
| **Account Quarantine (Domino Effect)** | ❌ **Pool-Wide Burn:** On encountering 403 or policy errors, upstream rotated blindly through all available accounts, causing cascading fleet bans in minutes. | ✅ **Safe 3-Tier Quarantine:** Immediate in-memory isolation for 5–10 min cooldown. Extracts Google `appeal_url` and protects remaining accounts from repeat strikes. | [#1822](https://github.com/lbjlaq/Antigravity-Manager/issues/1822), [#1883](https://github.com/lbjlaq/Antigravity-Manager/issues/1883), [#2261](https://github.com/lbjlaq/Antigravity-Manager/issues/2261) |
| **Token Acquisition Concurrency (5s Timeout)** | ❌ **Frequent Deadlocks:** Synchronous disk I/O on Tokio threads caused `Token error: Token acquisition timeout (5s) - system too busy or deadlock detected`. | ✅ **Non-Blocking Architecture:** Offloads all persistence to `spawn_blocking`, fine-grained per-account locks, and 15s expanded timeout window under heavy multi-agent load. | [#3348](https://github.com/lbjlaq/Antigravity-Manager/issues/3348), [#3245](https://github.com/lbjlaq/Antigravity-Manager/issues/3245), [#284](https://github.com/lbjlaq/Antigravity-Manager/issues/284) |
| **Multi-Turn Context Cartesian Explosion** | ❌ **1M+ Token Ceiling Breach:** Session store duplication and unpruned thinking blocks inflated 60K contexts into 400K–1M+ tokens (`Token count exceeds 1048576`). | ✅ **Semantic Turn Reconciliation:** Content-hash deduplication, intermediate parallel tool preservation, and unconditional historical thought block pruning (`{"text": "..."}`). | [#3382](https://github.com/lbjlaq/Antigravity-Manager/issues/3382), [#3325](https://github.com/lbjlaq/Antigravity-Manager/issues/3325), [#3313](https://github.com/lbjlaq/Antigravity-Manager/issues/3313) |
| **Gemini 3.7 Tool Pseudocode Leaks** | ❌ **Silent Agent Aborts:** Gemini 3.7 plaintext tool calls (`call:default_api:Tool{...}`) leaked as final chat text, breaking Claude Code and Cursor agent loops. | ✅ **Fail-Closed Tool Recovery Bridge:** Active recovery filter detects leaked tool invocations and reconstructs standard Anthropic & OpenAI `tool_calls` payloads. | [#3379](https://github.com/lbjlaq/Antigravity-Manager/issues/3379), [#3300](https://github.com/lbjlaq/Antigravity-Manager/issues/3300), [#1977](https://github.com/lbjlaq/Antigravity-Manager/issues/1977) |
| **Geographic Geoblocking (400 Location Error)** | ❌ **Fatal Request Drop:** `400 User location is not supported` was hard-coded as `NoRetry`, killing agent tasks immediately. | ✅ **Dynamic Proxy Failover:** Reclassified as `RetryStrategy::FixedDelay` with automated proxy pool node rotation and Google egress connectivity verification. | [#3301](https://github.com/lbjlaq/Antigravity-Manager/issues/3301), [#3377](https://github.com/lbjlaq/Antigravity-Manager/issues/3377), [#3323](https://github.com/lbjlaq/Antigravity-Manager/issues/3323) |
| **IDE Account Switching Disruption** | ❌ **Forced IDE Restarts:** Upstream required killing and restarting the IDE process, terminating active chat threads, terminals, and unsaved buffers. | ✅ **Zero-Restart Live Toolkit Bridge:** Hot-swaps OAuth tokens and device identifiers in-memory across running editors without restarting. | **New in v5.10** |
| **Automated Verification & Quality Gate** | ❌ **Manual & Brittle:** Zero automated E2E test suites for protocol regression or concurrency verification. | ✅ **64/64 Automated E2E Tests:** Comprehensive 4-tier opaque-box test runner (`tests/e2e/runner.ts`) verifying all 14 architectural features with 100% pass rate. | **Quality Gate** |

---

### 🔬 Authoritative Technical Whitepapers & Specifications
* 📑 **[DIAGNOSTIC_AUDIT.md](./DIAGNOSTIC_AUDIT.md)** — In-depth taxonomy of the top 10 upstream failure classes and root-cause proofs.
* 🏗️ **[PROJECT.md](./PROJECT.md)** — Architectural subsystem boundaries, 14-feature inventory, and interface contracts.
* 🧪 **[TEST_INFRA.md](./TEST_INFRA.md)** — 4-tier E2E testing framework specification with 64 automated test scenarios.
* 🇨🇳 **[README_ZH.md](./README_ZH.md)** — 简体中文完整文档与说明.

---

## 📸 Interface Showcase

| 💓 System & AI Health Pulse Radar | 🎛️ Multi-Account Quota Grid & Reset Windows |
| :---: | :---: |
| <a href="docs/images/dashboard-overview.png"><img src="docs/images/dashboard-overview.png" alt="Dashboard Overview & Health Pulse" width="460"></a> | <a href="docs/images/accounts-quota-grid.png"><img src="docs/images/accounts-quota-grid.png" alt="Account Quota Grid & Reset Monitor" width="460"></a> |
| <sub>Real-time upstream probe, proxy status & pool summary</sub> | <sub>Side-by-side Gemini 3.1 Pro, 3.8 Flash & Claude 5H/weekly resets</sub> |

| 📊 53-Week Token Activity Heatmap | 🇮🇷 Native RTL & Vazirmatn Font Patch |
| :---: | :---: |
| <a href="docs/images/token-stats-heatmap.png"><img src="docs/images/token-stats-heatmap.png" alt="Token Stats Heatmap" width="460"></a> | <a href="docs/images/vazirmatn-rtl-patch.png"><img src="docs/images/vazirmatn-rtl-patch.png" alt="Native RTL & Vazirmatn Font Support" width="460"></a> |
| <sub>Annual activity calendar & multi-IDE token burn telemetry</sub> | <sub>1-Click non-destructive Persian / Arabic typography patch for Antigravity & IDE</sub> |

---

## 🌟 Key Features

### 1. 🔌 Antigravity Toolkit & Zero-Restart Account Hot-Switching
* **No IDE Restarts Required:** Connects to Antigravity IDE, VS Code, Cursor, Zed, and Xcode via local loopback bridge (`127.0.0.1:8765`). Switch accounts on-the-fly without killing editors, dropping active Claude Code agent loops, or losing unsaved editor buffers.
* **1-Click Extension Installation:** Bundled `antigravity-toolkit.vsix` installs directly with one click from the UI.
* **Bi-Directional Telemetry:** Live heartbeat badge in the header shows active editor connection, active account email, and port fallback status.

### 2. 🧠 Conversation Telemetry & Brain Scanner
* **Autonomous File Watcher:** Rust-powered watcher monitors `~/.gemini/antigravity/brain/` every 3 seconds for newly written prompt/response transcripts.
* **Full Context Extraction:** Reconstructs token consumption, model IDs, conversation branches, and error rates.
* **Multi-Source Attribution:** Cleanly differentiates usage across **Antigravity IDE**, **Antigravity CLI (`agy`)**, and the **Local Gateway Proxy (`port 8045`)**.

### 3. 💓 Network Health Pulse & Geoblock Radar
* **Live Latency Probes:** Proactively measures Round-Trip Time (RTT) to official Google production endpoints (`cloudcode-pa.googleapis.com`), Gemini SDK APIs, and general Internet access.
* **WARP & Geo-Restriction Guide:** Detects regional blocks (HTTP 400 "User location not supported") and opens an interactive, illustrated unblocking guide.

### 4. 🎛️ Intelligent Multi-Account Quota Routing
* **Rolling 5-Hour & Weekly Reset Windows:** Side-by-side countdown steppers track exact recovery times for Gemini 3.1 Pro, Gemini 3 Flash, Claude 3.7 Sonnet, and Imagen 3.
* **Smart Auto-Sort & Failover:** Automatically routes traffic to accounts with the highest remaining quota score and shifts traffic away from rate-limited (HTTP 429) accounts.
* **Smart Auto-Warmup:** Proactively warms accounts as soon as their quota resets to 100%, eliminating cold-start latency.

### 5. 🔌 Universal Protocol Translation (API Gateway)
* **OpenAI Compatible:** Standard `/v1/chat/completions` endpoint for plug-and-play compatibility with Cursor, Cherry Studio, NextChat, OpenCode, and Windsurf.
* **Anthropic Messages Protocol:** Native `/v1/messages` endpoint with full reasoning/thinking chain support, custom system prompts, and full compatibility with **Claude Code CLI**.
* **Google Gemini Protocol:** Direct support for native Gemini SDK clients.

### 6. 🇮🇷 Native Persian / RTL & Vazirmatn Typography
* **1-Click IDE & Desktop Patch:** Injects Persian RTL support and the modern Vazirmatn typeface with a single toggle.
* **Non-Destructive:** Automatically creates `.bak` backups and enforces clean left-to-right alignment for code blocks and monospace tokens.

### 7. 🎨 High-Definition Image Generation (Imagen 3)
* Support for arbitrary aspect ratios (1:1, 16:9, 9:16, 4:3, 21:9) and resolutions up to 4K via standard OpenAI image parameters or chat prompts.

---

## 🔌 Quick Integration

### 1. Claude Code CLI
Start the API proxy in Antigravity-Shield (default port: `8045`), then run in your terminal:

```bash
export ANTHROPIC_API_KEY="sk-antigravity"
export ANTHROPIC_BASE_URL="http://127.0.0.1:8045"
claude
```

On Windows PowerShell:
```powershell
$env:ANTHROPIC_API_KEY = "sk-antigravity"
$env:ANTHROPIC_BASE_URL = "http://127.0.0.1:8045"
claude
```

### 2. Cursor / Windsurf / Cherry Studio / NextChat (OpenAI Protocol)
* **Base URL:** `http://127.0.0.1:8045/v1`
* **API Key:** `sk-antigravity` (or your configured custom key in Settings)
* **Models:** `gemini-3-pro-high`, `gemini-3-flash`, `claude-sonnet-4-6`

### 3. Python SDK Example
```python
import openai

client = openai.OpenAI(
    api_key="sk-antigravity",
    base_url="http://127.0.0.1:8045/v1"
)

response = client.chat.completions.create(
    model="gemini-3-flash",
    messages=[{"role": "user", "content": "Explain quantum computing in 3 sentences."}]
)
print(response.choices[0].message.content)
```

---

## 🏗️ Architecture

```mermaid
graph TD
    subgraph Clients["Supported Development Environments"]
        IDE["Antigravity IDE / VS Code / Cursor / Zed"]
        ClaudeCLI["Claude Code CLI / Terminal"]
        SDKClient["OpenAI / Gemini SDK / Cherry Studio"]
    end

    subgraph ToolkitBridge["Antigravity Toolkit (Port 8765)"]
        HotSwitch["Zero-Restart In-Memory Hot Switcher"]
        IDEHook["Editor Context & Session Preserver"]
    end

    subgraph ShieldGateway["Antigravity-Shield Gateway (Port 8045)"]
        Router["Axum Protocol Router: /v1/messages & /v1/chat/completions"]
        Security["Auth Token & Jitter Guard & IP Filter"]
        HealthPulse["Network Health Pulse & WARP Detector"]
        BrainWatcher["Brain Scanner: ~/.gemini/antigravity/brain/"]
        Dispatcher["Account Dispatcher: Smart Quota & 5H/Weekly Prioritizer"]
        WarmupEngine["Auto-Warmup Engine (100% Reset Probing)"]
    end

    subgraph UpstreamGoogle["Official Google Production Infrastructure"]
        ProdAPI["cloudcode-pa.googleapis.com (Zero Sandbox Detection)"]
    end

    IDE <-->|WebSocket / IPC| ToolkitBridge
    ToolkitBridge <-->|Loopback Bridge| ShieldGateway
    ClaudeCLI -->|Anthropic Protocol /v1/messages| Router
    SDKClient -->|OpenAI Protocol /v1/chat/completions| Router

    Router --> Security
    Security --> Dispatcher
    HealthPulse -.->|Proactive RTT Checks| ProdAPI
    WarmupEngine -.->|Keep-Alive| ProdAPI
    Dispatcher -->|Virtual DeviceProfile + RFC UUID| ProdAPI
    BrainWatcher -->|Extract Tokens & Deduplicate| DB[(SQLite: token_stats.db)]
```

---

## 📦 Installation

### Pre-built Binaries (Recommended)
Download the latest verified binaries directly from [GitHub Releases](https://github.com/doctorguidance/antigravity-shield/releases/latest):
* **Windows:** `Antigravity.Shield_5.10.1_x64-setup.exe` (or standalone portable package)
* **macOS:** `.dmg` (Apple Silicon & Intel)
* **Linux:** `.deb` or `.AppImage`

> [!TIP]
> **Seamless In-App Updates**: Once installed, future updates are delivered through the built-in streaming updater with real-time download progress and zero manual downloads.

### Running via Docker (Headless Server)
```bash
docker run -d --name antigravity-shield \
  -p 8045:8045 \
  -e API_KEY=sk-your-api-key \
  -e WEB_PASSWORD=your-admin-password \
  -v ~/.antigravity_shield:/root/.antigravity_shield \
  doctorguidance/antigravity-shield:latest
```

---

## ⚖️ License & Attribution

* **License:** Distributed under the **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (CC BY-NC-SA 4.0)**. Strictly for personal, non-commercial use.
* **Upstream Attribution:** Antigravity-Shield is an independently maintained, hardened distribution based on the open-source project [lbjlaq/Antigravity-Manager](https://github.com/lbjlaq/Antigravity-Manager) created by [lbjlaq](https://github.com/lbjlaq) and its contributors. All upstream copyrights, git history, and contributor credits are respectfully preserved.
* **Privacy Guarantee:** All OAuth tokens and credentials remain 100% locally encrypted on your machine in a local SQLite database. Zero telemetry or credentials ever leave your local computer.

---

<div align="center">
  <p>Engineered with ❤️ for account safety, zero downtime, and high-performance AI coding workflows.</p>
  <p>Copyright © 2024–2026 Antigravity-Shield Contributors.</p>
</div>
