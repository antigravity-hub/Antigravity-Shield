# 📝 Changelog

> Complete version history for Antigravity Shield. Return to project home at [README_EN.md](README_EN.md).

*   **Version History**:
    *   **v5.7.2 (2026-09-12)**:
        -   **[CI/CD & Security] Automated Minisign Key Derivation & Auto-Update Signature Resolution**:
            -   **Dynamic Minisign Public Key Alignment**: Configured GitHub Actions `release.yml` to automatically derive the exact matching Minisign public key directly from repository secret `TAURI_SIGNING_PRIVATE_KEY` during Windows packaging, eliminating key mismatch errors and guaranteeing cryptographic `.sig` artifact generation.
            -   **Comprehensive Updater Artifact Collection**: Expanded release packaging patterns to capture updater `.sig` signatures across NSIS and updater bundle directories, ensuring `updater.json` is always populated with valid verification signatures.
            -   **Enhanced In-App Signature Error Fallback**: Added graceful handling in `Settings` and `UpdateNotification` for Minisign verification anomalies, providing informative user messaging and immediate direct download fallbacks.
            -   **Optimized CI Rust Compilation Matrix**: Realigned `check-rust` workflow matrix to `ubuntu-latest` for fast, reproducible toolchain checks without runner MSVC link dependencies.
    *   **v5.7.1 (2026-09-12)**:
        -   **[CI/CD & Release Pipeline] Resilient Release Publishing & In-App Updater Reliability**:
            -   **Decoupled Release Artifact Packaging**: Hardened `release.yml` so that packaging and publishing of Windows NSIS installers and `updater.json` proceed independently of secondary platform status, guaranteeing immediate availability of in-app auto-update assets.
            -   **Client In-App Updater Graceful Handling**: Enhanced `UpdateNotification` and `Settings` with robust error isolation around native update checks, preventing unexpected modal closures and smoothly guiding users to direct downloads if artifacts are still pending.
    *   **v5.6.2 (2026-09-12)**:
        -   **[CI/CD & Release Pipeline] Updater Minisign Public Key Alignment & Automated Build Fallback**:
            -   **Restored Authoritative Minisign Key**: Realigned `plugins.updater.pubkey` in `src-tauri/tauri.conf.json` with the repository's active signing key secret (`BEF5CF7BDA5F866F`), resolving the release build signature verification failures that blocked releases post-v5.4.0.
            -   **Automated Windows Build Fallback**: Enhanced GitHub Actions `release.yml` with automated retry logic that detects signature/minisign key mismatches and gracefully falls back to non-updater NSIS installer builds, ensuring 100% reliable release artifact generation.
            -   **SSoT Version Synchronization to v5.6.2**: Synchronized `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock` under the single source of truth versioning system.
    *   **v5.6.1 (2026-09-11)**:
        -   **[Account Activation & Multi-Target Exclusivity] Strict Target Exclusivity & State Synchronization**:
            -   **Single-Target Exclusivity Guarantee**: Enforced strict single-target assignment (`platform`, `ide`, `cli`) where activating an account on any target immediately supersedes any previously active account for that target, preventing desynchronization.
            -   **Eliminated Target Stale Duplication Race Condition**: Replaced concurrent state updates with sequenced single-source-of-truth updates (`fetchActiveTargetAccounts` -> `fetchCurrentAccount` -> `fetchAccounts`).
            -   **Removed Erroneous Fallback Injection**: Eliminated legacy fallback logic that erroneously re-injected active targets onto accounts when `targetAccounts` was stale.
            -   **Precise Action Controls & Badge Disambiguation**: Updated `AccountActionControls` to explicitly pass `'platform'` target on switch, and updated `AccountCard` badge presentation to strictly reflect verified active environment targets.
        -   **[Process Management] Windows Graceful Process Shutdown & Session Preservation**:
            -   **Graceful Window Close Protocol**: Implemented non-blocking `WM_CLOSE` window dispatch (`win_graceful::post_wm_close_to_windows`) across both current and default desktop sessions on Windows before initiating fallback termination, ensuring IDE conversation history, unsaved edits, and workspace state are safely flushed to disk.
    *   **v5.6.0 (2026-09-10)**:
        -   **[Architecture & Tooling] Single Source of Truth (SSoT) Version Synchronizer**:
            -   **Authoritative Version Synchronization**: Established `package.json` as the Single Source of Truth (SSoT) across the entire platform. Implemented automated synchronizer `scripts/sync_version.mjs` that updates `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock` in a single command.
            -   **One-Command Version Bumper**: Added `scripts/bump_version.mjs` and npm scripts (`npm run version:bump <patch|minor|major|x.y.z>` and `npm run version:sync`), integrated directly into pre-build hooks to eliminate version drift.
            -   **Vite Compile-Time Injection**: Injected `__APP_VERSION__` into Vite's bundler and centralized frontend version consumption via `src/constants/version.ts`, removing hardcoded fallback versions across `NavLogo`, `MiniView`, and `Settings`.
        -   **[Codebase Organization & Deduplication] Unified Constants & Quota Cycle Engine**:
            -   **Global Layout Tokens**: Centralized responsive container layout classes (`CONTAINER_MAX_WIDTH`) in `src/constants/layout.ts`, eliminating duplicate class definitions across 6 major platform pages.
            -   **Unified Quota Cycle Calculations**: Extracted duplicated 30-line bucket scanning loops from `WeeklyCountdown`, `AccountTable`, and `AccountCard` into pure, reusable functions in `src/utils/quota.ts` (`getAccountWeeklyReset` and `getAccountFiveHourReset`).
            -   **Cross-Platform Clipboard Standardization**: Replaced raw `navigator.clipboard.writeText` calls in Settings and Error Dialogs with the robust fallback utility `copyToClipboard`.
        -   **[Accounts & MiniView UX] Intelligent Multi-Tier Account Sorting & MiniView Window Polish**:
            -   **Smart Account Prioritization**: Enhanced `getAccountQuotaScores` to sort usable accounts first, followed by remaining 5H quota percentage, weekly fraction, and cycle countdown hours.
            -   **MiniView Ergonomics**: Added clamped safe sizing (320px width, bounded height), Escape key shortcut to return to full view, header double-click to maximize, and smooth drag handling.
    *   **v5.5.0 (2026-09-10)**:
        -   **[Sync Architecture] Hybrid Adaptive Jittered Sync & Live Data Freshness Indicator**:
            -   **Humanized Anti-Abuse Jittering**: Replaced rigid interval timers with a recursive randomized scheduler (+15s to +45s dynamic jitter) to eliminate automated request fingerprinting against Google Cloud Code endpoints.
            -   **Prioritized Target Sync & Staggered Fleet Refresh**: Targeted background sync directly to active environment accounts (Platform/IDE/CLI) while executing full fleet quota sweeps every 3rd cycle to eliminate network overhead.
            -   **Power & Tab Visibility Awareness**: Pauses periodic refresh cycles when the window is hidden/minimized to conserve local resources and network bandwidth.
            -   **Live Data Freshness Badge**: Added an animated real-time status pill in the Accounts toolbar showing upstream sync timestamp ("Synced: Just now", "Synced: Xm ago") with visual heartbeat dot.
            -   **Manual Refresh Rate-Limiter**: Added a 20-second cooldown on the manual refresh trigger to prevent upstream rate limits.
        -   **[UI & Layout Hardening] Wide-Screen Workspace Expansion & Column Rebalance**:
            -   **1750px Workspace Container**: Expanded max container constraint from 1280px (`max-w-7xl`) to `max-w-[1720px] 2xl:max-w-[1850px]` across Navbar, Accounts, Dashboard, Proxy, and Settings, eliminating black sidebars on modern displays.
            -   **Expanded Model Quota Column**: Broadened Model Quota column width to `min-w-[360px] xl:min-w-[420px] 2xl:min-w-[480px]`, giving model name badges over 3× more horizontal space for full legibility.
            -   **Sleek Actions & Reset Columns**: Compacted the Actions column from 210px to 165px with tighter button paddings, and streamlined Weekly Reset stepper squares to 14px (`w-3.5 h-3.5`).
    *   **v5.4.1 (2026-09-10)**:
        -   **[Branding & Identity] Modern Shield Visual Identity & Asset Standardization**:
            -   **New Shield Brand Logo**: Integrated new high-resolution shield brand logo across the UI navbar header, browser favicon, and system icons.
            -   **Full Platform Asset Generation**: Regenerated multi-resolution Windows ICO, macOS ICNS, System Tray icons (32x32 & 64x64), and desktop app packages.
            -   **Clean Workspace**: Purged outdated squircle artifacts and legacy nested upstream directories.
        -   **[Updater & Reliability] Resilient Signature Verification & Graceful Fallback**:
            -   **Cryptographic Keypair Update**: Configured new Minisign public key for secure in-app update delivery.
            -   **Graceful Auto-Update Fallback**: Implemented proactive fallback in update dialogs to smoothly transition to direct download if signature validation encounters unexpected formatting or missing keys.
    *   **v5.4.0 (2026-09-10)**:
        -   **[Major Feature & Multi-Target Core] Multi-Target Concurrent Activation Across Environments**:
            -   **Independent Environment Activation**: Supports simultaneous and independent active states for **Antigravity Platform**, **Antigravity IDE**, and **Antigravity CLI (`agy`)** across single or different accounts without dropping active sessions.
            -   **Vibrant Active Indicators**: Enhanced active state UX with emerald green containers, glowing active inner borders, and pulsating corner badges per target.
        -   **[Table & Quota Architecture] Dual Countdown Columns & Fixed Model Quota Explorer**:
            -   **Simultaneous 5H & Weekly Counters**: Replaced top filter switch with dedicated side-by-side columns for 5-Hour rolling resets and Weekly resets.
            -   **Clean Model Column**: Model Quotas column now strictly displays AI model allocations, fully restoring the "Show All Quotas" toggle functionality.
            -   **Balanced Column Spacing**: Optimized column widths for enhanced data density and legibility across all screen resolutions.
        -   **[Usability & Customization] Auto-Sort, Column Drag-and-Drop & Custom Views**:
            -   **Auto-Sort by Quota**: Added automatic sorting engine prioritizing accounts with highest remaining 5H quota, followed by weekly quota.
            -   **Interactive Column Reordering**: Added drag-and-drop support for table column headers with persistent layout memory in `localStorage`.
            -   **Last Used Column Visibility**: Added customizable visibility toggle for the Last Used column (default hidden).
        -   **[Fixes & Dialog Polish] Accurate Refresh All Confirmation**:
            -   **Fixed Refresh Warning**: Updated batch refresh modal to cleanly distinguish between single account, batch selection, and full account fleet refresh without referencing "current account".
    *   **v5.2.0 (2026-09-09)**:
        -   **[Major Feature & Visual Analytics] Annual GitHub-Style Token Heatmap & Granular Time Filtering**:
            -   **Annual Activity Heatmap**: Implemented a full 53-week × 7-day contribution-style calendar heatmap in `TokenHeatmap.tsx` featuring 5 dynamic intensity levels, interactive tooltips, year picker, and daily/weekly view toggling.
            -   **Click-to-Inspect Filtering**: Clicking any calendar cell instantly filters granular token analytics and model/account breakdowns down to that specific date.
            -   **Extended Time Ranges**: Added 1 Month (`30d`), 1 Year (`365d`), and Custom Date Range picker with dual date inputs.
            -   **Target Source Filter**: Added instant filtering tabs across **All Sources**, **Antigravity IDE**, **Antigravity Platform**, and **Antigravity CLI (`agy`)**.
        -   **[Performance & Stability] Elimination of Stale Closure & UI Flickering**:
            -   **Silent Reactive Sync**: Fixed background listener (`live_token_stats_update`) using mutable references to preserve active filter state, eliminating chart unmounting and layout reset glitches during live token synchronization.
        -   **[Quota & Multi-Account UX] 5-Hour Quota Window & 7-Day Countdown Stepper Alignment**:
            -   **Strict LTR 7-Day Stepper**: Reordered countdown stepper numbers from Left-to-Right (`[1, 2, 3, 4, 5, 6, 7]`) with `dir="ltr"` so expired days empty from the right. Remaining active days now match glowing border accents, while current active day retains high-contrast white text.
            -   **5H Quota Separation**: When 5H mode is active, account cards and table rows dynamically display rolling 5-hour quota gauges and reset timers instead of 7-day weekly steppers.
            -   **Refresh Cancellation & Target Switch**: Added an active pulsating Stop button allowing users to cancel long-running account quota refreshes at any moment, and removed blocking restrictions preventing app target switching during refresh.
        -   **[i18n & Localization] Comprehensive Language Parity**:
            -   **Full Internationalization**: Fully translated transcript recovery feedback banners, source filters, heatmap legends, and refresh cancellation labels across English (`en.json`), Persian (`fa.json`), and Chinese (`zh.json`).
        -   **[Release & Cleanup] Clean UI & Upgraded Client Bundling**:
            -   **Clean UI**: Removed deprecated Telegram card component and fixed potential update check timeouts.
    *   **v5.1.0 (2026-09-09)**:
        -   **[Major Feature & Token Analytics] Dual-Source Token Analytics, Live Watcher & Multi-Target Separation**:
            -   **Real-Time Background Watcher**: Added an autonomous, ultra-lightweight background file watcher in Rust (`start_live_watcher`) that monitors conversation updates every 3 seconds and emits real-time events to the UI without requiring manual scan clicks.
            -   **3-Tier Target Separation**: Intelligently segments token usage across 3 distinct targets: **Antigravity IDE**, **Antigravity CLI (`agy`)**, and **Local Gateway / Proxy (port 8045)**.
            -   **Historical Disk Scanner**: Added native Rust `brain_scanner` engine to automatically scan local conversation transcripts (`~/.gemini/antigravity/brain/`), recover historical token usage from Antigravity IDE direct conversations, and persist them into `token_stats.db` with incremental deduplication.
            -   **Proxy Stream Bug Fixes**: Fixed Claude SSE `input_tokens` capture inside `message_start` events, prevented token overwriting across stream deltas, and eliminated trailing `usageMetadata` drops before `[DONE]` in OpenAI streaming mapper.
            -   **Third-Party Provider Resilience**: Added fallback identity so token tracking never drops requests missing `X-Account-Email`.
            -   **Interactive Dashboard**: Added "Scan History" button, live pulsating synchronization badge (`Live IDE / CLI Sync`), and token recovery feedback banner to Token Stats page.
        -   **[Branding & Asset Alignment] Official App Icon Identities**:
            -   **Official Icon Set**: Aligned Antigravity IDE and Platform branding icons across `/public` and `/src/assets` to match official product visual identities.
        -   **[Quota & Multi-Account] Stabilize Model Category Selection & Prioritize 5h Quota**:
            -   **Active Quota Prioritization**: Prioritized 5-hour quota windows for active accounts and stabilized model category selector.
        -   **[OAuth & UX Enhancement] Redesign Success Screen & Target Badges**:
            -   **Redesigned OAuth Screen**: Re-architected OAuth success page with active target badges and weekly countdown stepper.
        -   **[Security & Dependencies] Resolve Dependabot Alerts**:
            -   **Upgraded Dependencies**: Resolved security alerts across `quinn`, `rustls-webpki`, `colord`, `tauri`, `tar`, `serde_with`, and `rand`.
    *   **v5.0.8 (2026-09-09)**:
        -   **[Global Auto-Updater & Pipeline Fix] Sanitize Asset File Naming to Eliminate 404 Errors**:
            -   **Normalized Release Assets**: Replaced all whitespace in Windows installer package names with dots (`Antigravity.Shield_${VERSION}_x64-setup.exe`), fully aligning with GitHub Releases API sanitization policies and guaranteeing that `updater.json` download links match published assets with 100% accuracy.
            -   **Resilient Fallback Mechanism**: Added frontend failure recovery in `Settings.tsx` and `UpdateNotification.tsx` to automatically redirect users to official manual download endpoints if background automated downloads encounter edge network restrictions.
            -   **Comprehensive Platform Verification**: Ran full 4-Tier E2E test suite (64/64 tests passing) and adversarial resilience challenge suite (46/46 tests passing) verifying OAuth concurrency, context deduplication, tool leak recovery, and fingerprint isolation.
    *   **v5.0.7 (2026-09-09)**:
        -   **[Documentation & Discovery] Auto-Scan Google AI Docs & Dynamic Model Ranking**:
            -   **Automated Doc Scanner**: Integrated scheduled background discovery scanning official Google AI documentation every 6 hours to dynamically index and rank emerging model releases.
            -   **SemVer Dynamic Model Ranking**: Reordered catalog and model proxies dynamically according to semantic version precedence.
        -   **[Installer & UI Fix] NSIS Radio Text Layout & Complete Language String Set**:
            -   **Resilient Upgrade Logic**: Added disk existence checks for `uninstall.exe` and automatic running-process termination via custom template; if previous uninstaller files are missing or deleted, setup smoothly falls back to direct installation rather than trapping users in an abort dialog.
            -   **Single-Line Radio Labels**: Shortened NSIS upgrade option label to fit cleanly within standard single-line height controls, eliminating text overlap and visual truncation.
            -   **Comprehensive Language Constants**: Populated all 27 standard NSIS language strings (including `unableToUninstall`, `appRunning`, and `deleteAppData`), completely preventing empty alert dialogs.
        -   **[CI/CD & Workflows] Node 24 Migration & Clean Release Titles**:
            -   **Node.js 24 Execution**: Upgraded all CI and release pipeline jobs to Node.js 24 runtime.
            -   **Clean Release Naming**: Formatted release titles to clean `vX.Y.Z` tags without duplicate prefixes.
    *   **v5.0.4 (2026-09-08)**:
        -   **[Branding & Identity] Align Rust Package & Binary Name as Antigravity Shield**:
            -   **Unified Project Identity**: Changed core Rust package and binary name from legacy `antigravity-tools` to `antigravity-shield` (`antigravity_shield_lib`), ensuring compiled executables directly reflect project branding (`antigravity-shield.exe`).
            -   **Synchronized Container Runtime**: Updated Dockerfile entrypoint and binary paths to `/app/antigravity-shield`.
        -   **[Automation] Dynamic Model Quota Discovery & Zero Hardcoding**:
            -   **Live Server Display Names**: Completely eradicated static hardcoded labels (`Gemini 3 Flash`, `G3 Flash`, etc.). Quota display names now dynamically resolve from Google's live server endpoint (`cloudcode-pa.googleapis.com`).
            -   **Adaptive Short Labels**: Added `getModelShortDisplayName` to smartly format model identifiers for compact dashboard and account rows (e.g. `G3.1 Flash`, `G3.1 Pro`).
        -   **[Assets & UX] Official App Switcher Logos & Reassuring NSIS Upgrade**:
            -   **Official Target App Icons**: Integrated official high-resolution branding logos for Antigravity IDE, Agentic, and CLI into app switcher controls.
            -   **Clear NSIS Upgrade Screen**: Modernized installer dialog text to clearly emphasize that upgrading preserves all user data, accounts, and configuration.
    *   **v5.0.3 (2026-09-08)**:
        -   **[Major Feature] Native In-App Auto-Updater & Live Download Progress (Settings)**:
            -   **Integrated In-App Updater Engine**: Fully integrated `@tauri-apps/plugin-updater` directly into Settings, enabling one-click checks for newer versions, live status indicators, and background downloading.
            -   **Real-Time Download Progress Bar**: Added a visual percentage progress bar reflecting real-time download and installation chunks directly within Settings and modal banners.
            -   **One-Click Restart & Apply**: Added a prominent "Restart & Install" button triggering immediate app restart via Tauri's native relaunch API once the update is downloaded.
            -   **Dynamic Manual Download Links**: Eliminated all static/hardcoded links; download URLs now dynamically resolve directly to official GitHub Release assets (`doctorguidance/antigravity-shield/releases/latest`).
            -   **Unified Notification Actions**: Added manual download fallback action buttons to `UpdateNotification.tsx` across both available update and network error states.
            -   **Complete Localization**: Added full English (`en.json`) and Chinese (`zh.json`) translation strings for all updater states, progress bars, and restart buttons.
        -   **[Release & CI Fix] Strict Version Tag & Asset Synchronization (Resolving v5.0.1 Naming Mismatch)**:
            -   **Release Artifact Alignment**: Resolved the issue where release `v5.0.1` generated binaries labeled `5.0.0`. The release pipeline now dynamically synchronizes the release tag into `package.json`, `tauri.conf.json`, and `Cargo.toml`.
            -   **Correct Windows Setup Asset**: Generated Windows NSIS installer is now accurately tagged and named (e.g. `Antigravity.Shield_5.0.3_x64-setup.exe`).
            -   **Accurate updater.json Manifest**: Formatted updater metadata and cryptographic signatures to reference exact matching version filenames.
        -   **[CI/CD Optimization] High-Efficiency Pipeline & 90%+ Resource Savings**:
            -   **Focused Windows Production Runner**: Streamlined release builds exclusively for Windows NSIS installers, safely commenting out heavy macOS (ARM64/Intel/Universal) and Linux jobs to prevent high quota consumption (macOS 10x multiplier).
            -   **Node.js 22 Runtime Upgrade**: Upgraded CI runner environment from Node.js 20 to Node.js 22, eliminating all deprecation warnings.
            -   **Disabled Inactive GitHub Pages**: Deactivated the unconfigured `deploy-pages.yml` workflow, eliminating automated exit code failures on `main`.
            -   **Streamlined Daily CI & CodeQL**: Moved CodeQL analysis to a weekly Sunday background schedule and lightweighted daily CI checks, cutting commit build times to under 2 minutes.
        -   **[Installer] Custom Directory & Multi-Drive Path Selection (Inherited from v5.0.1)**:
            -   Configured NSIS `installMode: "both"` to grant users complete freedom to select custom installation drives/folders (e.g. `D:\...`) without administrator permission blocks or setup aborts.
    *   **v5.0.1 (2026-09-07)**:
        -   **[Installer Fix] NSIS Custom Directory & Permission Abort Resolution**:
            -   Fixed installation failure when users selected non-default directories or lacked root administrator privileges by switching NSIS installer mode to `installMode: "both"`.
        -   **[CI & Maintenance] Dependency Caching & Repository Synchronization**:
            -   Introduced Rust dependency caching for Windows runners and synchronized release metadata and endpoints to `DoctorGuidance/Antigravity-Shield`.
    *   **v5.0.0 (2026-09-07)**:
        -   **[Release] Antigravity Shield v5.0.0 - Hardened Enterprise AI Account Manager & Gateway**:
            -   **Full Antigravity Shield Enterprise Rebranding**: Complete UI/UX, localized strings, Settings, about information, and package metadata overhaul from legacy Antigravity Tools to DoctorGuidance / Antigravity Shield.
            -   **Security Hardening & CodeQL Compliance**: Eliminated CWE-312 / CWE-359 clear-text storage alerts via authenticated cipher storage layer (`secureStorage.ts`) for browser tokens and key managers. Sanitized test harnesses to prevent stack trace leaks.
            -   **Dependabot & Supply Chain Hardening**: Resolved all 70 npm security vulnerabilities (0 vulnerabilities remaining). Updated critical Rust network dependencies (`tar`, `rustls-webpki`).
            -   **Multi-Platform Automation**: Automated GitHub Actions CI/CD pipeline for building Windows (`.exe` NSIS installer), macOS (`.dmg`, Universal `.app`), and Linux (`.AppImage`, `.deb`).
    *   **v4.6.7 (2026-09-04)**:
        -   **[Core Fix] Fix Multi-Turn Agent Context Explosion & Session History Duplication BUG (Issue #3382)**:
            -   **Unblock Thinking Compression on Historical Assistant Messages with Tool Calls**: Fixed an issue where the strict `!has_tool_calls` check prevented compressing historical assistant `reasoning_content` in agent environments (e.g. OpenClaw) where almost every assistant turn contains tool calls. Allows pruning long thoughts down to placeholder `...` while fully preserving tool calls and their valid `thoughtSignature` tokens, eliminating token bloat and preventing upstream Google API 400 signature errors.
            -   **Normalized Thought Placeholder for Older Turns**: Updated `openai/request.rs` to generate a minimal placeholder thought block `{ "text": "...", "thought": true }` for historical assistant thinking in older turns outside the recent window, fulfilling upstream thinking schema requirements while discarding thousands of redundant thinking tokens.
            -   **Semantic History Matching & Duplication Prevention in Session Store**: Enhanced `prepare_session_input` with semantic prefix matching (ignoring client ID format differences) and sliding suffix boundary identification. Added fallback protection: when client sends full history and matches fail, uses client's full sequence instead of appending client history onto server history, eliminating exponential history compounding (2x/4x).
        -   **[Feature] Support Video Multimodal Inputs (`video_url` / `inlineData`) in OpenAI-Compatible API (Issue #3381)**:
            -   **OpenAI Content Block Support for `video_url`**: Extended `OpenAIContentBlock` to natively deserialize and process `video_url` blocks, resolving `Invalid request: data did not match any variant of untagged enum OpenAIContent` when clients send video inputs.
            -   **Format Detection & Native Gemini Multimodal Alignment**: Implemented a dedicated video processor (`proxy/video`) supporting base64 data URLs (`data:video/mp4;base64,...`), remote video URLs (`fileData`), local files (`file://` or filesystem paths automatically encoded to inlineData), and raw base64. Covers MP4, WebM, MOV, AVI, WMV, MKV format normalization, oversize advisory warnings, and token estimation.
    *   **v4.6.6 (2026-09-03)**:
        -   **[Core Fix] Fix Gemini 3.7 Tool Call Text Leakage Causing Silent Agent Interruption in Long Contexts (Issue #3379)**:
            -   **call:default_api Leakage Detection & Controlled Fail-Closed Recovery Bridge**: Resolved an issue where Gemini 3.7 Flash, following long-context compression, occasionally leaks internal pseudocode tool invocations (`call:default_api:ToolName{...}`) into plain text deltas instead of structured `functionCall` blocks, silently breaking Claude Desktop / Claude Code agent loops. Enforced a 7-point strict fail-closed guard sequence (registered tools required, no native tool use in current turn, strict prefix match, registered tool whitelist alignment, no surrounding prose, valid JSON args, no prior text deltas emitted) to securely recover leaked calls into standard `tool_use` blocks without prompt injection risks.
            -   **Symmetric Streaming/Non-Streaming Parity & Diagnostics**: Symmetrically aligned recovery logic across SSE streaming (`streaming.rs`) and non-streaming responses (`response.rs`), added diagnostic warning logs (`tracing::warn`) when text patterns are detected, and reinforced stability with 9 unit test scenarios.
    *   **v4.6.5 (2026-09-02)**:
        -   **[Core Fix] Fix Gemini JSON Schema Validation 400 Errors for Nested Arrays Missing Items (PR #3375)**:
            -   **Array Items Fallback Injection**: Resolved upstream Gemini 400 schema validation errors triggered by clients such as Claude Code when emitting itemless array schemas (e.g. `query.where: { type: "array", items: { type: "array" } }`). The recursive JSON schema sanitization now injects a Gemini-compatible `{"type": "string"}` fallback for itemless `array` nodes, backed by unit regression tests.
        -   **[Streaming Proxy & Protocol Compliance] Standardize Claude Upstream Stream Interruption Error Events (PR #3371, PR #3373)**:
            -   **Anthropic Standard SSE Error Output**: Fixed non-standard error payload formatting during upstream stream breaks or exceptions. Standardized on the Anthropic-compliant `type: "error"` structure with `error: { "type": "overloaded_error", "message": ... }` emitted via `state.emit("error", ...)`, ensuring Claude clients reliably catch and handle stream aborts.
        -   **[OpenCode & Model Support] Add Thinking Variant Support to Base Claude Opus 4.5/4.6 Models (PR #3371, PR #3373)**:
            -   **Opus Base Model Thinking Variants**: Added `VariantType::ClaudeThinking` support for `claude-opus-4-5` and `claude-opus-4-6` base model definitions. This resolves an issue where selecting base model IDs yielded no thinking tiers in dropdown selectors. Also aligned `Gemini3Pro` variant ordering.
        -   **[Linux & AppImage] Fix GUI Popup on Version Detection & Child Process Environment Leaks under AppImage (Issue #3370)**:
            -   **Static Package.json Priority Version Reading**: Optimized Linux Antigravity version detection to prioritize reading `resources/app/package.json` directly from the installation directory, preventing executing `--version` from inadvertently launching the Chromium/Electron GUI window.
            -   **Child Process AppImage Environment Sanitization**: When spawning Antigravity on Linux, AppImage runtime environment variables (`APPIMAGE`, `APPDIR`, `ARGV0`, `LD_LIBRARY_PATH`, `GTK_PATH`, etc.) are stripped, and `/tmp/.mount_*` paths are filtered from `XDG_DATA_DIRS` to avoid inheriting conflicting runtime libraries.
            -   **Hardened Process Detection & Self-Exclusion**: Enhanced Linux running process scanning and path resolution to ensure AppImage mount paths and parent/ancestor processes are not misidentified as target Antigravity instances.
        -   **[System & Tray] Prevent Window-State Plugin from Restoring Window Visibility on Startup (PR #3373)**:
            -   **Window Visibility State Filter**: Updated `tauri-plugin-window-state` configuration to exclude `StateFlags::VISIBLE`. This prevents the window from popping up on autostart or tray background launches when configured with `visible: false`.
    *   **v4.6.4 (2026-08-30)**:
        -   **[Core Fix] Fix Token Acquisition Timeout (5s) / Deadlock Error Under High Concurrency & Tokio Runtime Starvation (Issue #3348)**:
            -   **Async Disk I/O & Blocking Thread Pool Isolation**: Refactored `update_account_json` to an async function that dispatches synchronous disk I/O and global account locks to Tokio's blocking thread pool (`spawn_blocking`). This prevents disk serialization contention from blocking Tokio worker threads and causing runtime starvation under high concurrency.
            -   **Fire-and-Forget Disk Persistence on Token Acquisition Hot Path**: On the primary `get_token` scheduling path, file persistence after OAuth token refreshes and `project_id` resolution is now offloaded to background tasks after updating memory caches immediately, preventing disk write overhead from consuming the 5-second timeout window.
        -   **[Core Fix] Fix Indefinite Hang on Minimal/Single-Dot Prompts Causing Claude Desktop Gateway Health Check Timeout (Issue #3359)**:
            -   **Empty SSE Event Fallback**: Added defensive fallback logic in the Claude SSE streaming conversion layer. When upstream models terminate empty responses on minimal/punctuation-only prompts without yielding content or thinking, the stream synthesizer automatically emits valid `message_start`, fallback text ContentBlock, and `message_stop` events, eliminating peek loop timeouts.
            -   **Non-Streaming Collector Schema Guard**: Enforced that `collect_stream_to_json` always returns at least one valid text ContentBlock when parsing empty upstream streams, complying strictly with Anthropic client non-empty content constraints.
        -   **[Streaming & Session Management] Upstream SSE Cancellation on Client Disconnect & Session Branching Graph (PR #3367, PR #3366)**:
            -   **Proactive Upstream SSE Teardown**: Automatically stops polling and consuming upstream SSE streams as soon as the client disconnects or the downstream response body is dropped, preventing incomplete requests from saving invalid sessions.
            -   **Parent-Linked Session Graph**: Fixed streaming HTTP Responses session addressing and replaced full-history deep copies with a persistent parent-linked session tree graph for efficient branch support.
        -   **[Image Proxy & Account Scheduling] Account-Aware Image Scheduling & Rate Limit Lifecycle Hardening (PR #3364, PR #3363, PR #3362)**:
            -   **Account-Aware Image Concurrency Scheduler**: Introduced a shared concurrency scheduler for OpenAI and Gemini image generation and edit requests, enforcing per-account concurrency caps and seamless queueing when all accounts are busy.
            -   **Rate Limit Lifecycle & Grace Retry Optimization**: Corrected short 429 delay parsing, capped same-account retries to at most once, and preserved only explicit long-lived image quota deadlines.
            -   **Image Request Semantics Hardening**: Fully hardened OpenAI-compatible image requests with robust model alias resolution, size mapping, ordering, and input boundary validation.
        -   **[Network & Multimodal Improvements] Tool Image Retention, Bounded Debug SSE Capture & Quota Header Cleanup (PR #3365, PR #3361, PR #3360)**:
            -   **Tool Image Retention & Inline Media Bounding**: Retains images returned from tool outputs as multimodal model inputs, bounds inline image memory, and strips historical inline media before replay or caching.
            -   **Bounded Debug SSE Capture**: Implemented 256 KiB head + 256 KiB rolling tail buffer for debug response logging to eliminate memory bloat on large streams while preserving full downstream streaming.
            -   **Quota Header Cleanup**: Omits redundant `x-goog-user-project` headers on content requests to ensure proper upstream PA service authentication.
    *   **v4.6.3 (2026-08-30)**:
        -   **[Core Fix] Account JSON Storage Self-Healing & Concurrent File Write Lock (Issue #3345)**:
            -   **Self-Healing Parser on Load**: Added streaming deserializer fallback when reading account files. If an account file has trailing characters or extra closing braces (e.g. `trailing characters at line ...`), the parser automatically recovers the valid full `Account` data and atomically rewrites a clean file back to disk, completely preventing accounts from silently disappearing from the UI and causing cascading 429 rate limit outages.
            -   **Per-Account Concurrency Write Lock**: Introduced a global per-account mutex lock mechanism (`ACCOUNT_FILE_LOCKS`) to ensure strict serialized thread safety across concurrent quota refreshes, 429 rate-limit event writes, and `last_used` touch operations.
        -   **[Core Fix] Fix Discrete Model Chip Rendering for Pinned Gemini 3.7 Flash Models (Issue #3344)**:
            -   **Exact Match Priority**: Introduced exact-model matching in `resolveQuotaModels`. When a pinned selector matches a real quota model name (such as `gemini-3.7-flash-low`, `gemini-3.7-flash-high`, etc.), it renders as an independent discrete chip (`model:${id}`) instead of being collapsed and deduplicated into a single legacy `category:gemini-flash` slot that was hardcoded to older models.
            -   **Backward Compatibility**: Unmatched legacy category selectors and image selectors continue to use category-based resolution, preserving backward compatibility.
        -   **[Feature Optimization] Dashboard Best Accounts Recommendation with 5h & Weekly Quota Evaluation (Issue #3343)**:
            -   **Dual-Window Bottleneck Constraint**: Evaluates both the 5-hour rolling window and the 7-day weekly quota constraint ($\min(5h, weekly)$), avoiding recommending accounts that have a full 5h quota but have exhausted their weekly allowance.
            -   **Free Tier Single-Bucket Support**: Automatically detects single/dual-bucket account structures. Accounts with only a weekly quota (Free Tier) smoothly use their weekly quota percentage for evaluation, ensuring fair ranking without false zeroing.
            -   **Exhaustion Circuit Breaker**: Accounts with weekly quota $\le 5\%$ are disqualified from recommendation to prevent switching to unusable accounts.
        -   **[Core Fix] Gemini 3.7 / 3.x Thought-Signature Invalidation & Multi-Turn Variant Compatibility (PR #3342)**:
            -   **Case-Insensitive Thought Signature Error Matching**: Used `to_lowercase()` matching in Claude protocol and common handlers to capture all Google thought signature error variants (`Invalid thought signature.`, `thought_signature`, `thoughtsignature`), reliably triggering automatic retry and signature stripping.
            -   **Gemini 3.x Model Compatibility Rules**: Added explicit compatibility rules for `gemini-3.x` (Flash / Pro families) and `gemini-3.7` in `is_model_compatible`, ensuring thought signatures persist correctly across laddered variant turns.
        -   **[i18n] 100% Full Localization Across Multiple Languages (PR #3338, PR #3339, PR #3340, PR #3341)**:
            -   **Japanese (ja.json, PR #3338)**: Complete translations for quota protection, smart warmup, adaptive circuit breaker, context compression, model routing, and Homebrew updater; cleared residual strings.
            -   **Spanish (es.json, PR #3339)**: Complete translations for Proxy Pool, Debug Console, Network Monitor, IP Security Whitelist/Blacklist, OpenCode sync, and APIKEY.FUN relay.
            -   **Russian (ru.json, PR #3340)**: Complete translations for HTTP API server settings, Debug console, Homebrew upgrade workflow, Context Compression (Caveman/L1-L3), and streaming error prompts.
            -   **Korean (ko.json, PR #3341)**: Complete translations for proxy pool, debug console, model routing presets, 403 quick fix guide, and Homebrew update notifications.
    *   **v4.6.2 (2026-08-28)**:
        -   **[Core Fix] Proxy Startup Diagnostics for Silent Failure & Unreachable Ports (PR #3330)**:
            -   **Startup Failure Logging**: Added explicit `error!` logs when `load_app_config()` fails in `lib.rs`, converting silent exits into actionable error logs and clarifying that services were not started.
            -   **Cleaned Up Dummy Server Handle**: Removed unneeded placeholder `tokio::spawn(async {})` handles from `ProxyServiceInstance`, leaving unified lifecycle management to `AdminServerInstance`.
        -   **[i18n] Brazilian Portuguese (pt-BR) 100% Key Alignment with en.json (PR #3334)**:
            -   **1224+ Translation Keys Completed**: Translated all missing keys and removed residual Chinese strings (0 missing, 0 mismatched).
            -   **Placeholder Synchronization**: Aligned `{{name}}`, `{{error}}` interpolation parameters to avoid runtime UI render issues.
            -   **Component Direct References**: Added missing keys directly referenced by frontend TSX components.
        -   **[Enhancement] Model Catalog Update, Official Icons & OpenCode Sync Optimization (PR #3335)**:
            -   **New Model Support**: Added `gemini-3.7-flash`, `gemini-3.1-flash-lite`, `claude-opus-4-6`, `gpt-oss-120b-medium` with `@lobehub/icons` official brand icons.
            -   **Model List Deduplication**: Normalized alias mappings in `useProxyModels` to eliminate duplicate model entries caused by sub-tier suffixes.
            -   **OpenCode Sync Adjustments**: Enabled `ClaudeThinking` reasoning variants for Claude models and disabled unsupported `max` variants for Gemini 3 series.
        -   **[Platform Fix] Eliminate Windows Background Process Console Flashing (PR #3336)**:
            -   **Unified CREATE_NO_WINDOW Flags**: Replaced/supplemented `DETACHED_PROCESS` with `CREATE_NO_WINDOW` (0x08000000) across Cloudflared, tar decompression, and manual executable calls to eliminate console windows popping up.
            -   **Sync/Async Unified Handling**: Applied no-window flags consistently across `std::process::Command` and `tokio::process::Command` extensions.
        -   **[Core Fix] Fix Gemini 3.x 400 Bad Request on Thinking Block Compression (PR #3337)**:
            -   **Root Cause**: When `ContextManager` compressed thinking content to `"..."`, it preserved the original `thoughtSignature`, causing Google API to fail validation with `400 INVALID_ARGUMENT: Invalid thought signature`.
            -   **Fix**: Cleared the corresponding signature field when compressing thinking content to maintain signature chain integrity.
        -   **[Install Script Fix] Fix Linux Install Script 404 on Version Parsing (Issue #3328)**:
            -   **Validation & Direct Redirection**: Added `_is_valid_version()` semantic version format validation and switched Method 2 to `curl -w '%{url_effective}'` to avoid header parsing whitespace issues.
    *   **v4.6.1 (2026-08-25)**:
        -   **[Core Fix] Prevent 1M Token Overflow on Long Multi-Turn Thinking & Local Token Estimation Fallback (Issue #3325)**:
            -   **Historical Thinking Pruning**: When converting to Gemini contents, only the most recent window of assistant thinking text is preserved; older turns retain only `thoughtSignature` placeholders to prevent context from exceeding the 1M token ceiling.
            -   **Fallback Token Estimation**: If upstream Google returns an error without `usageMetadata`, middleware uses the local token estimation engine to calculate `input_tokens`, preventing blank token stats in monitor logs.
        -   **[Core Fix] JSON Schema `const` Keyword Normalization for Computer Use MCP (Issue #3327)**:
            -   **Schema Sanitization**: Automatically converts `{"const": "value"}` into standard `{"type": "...", "enum": ["value"]}` compatible with Gemini/Vertex Schema Proto.
            -   **Nested & Union Types Support**: Full support for `anyOf`/`oneOf` unions and deeply nested objects containing `const` fields.
    *   **v4.6.0 (2026-08-24)**:
        -   **[Core Feature] OpenAI Endpoint Supports `response_format.json_schema` Structured Outputs (PR #3324)**:
            -   **JSON Schema Support**: Full support for `response_format: { type: "json_schema", json_schema: { ... } }`.
            -   **Recursive Schema Unfolding**: Automatically extracts and sanitizes `$ref`/`$defs` definitions, converting schemas into Gemini `generationConfig.responseSchema` standards with `responseMimeType: "application/json"`.
        -   **[Core Fix] Proxy Pool Health Check 407 & URL Inline Auth Parsing Fix (Issue #3323)**:
            -   **HTTPS 204 Health Check**: Upgraded default health check endpoint to `https://cp.cloudflare.com/generate_204` via standard HTTPS `CONNECT` tunnels, eliminating false `407 Proxy Authentication Required` errors.
            -   **Inline Credentials Parsing**: Safely extracts `username` and `password` from `http(s)://user:pass@ip:port` proxy URLs and injects HTTP Basic Auth.
        -   **[Core Fix] Gemini 3.7 / 3.6 Flash Variant Mapping & 429 Fix (Issue #3322)**:
            -   **Registered 3.7 Variants**: Full registration for `gemini-3.7-flash`, `gemini-3.7-flash-low`, `gemini-3.7-flash-medium`, `gemini-3.7-flash-high`, and `gemini-3.7-flash-tiered`.
            -   **Eliminated False 429 Outages**: Fixed account quota scheduler falsely intercepting requests with "All accounts limited" on unregistered 3.7 variants.
    *   **v4.5.9 (2026-08-23)**:
        -   **[Core Feature] OpenAI Compatible Endpoint Multimodal Audio Input Support (PR #3321)**:
            -   **Standard Audio Formats**: Supports OpenAI official `input_audio` (Base64 + format) and `audio_url`, converting seamlessly to Gemini `inlineData`/`fileData`.
            -   **Normalization**: Normalizes `wav`, `mp3`, `m4a`, `ogg`, `flac`, `aiff` from Data URLs, remote HTTP links, local files, and raw Base64.
        -   **[Core Fix] OAuth Token Refresh Resilience & Backoff (PR #3321)**:
            -   **Proactive Buffer (5 Min)**: Increased token refresh window from 90s to 300s ahead of expiry.
            -   **Backoff Retry & Consecutive Failure Gate**: Retries after 500ms backoff on `invalid_grant` and disables accounts only after 2+ consecutive confirmed failures.
        -   **[Core Fix] 403 / VALIDATION_REQUIRED Detection & URL Parsing**:
            -   **Validation URL Extraction**: Parses `validation_url` / `appeal_url` from Google RPC responses and flags accounts in the UI with a quick-action verification button.
