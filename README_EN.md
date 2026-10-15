# Antigravity Shield 🛡️
> **Enterprise High-Performance AI Account Manager, Universal Agent Skills Marketplace & Zero-Leak Multi-IDE Protocol Gateway**  
> *Version 5.22.0 — Engineered with Rust (Axum / Tokio) & React 19 (Tauri 2.x)*

<div align="center">
  <img src="public/icon.png" alt="Antigravity Shield Logo" width="130" height="130" style="border-radius: 28px; box-shadow: 0 12px 36px rgba(0,0,0,0.2);">

  <h3>Autonomous AI Quota Routing • 1,000+ Agent Skills • Zero-Leak Security • Zero-Restart IDE Hot-Switching</h3>

  <p>
    <a href="https://github.com/doctorguidance/antigravity-shield/releases"><img src="https://img.shields.io/badge/Version-5.22.0-0A84FF?style=for-the-badge&logo=tauri&logoColor=white" alt="Version 5.22.0"></a>
    <img src="https://img.shields.io/badge/Rust-Axum%20%2F%20Tokio-DEA584?style=for-the-badge&logo=rust&logoColor=white" alt="Rust Axum">
    <img src="https://img.shields.io/badge/Frontend-React%2019-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19">
    <img src="https://img.shields.io/badge/Desktop-Tauri%20v2-FFC131?style=for-the-badge&logo=tauri&logoColor=black" alt="Tauri v2">
    <img src="https://img.shields.io/badge/Marketplace-1%2C000%2B%20Curated%20Skills-30D158?style=for-the-badge&logo=sparkles&logoColor=white" alt="1000+ Skills">
    <img src="https://img.shields.io/badge/Security-Zero--Leak%20Local-BF5AF2?style=for-the-badge&logo=shield&logoColor=white" alt="Zero-Leak">
    <img src="https://img.shields.io/badge/Tests-64%2F64%20Passed%20(100%25)-brightgreen?style=for-the-badge" alt="E2E Tests">
    <img src="https://img.shields.io/badge/License-CC--BY--NC--SA--4.0-5E5CE6?style=for-the-badge" alt="License">
  </p>

  <p>
    <a href="#-executive-overview">Executive Overview</a> • 
    <a href="#-core-architectural-pillars">Core Pillars</a> • 
    <a href="#-universal-agent-ecosystem--marketplace">Skills Marketplace</a> • 
    <a href="#-system-architecture">Architecture</a> • 
    <a href="#-quick-integration">Integration Guide</a> • 
    <a href="#-tech-stack">Tech Stack</a> • 
    <a href="#-installation--setup">Installation</a> • 
    <a href="#-license--attribution">License</a>
  </p>

  <p>
    <strong>English (Pure)</strong> | 
    <a href="./README_FA.md">فارسی (Persian)</a> | 
    <a href="./README.md">Master README</a> | 
    <a href="./README_ZH.md">简体中文</a>
  </p>
</div>

---

## ⚡ Executive Overview

**Antigravity Shield** is an ultra-hardened, agency-grade desktop environment and local reverse-proxy gateway engineered for high-concurrency AI agent workflows. It bridges the gap between modern autonomous coding agents (**Google Antigravity**, **Claude Code CLI**, **Cursor**, **Windsurf**, **Gemini CLI**, **Zed**) and enterprise-tier multi-account infrastructure.

Operating locally on `127.0.0.1:8045` and `127.0.0.1:8765`, Antigravity Shield delivers non-blocking account rotation, real-time quota telemetry, automated failover with 0ms interruption, zero-restart IDE account hot-switching, and a curated marketplace of **over 1,000 universal agent skills** conforming to the `SKILL.md` standard.

