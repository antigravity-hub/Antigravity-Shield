# 📝 Changelog

> Complete version history for Antigravity Shield. Return to project home at [README.md](README.md) | [English Documentation](README_EN.md).

*   **Version History**:
    *   **v5.11.1 (2026-09-17)**:
        -   **[Auto-Updater & Asset Distribution Pipeline] Correct Repository Binding & Long-Timeout Streaming**:
            -   **Authoritative Endpoint Alignment**: Realigned updater endpoint and direct asset fallback URLs to `antigravity-hub/Antigravity-Shield`, resolving 404 lookup failures during automated version discovery.
            -   **Long-Timeout Streaming Client**: Implemented dedicated streaming HTTP client with 15-minute socket timeout and redirection support for installer package downloads, preventing stalled downloads and premature timeouts.
            -   **Structured Platform Manifest Parsing**: Enriched `updater.json` client parser with dynamic platform asset resolution for Windows (`x64-setup.exe`), macOS (`.dmg`), and Linux (`.AppImage`).
        -   **[Account Security & Verification Integrity] Verification State Persistence & Reusable Banners**:
            -   **Persistent Challenge State**: Removed premature timer-based flag eviction in token manager, preserving the `validation_blocked` state until account re-authentication or successful upstream quota sync.
            -   **Unified Verification Required Banner**: Modularized verification alert component across Dashboard and Account views with comprehensive multi-language support (English, Persian, Chinese) and zero hardcoding.
            -   **Interactive Guide Viewer Localization**: Refined Verification Guide modal and PDF launcher with standard internationalization keys and clean English fallbacks.
        -   **[Model Lineup & UI Optimization] Exact Model Configuration & Diagnostic Caching**:
            -   **Model Catalog Cleanup**: Purged legacy placeholder models (`gemini-3.8-pro`, `gemini-3.8-pro-high`) in settings, retaining only verified upstream models (`gemini-3.1-pro-high`, `gemini-3.8-flash`, `gemini-3.1-flash-image`).
            -   **Diagnostic Probe Caching**: Introduced 60-second module cache for Network Health Pulse to eliminate repetitive latency probes during tab navigation.
            -   **Documentation Showcase Refresh**: Updated project READMEs and showcases with authentic high-resolution screenshots highlighting the latest Dashboard, Quotas, and RTL interface patches.
    *   **v5.11.0 (2026-09-16)**:
        -   **[IDE Toolkit Hub v2.3.0 & Real-Time Sync] Bi-Directional Bridge & Automated Extension Deployment**:
            -   **Embedded Antigravity Toolkit v2.3.0**: Embedded latest `antigravity-toolkit-2.3.0.vsix` with 1-click install and CLI verification for Antigravity IDE, Visual Studio Code, Cursor, and Windsurf.
            -   **Real-Time Tunnel Quota Push**: Implemented dynamic `quota_updated` event push on quota changes or account rotation, delivering instantaneous balance updates to connected IDEs.
            -   **Autonomous Port Fallback & Discovery**: Added intelligent port fallback and dynamic discovery sync (ports 10810/10811) with live header connectivity status badge.
            -   **Platform Target Protection**: Preserved active target configuration against accidental bridge override during account switching.
            -   **Toolkit Hub Modal & Diagnostics**: Rebuilt the management hub with localized controls, detailed connection logs, and automated environment detection.
        -   **[Account Security & Verification Experience] Verification Alerts & Native Guide Viewer**:
            -   **Verification-Required Account Detection**: Automated detection of Google account security challenges and verification-required states, displaying distinct amber indicators across dashboard and account tables.
            -   **Native In-App Verification Guide Viewer**: Integrated interactive modal Markdown viewer with fallback browser opener, walking users through step-by-step unblocking workflows safely.
            -   **OAuth Authentication Hardening**: Introduced atomic race guards in the local OAuth callback server, preventing hung browser tabs and ensuring instant tab closure upon authentication.
        -   **[Network Health Pulse & Proxy Optimization] UAC Elevation & Lean Model Warmup**:
            -   **Windows UAC Elevation & TUN Adapter Detection**: Enabled automatic UAC elevation (`runas`) when launching proxy/VPN tunnels and integrated smart virtual TUN interface scanning.
            -   **Ultra-Lean Model Warmup Engine**: Re-architected warmup payloads targeting active Gemini 2.5 Flash and Claude models with minimal token consumption, preventing quota waste during application launch.
            -   **Proxy Memory Safety & Buffer Move Resolution**: Eliminated buffer move hazards during HTTP streaming and response forwarding, ensuring stable multi-target proxy operations.
            -   **Localized WARP Region-Bypass Guidance**: Embedded clear, multi-language setup instructions for Cloudflare WARP and proxy routing directly inside Network Health Pulse.
        -   **[UI/UX, RTL Support & Persian Typography] Native RTL, Slate Theme & Precision Stats**:
            -   **Native RTL & Vazirmatn Font Patch**: Integrated full right-to-left UI layout and Iranian Vazirmatn font injection for Antigravity IDE and Shield.
            -   **Harmonized Dark Theme Palette**: Aligned modal, card, and table background surfaces to slate dark-mode tokens (`slate-900`/`slate-800`), eliminating light-theme fallback artifacts.
            -   **Token Analytics Chart Polish**: Fixed aggregation time intervals and chart tick intervals for hourly, daily, and weekly token consumption visualization.
            -   **Table Overflow Resolution**: Eliminated horizontal scrollbars on account lists and cleaned up action button separators for a sleek presentation.
            -   **Comprehensive i18n Localization**: Completed English, Persian, and Chinese translations across Toolkit settings, WARP guides, and Token Stats.
        -   **[Automated Release Pipeline] Hardened CI/CD & Cross-Platform Distribution**:
            -   **Hardened Release Workflow**: Enforced strict validation gates in CI requiring complete Windows installer and updater manifest generation before publishing release assets.
            -   **Multi-Platform Build Architecture**: Integrated automated macOS (`.dmg`) and Linux (`.deb` / `.AppImage`) packaging infrastructure in release actions.
    *   **v5.9.1 (2026-09-16)**:
        -   **[Auto-Update & Distribution Resilience] Resilient Direct Streaming Installer Fallback Engine**:
            -   **Zero-Stall Streaming Installer**: Implemented native streaming download engine (`download_and_run_installer` in Rust) that fetches setup binaries directly with real-time chunked progress events, completely eliminating manual browser redirects when cryptographic verification is unavailable.
            -   **Clean Process Handoff**: Configured detached installer execution on Windows (`CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS`) with coordinated graceful process exit, ensuring NSIS can replace binaries cleanly without file locking.
            -   **1-Click In-App Direct Installation**: Enhanced update modal and settings interfaces with automated transition to direct installation, providing users with a seamless single-click upgrade experience.
        -   **[Security & Release Pipeline] Verified Minisign Keypair Alignment & Build Automation**:
            -   **Cryptographic Keypair Realignment**: Synchronized authoritative Minisign public key in `tauri.conf.json` matching CI signing configuration with explicit password support, eliminating Minisign key derivation failures in GitHub Actions.
            -   **Streamlined CI Packaging**: Hardened `.github/workflows/release.yml` updater artifact generation logic to guarantee clean packaging of installer bundles and verification manifests.
    *   **v5.9.0 (2026-09-16)**:
        -   **[Toolkit & API Integration] Bi-Directional IDE Bridge & Quota Intelligence**:
            -   **Hardened Token Analytics**: Refined live quota calculations and strict non-rounding percentage display across connected accounts.
            -   **Full-Fleet Synchronization**: Implemented automated fleet-wide quota auto-refresh and instant window-focus wakeup sync.
    *   **v5.8.3 (2026-09-15)**:
        -   **[Core & Process Monitoring] Process Signature Alignment**:
            -   **System Diagnostic Alignment**: Aligned system process scanning routines with modern sysinfo signatures.
    *   **v5.8.2 (2026-09-14)**:
        -   **[User Interface & Window Controls] Native Desktop Titlebar Window Controls**:
            -   **Pixel-Perfect Window Caption Buttons**: Implemented dedicated Minimize (`—`), Maximize / Restore Down (`□` / `❐`), and Close (`✕`) caption controls in the frameless titlebar with Windows-native hover aesthetics and crimson close accent.
            -   **Double-Click Titlebar Toggle**: Added native double-click maximize/unmaximize gesture handling across the upper drag region.
            -   **Strict Capability Alignment**: Granted runtime permissions for window close, destroy, and toggle-maximize operations in the core capability policy (`src-tauri/capabilities/default.json`).
            -   **Localization Clarification**: Disambiguated floating Mini View tooltip from standard window minimize action across all supported interface languages.
    *   **v5.8.1 (2026-09-13)**:
        -   **[MiniView & Window Management] Adaptive Window State Restoration & Geometry Persistence**:
            -   **Bi-Directional State Preservation**: Implemented intelligent window dimension and position memory across full view and mini view transitions, faithfully restoring previous geometries and maximized states.
            -   **Persistent Always-On-Top Layering**: Enforced background-layer immunity in mini view, ensuring critical session and quota telemetry remain visible during active IDE workflows.
            -   **Micro & Compact Dimension Support**: Expanded dynamic sizing boundaries to support ultra-compact footprints down to 110x52 with native drag handles and refined backdrop blur aesthetics.
        -   **[Accounts & Quota Intelligence] Disambiguated Reset Cycle Analytics**:
            -   **Strict Window Disambiguation**: Hardened 5-hour and weekly quota bucket detection across Rust backend and frontend engines, preventing window collision and ensuring accurate cycle countdowns.
            -   **Accounts View Polish**: Unified weekly progress bar widths, integrated descriptive tooltip guides, and streamlined table header metrics.
        -   **[Toolkit Integration & Layout Polish] Viewport Optimization & Seamless Setup**:
            -   **Toolkit Viewport Resilience**: Resolved modal scrolling overflow on lower-resolution displays and streamlined 1-click Antigravity IDE setup workflow.
            -   **Navigation Responsiveness**: Enhanced navigation header logo adaptability and enforced strict minimum window bounds to prevent navigation item truncation.
    *   **v5.8.0 (2026-09-13)**:
        -   **[Antigravity Toolkit Hub] Multi-IDE Integration & Real-Time Connection Bridge**:
            -   **Automated IDE Environment Discovery**: Integrated high-speed native discovery scanner (`src-tauri/src/modules/ide_scanner.rs`) detecting Antigravity IDE, Visual Studio Code, JetBrains, Zed, and Apple Xcode across standard installation paths.
            -   **One-Click Extension Deployment**: Bundled pre-packaged `antigravity-toolkit.vsix` within application resources, providing single-click installation and CLI verification directly from the GUI.
            -   **Real-Time Session Heartbeat & Status Telemetry**: Introduced dynamic header connectivity badge and background telemetry server tracking live IDE sessions and connected account states.
            -   **Interactive Toolkit Management Hub**: Created modal interface (`ToolkitIntegrationModal.tsx`) with comprehensive IDE management controls, live session state, and diagnostic logging.
        -   **[User Interface & Responsiveness] Adaptive Two-Row Accounts Toolbar Overhaul**:
            -   **Fluid Multi-Row Layout**: Re-architected Accounts page toolbar into an intelligent responsive two-row hierarchy, eliminating horizontal overflow across compact window dimensions and varied desktop DPI scalings.
            -   **Ergonomic Control Organization**: Structured search, auto-sort, and quota views on the primary tier with dedicated clear-search trigger, while grouping batch operations, import/export actions, and data freshness telemetry along the secondary tier.
    *   **v5.7.4 (2026-09-13)**:
        -   **[Security & CI/CD] Streamlined Updater Keypair & Cryptographic Signature Automation**:
            -   **Unencrypted Signing Key Integration**: Updated `tauri.conf.json` with matching Minisign public key for the newly generated non-passphrase keypair, enabling frictionless automated package signing in CI/CD environments.
            -   **Hardened Release Workflow Signing Logic**: Streamlined GitHub Actions `release.yml` to preserve authoritative configuration values and ensure updater artifact generation is always triggered when signing keys are detected.
    *   **v5.7.3 (2026-09-13)**:
        -   **[Build & Release Pipeline] Multi-Target Binary Decoupling & Windows Packaging Stabilization**:
            -   **Rust Visibility Alignment**: Corrected `enabled_account_ids` visibility in `TokenManager` to public, allowing auxiliary binary targets (`shield-daemon`) to compile cleanly across Linux CI and release workflows.
            -   **Explicit Tauri Binary Targeting**: Configured `release.yml` across Windows, macOS, and Linux packaging pipelines to explicitly pass `--bin antigravity-shield` to Cargo via `tauri build`, eliminating binary resolution ambiguity in multi-target Cargo manifests.
            -   **Clean Headless Daemon Tracing**: Eliminated unused tracing imports and variables in `daemon_main.rs`, satisfying strict compiler lint gates.
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

---

> 📌 **Legacy Release Archive**: For ancestral and upstream releases (v4.6.7 and earlier) prior to the Antigravity Shield architecture overhaul, refer to [CHANGELOG_LEGACY.md](CHANGELOG_LEGACY.md).
