# Upstream Issue Taxonomy & Diagnostic Audit Report

**Target Project**: `Antigravity-Shield` / `Antigravity-Manager-Guidance`  
**Upstream Reference**: `lbjlaq/Antigravity-Manager` (1,800+ Issues Analyzed)  
**Date**: 2026-09-04  
**Audit Objective**: Systematic classification of the top recurring upstream failure modes, cross-referencing concrete code locations, environmental trigger conditions, and architectural hardening requirements.

---

## 1. Executive Summary & Problem Scope

Across more than 1,800 issues reported in upstream `lbjlaq/Antigravity-Manager`, multi-agent developer workflows (Claude Code CLI, Cursor, OpenCode, OpenClaw) experience high operational friction across five primary domains:
1. **Account Integrity & Bans**: Bulk 403 Forbidden errors and Google ToS suspensions resulting from fingerprint collisions and non-production routing.
2. **Concurrency Starvation**: 5-second token acquisition timeouts and async worker thread deadlocks under concurrent multi-agent requests.
3. **Context Explosions**: Exponential token compounding (400K -> 1M+) in multi-turn sessions due to flawed session reconciliation and thinking block accumulation.
4. **Tool Protocol Degradation**: Gemini 3.7 thought leaks and plaintext pseudocode (`call:default_api:*`) breaking downstream agent loops.
5. **Geographic & Network Cascades**: Geo-location 400 errors ("User location is not supported") and proxy drops miscategorized as account quota exhaustion.

---

## 2. Structured Diagnostic Audit Matrix (Top 10 Failure Classes)