### 🎯 Key Performance Highlights
- **Autonomous Multi-Account Proxy (`127.0.0.1:8045`):** High-throughput Rust Axum/Tokio reverse proxy with intelligent account rotation and zero-interruption failover during rate limits.
- **Tier Telemetry (`Pro` vs `Free` vs `Ultra`):** Automatic classification and quota telemetry across subscription tiers with dynamic routing prioritizations and quota window countdowns (5-hour and weekly).
- **Zero-Leak Security Architecture:** Physical local confinement for private API keys, custom MCP configurations, and tokens inside local SQLite databases with live memory scrubbing.
- **1,000+ Agent Skills Marketplace:** 1-click physical deployment of production skills into local agent directories across 11 professional domains.
- **Visual MCP Server Orchestrator:** Visual catalog, latency ping testing, and 1-click configuration synchronization for stdio, SSE, and WebSocket MCP servers.
- **Zero-Restart IDE Hot-Switching:** Switch active Google accounts inside running Antigravity IDE, VS Code, Cursor, or Zed sessions via loopback bridge (`127.0.0.1:8765`) without restarting editors or destroying agent execution loops.
- **Protobuf Crash Recovery:** Automatically detects unindexed session transcripts after power cuts or abrupt OS restarts and reconciles IDE conversation history with zero data loss.
- **Apple-Grade Human Interface:** 60fps spring transitions (Framer Motion), progressive windowing / infinite scrolling for 1,000+ cards with 0ms lag (`@tanstack/react-virtual`), MiniView desktop HUD, and native Persian/RTL typography (Vazirmatn).

---

## 🌟 Core Architectural Pillars

### 1. 🛡️ High-Performance Multi-Account AI Quota & Session Proxy
* **Local Axum/Tokio Reverse Proxy (`127.0.0.1:8045`):** High-throughput, non-blocking asynchronous pipeline capable of handling concurrent agent tool calls without thread serialization or deadlock bottlenecks.
* **Tier Telemetry & Multi-Tier Quota Tracking:**
  - Automatically identifies and classifies account subscription tiers: **`PRO`**, **`ULTRA`**, and **`FREE`**.
  - Enforces intelligent model routing (e.g. Claude 3.7 / Sonnet 4-6 routed exclusively to Pro/Ultra accounts; lightweight tasks routed to high-capacity pools).
  - Tracks real-time token quota percentages and calculates rolling **5-hour reset** and **weekly ceiling** countdowns for `gemini-3.1-pro`, `gemini-3-flash`, `claude-sonnet-4-6`, and `imagen-3`.
* **Zero-Downtime Smart Failover:** Automatically shuffles traffic to accounts with the highest available quota score. When rate-limit challenges (HTTP 429) occur, it transparently migrates active requests without breaking running agent loops.
* **Proactive Auto-Warmup:** Probes accounts as soon as their quota window recovers to 100%, eliminating cold-start latencies on fresh sessions.
* **Zero-Downtime Smart Failover:** Automatically shuffles traffic to accounts with the highest available quota score. When rate-limit challenges (HTTP 429) occur, it transparently migrates active requests without breaking running agent loops.
* **Proactive Auto-Warmup & Zero-Latency Probing Engine:**
  - **The Cold-Start Problem:** Standard AI providers and proxy solutions suffer from cold-start latency when quota locks expire, causing initial requests to lag while tokens and endpoints re-validate.
  - **Autonomous Shield Probing:** The moment an account's 5-hour rolling lockout window expires or its weekly ceiling resets, Antigravity Shield automatically dispatches lightweight, zero-overhead probing heartbeats in the background.
  - **100% Instant Readiness:** The account is fully verified, warmed up, and primed for maximum concurrency *before* the user or agent even issues the next prompt.
* **Background Scheduler & System Tray:** Native system tray icon, auto-start upon OS login, persistent background heartbeat daemon, and rich OS desktop notifications.

