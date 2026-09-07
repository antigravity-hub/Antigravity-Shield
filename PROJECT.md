# Project: Antigravity-Shield Comprehensive Hardening

## Architecture
Antigravity-Shield is a high-performance local proxy and account management system built with Tauri v2 (Rust Axum 0.7 + Hyper 1 + rquest) backend and React 19 / TypeScript 5.8 frontend. It bridges AI coding agents (Claude Code, Cursor, OpenCode, OpenClaw) with Google Cloud Code / Gemini upstream endpoints, providing protocol translation for OpenAI (`/v1/chat/completions`, `/v1/responses`), Claude (`/v1/messages`), and Gemini native protocols.

### Subsystem Boundaries
1. **Account Protection & Anti-Detection Layer** (`src-tauri/src/proxy/upstream/client.rs`, `modules/device.rs`, `modules/quota.rs`):
   - Per-account `DeviceProfile` isolation (MAC machine ID, isolated session ID, browser fingerprinting).
   - Strict production URL whitelisting (`https://cloudcode-pa.googleapis.com/v1internal`).
   - Quarantine and cooldown management for 403 and `VALIDATION_REQUIRED` blocks.
2. **Concurrency & Token Acquisition Engine** (`src-tauri/src/proxy/token_manager.rs`, `modules/account.rs`, `modules/config.rs`):
   - Non-blocking token retrieval with `spawn_blocking` disk offloading.
   - Dynamic timeout expansion (15s) and proactive background token refresh.
   - Per-account fine-grained locks eliminating thread starvation under multi-agent load.
3. **Protocol Translation & Context Preservation Engine** (`src-tauri/src/proxy/http_session_store.rs`, `mappers/openai/`, `mappers/claude/`):
   - Content-hash and semantic alignment for session replay without turn duplication or intermediate turn loss.
   - Unconditional historical thinking block pruning (`{"text": "...", "thought": true, "thoughtSignature": "<sig>"}`).
   - Bi-directional fail-closed recovery bridge for Gemini 3.7 `call:default_api:*` pseudo-code tool calls in both Claude and OpenAI gateways.
4. **Geographic & Proxy Network Fallback Layer** (`src-tauri/src/proxy/handlers/common.rs`, `proxy_pool.rs`):
   - Classification of 400 "User location is not supported" as retryable transport failure.
   - Real-time proxy health feedback loop and dynamic node rotation.
   - Google egress connectivity verification.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Upstream Issue Taxonomy & Diagnostic Audit | Formal audit of top 10 upstream failure classes with concrete root-cause mapping | M1 | Survey |
| 2 | Device Profile Isolation | Replace global machine_uid with account-bound DeviceProfile and isolated session IDs | M1 | Survey / Issue #655 |
| 3 | Safe 403 & Quarantine Protocol | Differentiate permanent 403 from transient/cooldown blocks; avoid disk deletion | M1 | Survey / Issue #1822 |
| 4 | Production Route Sanitization | Whitelist production v1internal routes, sanitize dev/staging URLs | M1 | Survey / R2 |
| 5 | Token Acquisition Non-Blocking Engine | Offload disk I/O to spawn_blocking, expand timeout from 5s to 15s | M2 | Survey / Issue #3348 |
| 6 | In-Memory Config & Background Reload | Cache gui_config in memory, offload pending account reloads from hot path | M2 | Survey / Issue #3348 |
| 7 | Fine-Grained Locking & Mutex Decoupling | Replace global ACCOUNT_INDEX_LOCK with fine-grained per-account locks | M2 | Survey / Issue #284 |
| 8 | Robust Context Reconciliation | Content-hash and LCS alignment in http_session_store; prevent Cartesian explosion | M3 | Survey / Issue #3382 |
| 9 | Thinking Token Window Compression | Unconditional reasoning placeholder pruning to prevent 1M+ token ceiling breach | M3 | Survey / Issue #3325 |
| 10 | OpenAI Gateway Tool-Call Recovery Bridge | Port call:default_api recovery to OpenAI streaming and response mappers | M3 | Survey / Issue #3379 |
| 11 | Geo-Location 400 Error Reclassification | Reclassify "User location is not supported" as retryable transport failure | M4 | Survey / Issue #3301 |
| 12 | Real-Time Proxy Health Feedback Loop | Notify ProxyPoolManager on transport failure and trigger dynamic failover | M4 | Survey / Issue #1583 |
| 13 | Comprehensive E2E Regression Test Suite | 4-tier requirement-driven test suite validating all hardened pathways | M5 | Acceptance Criteria |
| 14 | Adversarial Coverage Hardening | Tier 5 adversarial tests targeting edge cases, race conditions, and malformed inputs | M5 | Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Account Protection & Anti-Detection Hardening | DeviceProfile isolation, 403 quarantine, production URL sanitization, diagnostic audit | none | DONE |
| M2 | Concurrency & Token Timeout Elimination | 15s timeout, non-blocking spawn_blocking, in-memory config cache, fine-grained locks | M1 | DONE |
| M3 | Context Preservation & Protocol Guarding | Session store reconciliation, thinking pruning, OpenAI tool recovery bridge | M2 | DONE |
| M4 | Geographic & Proxy Network Fallback | Geo 400 reclassification, proxy health feedback loop, dynamic node failover | M3 | DONE |
| M5 | E2E Testing, Adversarial Hardening & Release | 100% test pass, Tier 5 adversarial hardening, npm run build, Git commit | M4 | DONE |

## Interface Contracts
### Device Profile Binding ↔ Upstream Client
- Function: `get_account_device_headers(account: &Account) -> HeaderMap`
- Returns isolated machine ID (`x-client-name`, `x-machine-id`) matching account device profile.
- Strict fallback to per-account salted hash, never raw physical host ID.

### Token Manager ↔ Concurrency Engine
- Function: `get_token_internal(..., timeout: Duration)`
- Asynchronous non-blocking: all file persistence and reload operations deferred to `spawn_blocking`.
- Timeout increased to 15 seconds with lock-free memory cache fast-path.

### Session Store ↔ Gateway Mappers
- Function: `reconcile_conversation_history(history: &[Message], new_input: &[Message]) -> Vec<Message>`
- Deterministic deduplication preserving intermediate turns and shedding duplicated prefixes.

### Common Error Classifier ↔ Proxy Pool Manager
- Function: `classify_upstream_error(status: StatusCode, body: &str) -> RetryStrategy`
- Distinguishes `RetryStrategy::ProxyFailover` (geo 400, proxy 407/502/reset) from `RetryStrategy::AccountQuarantine` (403) and `RetryStrategy::RateLimited` (429).

## Code Layout
- `src-tauri/src/proxy/upstream/client.rs`: Upstream HTTP client, URL whitelisting, header injection.
- `src-tauri/src/proxy/token_manager.rs`: Token acquisition, concurrency control, caching.
- `src-tauri/src/proxy/http_session_store.rs`: Multi-turn session replay and history reconciliation.
- `src-tauri/src/proxy/mappers/openai/`: OpenAI protocol request/response/streaming mappers.
- `src-tauri/src/proxy/mappers/claude/`: Claude protocol request/response/streaming mappers.
- `src-tauri/src/proxy/handlers/common.rs`: Upstream error classification and retry strategy.
- `src-tauri/src/proxy/proxy_pool.rs`: Proxy health tracking and dynamic failover.
- `src-tauri/src/modules/quota.rs`: Quota synchronization and safe rate-limit tracking.
- `src/`: React 19 / TypeScript frontend UI and dashboard.