| # | Failure Class | Upstream Issues | Concrete Code Locations | Trigger Conditions & Environmental Factors | Upstream Root-Cause Mechanism | Architectural Hardening & Verification |
|---|---|---|---|---|---|---|
| **C1** | **Account Bans & ToS Violations (403)** | #655, #1822, #1883, #2228, #2261 | `src-tauri/src/proxy/upstream/client.rs:360-370`, `handlers/claude.rs:1782`, `handlers/openai.rs:2566` | Multi-agent queries across residential/commercial proxies; non-production daily/sandbox endpoints; shared machine IDs. | Physical host `machine_uid::get()` and static `x-vscode-sessionid` injected across all accounts. Google anti-abuse correlates accounts to single host. Unconditional `set_forbidden` immediately deletes accounts on disk. | Bind requests to account-specific `DeviceProfile` (`mac_machine_id` / isolated session hash). Quarantine 403 accounts in memory with cooldown instead of instant disk wipe. Enforce production URL whitelisting. |
| **C2** | **High-Concurrency Token Timeout (5s)** | #3348, #3245, #284 | `src-tauri/src/proxy/token_manager.rs:1481-1500`, `1460-1479`, `1634`, `1737`, `2181` | $\ge 5-10$ concurrent requests (Cursor + Claude Code); heavy host disk I/O; background quota refreshes. | 5s hard timeout wrapping sequential synchronous disk reloads (`take_pending_reload_accounts`), synchronous `load_app_config()` JSON reads, in-band 60s OAuth network calls, and mutex serialization. | Expand timeout from 5s to 15s. Offload disk I/O to `tokio::task::spawn_blocking`. Cache config in memory. Decouple token memory cache updates from disk synchronization. |
| **C3** | **Context Window Cartesian Explosion** | #3382, #3325, PR #3337, PR #78caa184 | `src-tauri/src/proxy/http_session_store.rs:185-280`, `proxy/mappers/openai/request.rs:793-808`, `claude/request.rs:1150-1200` | Multi-turn agent loops with tool calls; clients re-transmitting entire history with regenerated/volatile IDs. | Flawed reconciliation in `prepare_session_input`: fallback either drops intermediate tool turns (`new_input.last()`) or appends full history, doubling tokens turn-by-turn. Thinking pruning bypassed when `has_tool_calls == true`. | Implement semantic LCS / content-hash alignment. Prune historical reasoning to `{"text": "...", "thought": true, "thoughtSignature": "<sig>"}` unconditionally across all older turns. |
| **C4** | **Gemini 3.7 Tool Leak & Pseudocode Breakage** | #3379, #3300, #1977, #130 | `src-tauri/src/proxy/mappers/openai/streaming.rs`, `proxy/mappers/openai/response.rs`, `proxy/mappers/claude/streaming.rs:1106` | Deep context compaction ($\ge 80$K prompt tokens); Gemini 3.7 Flash; agent conversational prose preceding tool invocation. | Gemini 3.7 emits internal plaintext `call:default_api:Tool{args}` deltas instead of protobuf `functionCall`. OpenAI gateway has no recovery bridge; Claude mapper rejected calls preceded by prose. Client terminates tool loop. | Implement bi-directional fail-closed recovery bridge in both Claude and OpenAI streaming and response mappers. Parse loose pseudocode into valid `tool_calls` / `tool_use` with proper stop reason. |
| **C5** | **Protocol Parameter & Tool Incompatibility** | #3300, #3306, #3375, #3327 | `src-tauri/src/proxy/mappers/`, `proxy/upstream/client.rs` | Custom Function Calling declared alongside Google Search; nested arrays without `items`; JSON schema `const` keywords. | Google `v1internal` gateway rejects mixed search + function tools; rejects JSON Schema `const` and itemless arrays; requires snake_case `tool_config.include_server_side_tool_invocations`. | Dual-casing for tool configs; enforce tool mutual exclusivity (strip `googleSearch` when custom tools present); recursive schema sanitization (`const` -> `enum`, array item fallbacks). |
| **C6** | **Thought-Signature Invalidation** | #3313, #3314, #3337, #3342, #3243 | `src-tauri/src/proxy/context_manager.rs`, `proxy/mappers/claude/request.rs` | Multi-turn thinking agent conversations; context compression mutating text; thinking budget changes between turns. | Mutating thinking text invalidates cryptographic HMAC signature. Single-slot signature cache overwritten by concurrent turns, yielding `400 Invalid thought signature`. | Turn-indexed multi-signature cache (`get_session_signature_at`); clear signature or inject `skip_thought_signature_validator` sentinel on compressed text; case-insensitive auto-retry. |
| **C7** | **Geographic Geofencing (Geo 400)** | #3301, #3377, #3323 | `src-tauri/src/proxy/handlers/common.rs:140-212`, `proxy/proxy_pool.rs:248`, `proxy/upstream/client.rs:67` | Egress IP in restricted country; datacenter IP flagged by Google edge; single-endpoint URL configuration. | Status 400 with "User location is not supported" classified as `NoRetry`, causing immediate failure. Proxy pool health checker pings Cloudflare instead of Google, failing to detect edge blocks. | Reclassify geo 400 as `RetryStrategy::ProxyFailover`; notify `ProxyPoolManager` to rotate proxy node; implement HTTPS 204 CONNECT tunnel health check for Google endpoints. |
| **C8** | **Security Challenge & Phone Verification** | #1430, #3160, #3321 | `src-tauri/src/modules/oauth.rs:520-614`, `src-tauri/src/proxy/handlers/claude.rs:1762` | Logging in or refreshing tokens from dirty/flagged IPs; sudden IP shifts; rapid unbuffered polling following `invalid_grant`. | Google Identity risk engine detects abnormal login environments or rapid token polling, flagging account for secondary SMS/QR challenge. Sudden expiration causes instant drop. | Standardize OAuth client IDs and redirect URIs to match official IDE; proactive token refresh 300s ahead of expiry with jitter; 500ms backoff on `invalid_grant` with 2-consecutive failure gate; UI challenge prompt. |
| **C9** | **Account JSON Storage Corruption** | #3345, #3249, #3260 | `src-tauri/src/modules/account.rs:524-531`, `proxy/token_manager.rs:1766, 1819` | Multiple async tasks writing account metadata (quota refresh, rate-limit touches, last_used updates) concurrently. | Non-atomic `std::fs::write` to `accounts.json` from multiple threads without cross-process write locks; partial writes leave trailing characters or corrupted JSON. | Global per-account mutex lock (`ACCOUNT_FILE_LOCKS`); self-healing JSON parser with streaming recovery fallback; atomic write via temporary file replacement (`.tmp` + rename). |
| **C10** | **False Rate-Limit Cascades & 429 Spillover** | #3322, #3240, #3267, #3343, #3362, #2209, #3074 | `src-tauri/src/proxy/token_manager.rs:2903`, `modules/quota.rs:303-317` | High-tier models with variant suffixes (`gemini-3.7-flash-high`); 429 triggers `fetch_and_lock_with_realtime_quota` which hits 403 on Google quota check. | Unregistered model variants fail mapping, causing scheduler to see 0 accounts. When quota fetch returns 403, `quota.rs` sets `q.is_forbidden = true`, converting 429 into account deletion. | Comprehensive model variant registry with family fallback; isolate quota fetch errors so 403 never marks accounts banned; active quota replenishment listeners clearing rate limit flags on $>0\%$. |

---

## 3. Concrete Architectural Hardening Directives

1. **R1 Upstream Mapping**: Telemetry logging tags all errors with C1–C10 classifications for diagnostics.
2. **R2 Account Protection**:
   - DeviceProfile machine ID binding in `client.rs`.
   - Production URL whitelisting (`https://cloudcode-pa.googleapis.com/v1internal`).
   - 403 quarantine memory state with 5-minute cooldown instead of disk deletion in `claude.rs` and `openai.rs`.
   - Quota fetch 403 isolation in `quota.rs`.
3. **R3 Concurrency & Timeout Elimination**:
   - Expansion of token acquisition timeout to 15s in `token_manager.rs`.
   - Offloading all file operations to `spawn_blocking`.
   - In-memory caching of `gui_config`.
   - Asynchronous background account reloading.
4. **R4 Context Preservation & Protocol Guarding**:
   - Content-hash and LCS alignment in `http_session_store.rs`.
   - Unconditional thinking placeholder pruning.
   - Fail-closed recovery bridge for `call:default_api` in `mappers/openai/streaming.rs` and `mappers/openai/response.rs`.
5. **R5 Geographic & Proxy Fallback**:
   - Reclassification of geo 400 in `handlers/common.rs` as retryable proxy transport failure.
   - Runtime proxy health feedback loop notifying `ProxyPoolManager`.