### 2. 🔒 Zero-Leak Security & Privacy Architecture
* **Strict Physical Local Confinement:** Private API keys, OAuth session secrets, custom rules, and enterprise credentials never leave the host system. Zero telemetry is sent to third-party tracking servers.
* **Built-in Live Memory Zero-Leak Shields:**
  - **Memory Bearer Sanitizer:** Actively scrubs sensitive authorization bearer headers from in-flight logs and telemetry pipelines.
  - **Directory Traversal Guard:** Hardened path validation prevents `../` path injection attacks during `SKILL.md` retrieval and local file reads.
  - **Secret Redaction Filter:** Scans and redacts 12+ patterns of secret keys (e.g., Anthropic keys, OpenAI tokens, AWS secrets) during file scanning.
* **Encrypted SQLite Core:** All account metadata and usage analytics persist locally in `~/.antigravity_shield/` or `%APPDATA%\antigravity-shield\` using encrypted SQLite stores (`proxy.db`, `token_stats.db`, `security.db`).
* **Virtual Device Profile Isolation:** Each authenticated account operates under an isolated, deterministic hardware profile and RFC UUID to prevent upstream cross-account device correlation.

### 3. 🪐 Universal AI Agent Ecosystem & Marketplace (1,000+ Skills)
* **Unified `SKILL.md` Specification:** Standardized procedural knowledge library executable across 20 leading AI agent platforms.

<div align="center">
  <img src="docs/images/agent-ecosystem-marketplace.png" alt="Antigravity Shield Agent Ecosystem Hub" width="100%" style="border-radius: 16px; margin: 18px 0; box-shadow: 0 10px 32px rgba(0,0,0,0.35);">
  <p><em>Figure: Antigravity Shield Ecosystem Hub — 1,000+ curated skills, 11 unified professional domains, live download telemetry, rank glows, and 1-click installer.</em></p>
</div>

* **11 First-Class Domains:**
  1. `Coding & Web` (`coding`): Full-stack engineering, React 19, Next.js 15, TypeScript, Node.js, Swift, Rust, Python, Go.
  2. `Data & Databases` (`data`): PostgreSQL optimization, SQL query tuning, Supabase, Redis, ClickHouse.
  3. `DevOps & Cloud` (`devops`): Docker, Kubernetes, CI/CD pipelines, Cloudflare Workers, Nginx.
  4. `Design & UI/UX` (`design`): High-end agency design, Tailwind CSS, Framer Motion, GSAP, Apple Human Interface.
  5. `Automation & Agents` (`automation`): Agent swarms, workflow automation, Telegram bots, browser automation.
  6. `Architecture & Systems` (`architecture`): Clean Architecture, microservices, distributed systems, DDD.
  7. `Marketing & Growth` (`marketing`): Viral copywriting, algorithmic SEO, conversion psychology, product launch.
  8. `Mobile & Cross-Platform` (`mobile`): React Native, Expo, Flutter, iOS Swift, Android CLI.
  9. `Testing & QA` (`testing`): Playwright, E2E regression, unit test suites, security edge-case auditing.
  10. `Science & Research` (`science`): AlphaFold, NCBI, ChEMBL, PubMed, scientific biostatistics, literature discovery.
  11. `All / Global Index` (`all`): Full search and filter matrix across the entire 1,000+ skill index.
* **1-Click Physical Installation:** Writes skill bundles directly to native agent configuration directories:
  - Windows: `%USERPROFILE%\.gemini\config\skills\<skill-name>\SKILL.md`
  - macOS/Linux: `~/.gemini/config/skills/<skill-name>/SKILL.md`
* **1-Click Slash Command Copier:** Instantly copy sanitized commands (e.g., `/find-skills`, `/animate`, `/seo`, `/apple-design`) into agent prompts.
* **Bilingual Documentation Viewer:** Interactive modal featuring tabbed English and Persian (`fa`) documentation, formatted warning alerts, code samples, and live markdown preview.
* **Broad Agent Platform Compatibility:** Native support for **Google Antigravity**, **Claude Code CLI**, **Cursor**, **Codex**, **Gemini CLI**, **Windsurf**, **Zed**, **GitHub Copilot**, **Cline**, **Roo Code**, **Goose**, **OpenCode**, and 15+ modern AI coding agents.

### 4. 🔌 Visual MCP (Model Context Protocol) Server Management
* **Visual Server Catalog:** Manage stdio, SSE, and WebSocket MCP servers in a single unified dashboard.
* **Live Health & Latency Testing:** 1-click round-trip ping measurement to verify server reachability and tool readiness.
* **Automated Config Sync:** Seamlessly synchronizes MCP configurations across local IDE config files (`claude_desktop_config.json`, `antigravity_mcp.json`).
* **Pre-Flight Binary Validation:** Automatically validates required binaries (e.g. `npx`, `uvx`, `docker`) and prompts for missing environment variables before launch.

### 5. 📜 System Rules & Personas Governance
* **Scoped Rule Management:** Define and orchestrate prompt guidelines across Global (`~/.gemini/config/`) and Workspace-specific levels.
* **Dynamic Trigger Modes:** Support for both `always_on` foundational rules and `model_decision` specialized rules.
* **Non-Destructive Backups:** Safely preserves original system prompts with automated `.bak` rollback checkpoints.

### 6. 🎨 Apple-Grade Human Interface Design & Persian RTL Engine
* **Fluid Spring Physics:** Buttery-smooth transitions and micro-interactions powered by Framer Motion.
* **Virtual Windowing Engine:** Seamless rendering and instant filtering of 1,000+ cards using `@tanstack/react-virtual` with zero frame drops.
* **MiniView Desktop HUD:** Compact floating widget (down to 110x52) with an always-on-top toggle, active account switcher, and live quota meters designed to float over code editors.
* **Native RTL & Vazirmatn Engine:** 1-click non-destructive typography patch for Antigravity IDE and desktop UI, enforcing Persian RTL alignment while keeping code blocks and monospace tokens left-to-right.

### 7. 🔌 Zero-Restart Multi-IDE Hot-Switching & Crash Recovery
* **Loopback Toolkit Bridge (`127.0.0.1:8765`):**
  - **Zero-Restart Seamless Account Swapping:** In legacy environments, switching AI accounts requires terminating VS Code or Antigravity IDE, closing open workspace buffers, killing terminal jobs, and destroying long-running agent reasoning trajectories.
  - **Hot Token Re-Binding:** Antigravity Shield routes editor authentication requests through its local loopback bridge on port `8765`. Switching active Google accounts instantaneously updates credentials underneath the IDE without dropping WebSocket streams or killing processes.
* **Autonomous Brain Scanner:** Rust file watcher polls `~/.gemini/antigravity/brain/` every 3 seconds to catalog prompt/response tokens into SQLite analytics.
* **Crash-Resilient State Injection:** Reconstructs unindexed agent conversations after sudden power cuts or OS crashes by synthesizing Protobuf trajectory descriptors into the IDE's internal state database (`state.vscdb`).

---

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph Clients["Supported Development Environments & Agent CLIs"]
        IDE["Antigravity IDE / VS Code / Cursor / Zed"]
        ClaudeCLI["Claude Code CLI (Anthropic Protocol)"]
        OpenAIClients["Cursor / Windsurf / Cherry Studio (OpenAI Protocol)"]
        AgentMarket["Agent Fleet (Claude, Gemini, Codex, Copilot, Cline)"]
    end

    subgraph ToolkitBridge["Antigravity Toolkit Loopback Bridge (Port 8765)"]
        HotSwitch["Zero-Restart Hot Switcher"]
        SessionSync["Active Editor State & Buffer Preserver"]
    end

    subgraph ShieldCore["Antigravity Shield Core Engine (Tauri 2 / Rust Axum :8045)"]
        Router["Axum Protocol Router: /v1/messages & /v1/chat/completions"]
        SecurityShield["Zero-Leak Shield: Directory Traversal Guard & Memory Filter"]
        Dispatcher["Intelligent Account Dispatcher: Tier Telemetry & Quota Balancer"]
        Warmup["Auto-Warmup Engine (100% Reset Probing)"]
        HealthPulse["Network Health Pulse & Geoblock Radar"]
        BrainWatcher["Brain Transcript Scanner (~/.gemini/antigravity/brain/)"]
        SkillsEngine["Universal Skills Manager (~/.gemini/config/skills/)"]
        McpManager["MCP Server Orchestrator (stdio / sse / ws)"]
    end

    subgraph LocalStorage["Zero-Leak Local SQLite Storage"]
        DB_Tokens[(token_stats.db)]
        DB_Proxy[(proxy.db)]
        DB_Security[(security.db)]
    end

    subgraph Upstream["Official Cloud Infrastructure"]
        GoogleAPI["Official Google Production Endpoints (Zero Sandbox)"]
    end

    %% Client Connections
    IDE <-->|WebSocket / IPC| ToolkitBridge
    ToolkitBridge <-->|Loopback Bridge| ShieldCore
    ClaudeCLI -->|POST /v1/messages| Router
    OpenAIClients -->|POST /v1/chat/completions| Router
    AgentMarket <-->|Physical Skill Deployment| SkillsEngine

    %% Internal Core Flows
    Router --> SecurityShield
    SecurityShield --> Dispatcher
    Dispatcher -->|Virtual DeviceProfile + Auth Bearer| GoogleAPI
    Warmup -.->|Keep-Alive Warmup| GoogleAPI
    HealthPulse -.->|Proactive Latency RTT| GoogleAPI

    %% Local Telemetry & Storage
    BrainWatcher -->|Parse Prompt/Completion Tokens| DB_Tokens
    Dispatcher -->|Account Quotas & Rotations| DB_Proxy
    SecurityShield -->|Encrypted Credentials| DB_Security
```

---

## 📸 Interface Showcase

| 💓 System & AI Health Pulse Radar | 🎛️ Multi-Account Quota Grid & Reset Windows |
| :---: | :---: |
| <a href="docs/images/dashboard-overview.png"><img src="docs/images/dashboard-overview.png" alt="Dashboard Overview & Health Pulse" width="460"></a> | <a href="docs/images/accounts-quota-grid.png"><img src="docs/images/accounts-quota-grid.png" alt="Account Quota Grid & Reset Monitor" width="460"></a> |
| <sub>Real-time upstream probe, proxy status & pool summary</sub> | <sub>Side-by-side Gemini 3.1 Pro, 3 Flash & Claude 5H/weekly resets with Tier badges</sub> |

| 📊 53-Week Token Activity Heatmap | 🇮🇷 Native RTL & Vazirmatn Font Patch |
| :---: | :---: |
| <a href="docs/images/token-stats-heatmap.png"><img src="docs/images/token-stats-heatmap.png" alt="Token Stats Heatmap" width="460"></a> | <a href="docs/images/vazirmatn-rtl-patch.png"><img src="docs/images/vazirmatn-rtl-patch.png" alt="Native RTL & Vazirmatn Font Support" width="460"></a> |
| <sub>Annual activity calendar & multi-IDE token burn telemetry</sub> | <sub>1-Click non-destructive Persian typography patch for Antigravity & IDE</sub> |

---

## 🪐 Universal Agent Ecosystem & Marketplace

Antigravity Shield includes a fully integrated, high-speed marketplace housing **over 1,000 production-ready skills** compatible with all major AI coding agents.

```
~/.gemini/config/skills/
├── animate/
│   └── SKILL.md
├── postgres-best-practices/
│   └── SKILL.md
├── react-best-practices/
│   └── SKILL.md
└── seo/
    └── SKILL.md
```

### 11 Specialized Skill Domains
| Domain | Category Slug | Focus Areas | Example Skills |
| :--- | :--- | :--- | :--- |
| 💻 **Coding & Web** | `coding` | React 19, Next.js 15, TypeScript, Node.js, Go, Rust, Swift | `react-best-practices`, `nodejs-backend-patterns` |
| 🗄️ **Data & Databases** | `data` | PostgreSQL, SQL query optimization, Supabase, Redis | `postgres-best-practices`, `sql-optimization-patterns` |
| ⚙️ **DevOps & Cloud** | `devops` | Docker, Kubernetes, Nginx, CI/CD, Cloudflare Workers | `iranian-services-verification`, `docker-mastery` |
| 🎨 **Design & UI/UX** | `design` | Apple Human Interface, Framer Motion, Tailwind, Micro-interactions | `apple-design`, `motion-framer`, `emil-design-eng` |
| 🤖 **Automation & Agents** | `automation` | AI Agent swarms, Telegram Bot API, Browser automation | `telegram-bot-builder`, `perpetual-engine` |
| 🏛️ **Architecture & Systems** | `architecture` | Distributed systems, Clean Architecture, DDD, API scalability | `backend-architect`, `matt-murphy-production-engineer` |
| 📈 **Marketing & Growth** | `marketing` | Product launch strategies, viral psychology, conversion rate | `marketing-psychology`, `marketing-ideas` |
| 📱 **Mobile & Cross-Platform** | `mobile` | React Native, Expo, Android CLI, iOS Swift 6 concurrency | `animate-expo`, `android-cli`, `write-swift` |
| 🧪 **Testing & QA** | `testing` | Playwright, edge-case analysis, E2E verification suites | `code-review`, `skills-code-review` |
| 🔬 **Science & Research** | `science` | AlphaFold, PubMed, ChEMBL, UniProt, Bio-statistics | `alphafold-database-fetch-and-analyze`, `pubmed-database` |
| 🌐 **All / Universal Index** | `all` | Global multi-dimensional search across all registered skills | Full catalog lookup with verified rosette filters |

---

## 🔌 Quick Integration

### 1. Claude Code CLI (Anthropic Protocol)
Launch the local API proxy (default port: `8045`), then run in your terminal:

**macOS / Linux:**
```bash
export ANTHROPIC_API_KEY="sk-antigravity"
export ANTHROPIC_BASE_URL="http://127.0.0.1:8045"
claude
```

**Windows PowerShell:**
```powershell
$env:ANTHROPIC_API_KEY = "sk-antigravity"
$env:ANTHROPIC_BASE_URL = "http://127.0.0.1:8045"
claude
```

### 2. Cursor / Windsurf / Cherry Studio / NextChat (OpenAI Protocol)
* **API Base URL:** `http://127.0.0.1:8045/v1`
* **API Key:** `sk-antigravity` (or your customized key in Shield Settings)
* **Supported Model Identifiers:**
  - `gemini-3-pro-high` (Primary reasoning powerhouse)
  - `gemini-3-flash` (Ultra-low latency coding model)
  - `gemini-3.1-pro-preview` (Extended thinking & deep code review)
  - `gemini-3.1-flash-image` (High-definition vision & multimodal analysis)
  - `claude-sonnet-4-6` / `claude-3-7-sonnet` (Hybrid thinking & execution)
  - `claude-opus-4-6-thinking` (Architectural synthesis)

### 3. Python SDK (`openai` Client)
```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-antigravity",
    base_url="http://127.0.0.1:8045/v1"
)

response = client.chat.completions.create(
    model="gemini-3-flash",
    messages=[
        {"role": "system", "content": "You are Juliet, Principal Systems Architect."},
        {"role": "user", "content": "Verify my distributed rate-limiter in Redis."}
    ],
    temperature=0.2
)

print(response.choices[0].message.content)
```

### 4. Direct cURL Request
```bash
curl http://127.0.0.1:8045/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-antigravity" \
  -d '{
    "model": "gemini-3-flash",
    "messages": [{"role": "user", "content": "Explain Zero-Leak local isolation in 2 sentences."}]
  }'
```

---

## 🛠️ Tech Stack

| Layer | Technology | Rationale & Responsibility |
| :--- | :--- | :--- |
| **Desktop Shell** | **Tauri 2.x** (`tauri-apps/api v2`) | Lightweight native desktop container with minimal memory footprint (~45MB RAM). |
| **Core Gateway Backend** | **Rust** (Axum, Tokio, Hyper, Tower) | High-performance asynchronous HTTP engine with non-blocking concurrency and native thread pools. |
| **Frontend Framework** | **React 19** + **TypeScript** | Bleeding-edge reactive UI architecture leveraging React 19 state concurrency and strict typing. |
| **Styling & Motion** | **Tailwind CSS** + **Framer Motion 11** | Apple-grade spring physics, dark/light themes, and ergonomic typography. |
| **Virtualization** | **@tanstack/react-virtual 3.x** | Zero-lag progressive windowing supporting 1,000+ skill cards rendered at 60fps. |
| **Persistence & State** | **Rusqlite (SQLite)** + **Zustand 5** | Zero-leak local encrypted storage and reactive atomic UI state management. |
| **Internationalization** | **i18next** (`react-i18next`) | Native bilingual support across English and Persian with automatic RTL layout switching. |

---

## 📦 Installation & Setup

### Option 1: Pre-Built Binaries (Recommended)
Download the latest verified release from [GitHub Releases](https://github.com/doctorguidance/antigravity-shield/releases/latest):
* **Windows (x64):** `Antigravity.Shield_5.22.0_x64-setup.exe` (or portable zip)
* **macOS:** `.dmg` (Universal binary: Apple Silicon M-Series & Intel x64)
* **Linux:** `.deb` or `.AppImage`

> [!TIP]
> **Streaming In-App Auto-Updater:** Installed desktop instances automatically check for new releases with streaming download progress bars, cryptographic signature verification, and seamless detached installer handoff.

### Option 2: Build From Source

#### Prerequisites:
- **Node.js:** `v20.x` or `v22.x` (LTS recommended)
- **Rust Toolchain:** `1.78+` (via `rustup`)
- **Build Tools:** Visual Studio C++ Build Tools (Windows) / Xcode CLI (macOS) / `build-essential` (Linux)

#### Build Steps:
```bash
# 1. Clone the repository
git clone https://github.com/doctorguidance/antigravity-shield.git
cd antigravity-shield

# 2. Install frontend dependencies
npm install

# 3. Launch in development mode (with Hot Module Replacement)
npm run tauri dev

# 4. Compile optimized production release binary
npm run build
npm run tauri build
```

### Option 3: Headless Server (Docker)
For deployment on remote development servers or headless containers:

```bash
docker run -d --name antigravity-shield \
  -p 8045:8045 \
  -e API_KEY=sk-antigravity \
  -e WEB_PASSWORD=your-secure-password \
  -v ~/.antigravity_shield:/root/.antigravity_shield \
  doctorguidance/antigravity-shield:latest
```

---

## ⚖️ License & Attribution

- **License:** Distributed under the **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (CC BY-NC-SA 4.0)**. Intended strictly for personal and non-commercial development use.
- **Upstream Heritage:** Antigravity Shield is an independently maintained, hardened distribution evolved from the open-source project [lbjlaq/Antigravity-Manager](https://github.com/lbjlaq/Antigravity-Manager) created by [lbjlaq](https://github.com/lbjlaq) and its contributors. All upstream copyrights, git histories, and contributor credits are preserved.
- **Privacy & Security Commitment:** Zero user credentials, API keys, or conversation histories are ever transmitted outside your local machine.

---

<div align="center">
  <p><strong>Antigravity Shield</strong> — Hardened for Zero Downtime, Uncompromising Privacy, and Agentic Coding Workflows.</p>
  <p>Copyright © 2024–2026 DoctorGuidance & Antigravity Shield Contributors.</p>
</div>
