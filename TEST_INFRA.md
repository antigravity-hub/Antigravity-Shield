# Antigravity-Shield: Comprehensive E2E Testing Infrastructure Specification

**Document Status**: AUTHORITATIVE / RATIFIED  
**Version**: 4.7.0  
**Target Environment**: Antigravity-Shield Hardened Proxy Gateway & Account Engine  
**Testing Methodology**: 4-Tier Opaque-Box & Requirement-Driven E2E Framework  
**Scope**: All 14 Hardening Features from `PROJECT.md` & Top Upstream Incidents from `DIAGNOSTIC_AUDIT.md`

---

## 1. Executive Summary & Testing Philosophy

Antigravity-Shield serves as the mission-critical translation bridge and account management layer between autonomous AI coding agents (Claude Code, Cursor, OpenCode, OpenClaw) and Google Cloud Code / Gemini upstream endpoints. In production, failure in this layer leads to developer lockout, account suspensions, token acquisition stalls, and catastrophic context window explosions.

This testing infrastructure enforces an **opaque-box, behavior-centric testing regime** organized into four progressive tiers:
1. **Tier 1 — Feature Coverage**: Comprehensive positive validation for every feature in the Feature Inventory (>= 5 test cases per feature across all 14 features = 70+ cases).
2. **Tier 2 — Boundary & Corner Cases**: Stressing limit conditions, zero states, extreme payloads, malformed inputs, and asynchronous race windows (>= 5 test cases per feature across all 14 features = 70+ cases).
3. **Tier 3 — Cross-Feature Combinations**: Pairwise and compound multi-subsystem interaction tests verifying emergent behavior across concurrent subsystem boundaries.
4. **Tier 4 — Real-World Application Scenarios**: High-fidelity simulation of genuine developer agent sessions under realistic load, network jitter, tool loops, and quota constraints.

---

## 2. The 14 Hardened Features Inventory (Traceability Matrix)

| Feature ID | Feature Name | Architecture Subsystem | Primary Upstream Issues | Hardening Objective |
|---|---|---|---|---|
| **F01** | Upstream Issue Taxonomy & Diagnostic Audit | Root Architecture | All 1,800+ Issues | Formal taxonomy classification and telemetry attribution |
| **F02** | Device Profile Isolation | Anti-Detection & Headers | #655, #1822, #2228 | Per-account virtual hardware fingerprinting (`machine_id`, `mac_machine_id`) |
| **F03** | Safe 403 & Quarantine Protocol | Account Protection | #1822, #2261 | Memory quarantine with 5m cooldown; zero destructive disk deletion |
| **F04** | Production Route Sanitization | Upstream Client | #2261, R2 | Strict production `v1internal` whitelisting; credential log scrubbing |
| **F05** | Token Acquisition Non-Blocking Engine | Concurrency Engine | #3348, #3245, #284 | 15s timeout expansion; async `spawn_blocking` disk offload |
| **F06** | In-Memory Config & Background Reload | Concurrency Engine | #3348, #284 | Cached `gui_config` hot path; asynchronous account pool refresh |
| **F07** | Fine-Grained Locking & Mutex Decoupling | Concurrency Engine | #284, #3348 | Per-account lock granularity; eliminate global mutex starvation |
| **F08** | Robust Context Reconciliation | Session Store | #3382, PR #3337 | LCS & semantic hash alignment; eliminate 2x/4x Cartesian explosion |
| **F09** | Thinking Token Window Compression | Context & Mappers | #3325, #3313 | Unconditional historical thought pruning (`thought: true`) |
| **F10** | OpenAI Gateway Tool-Call Recovery Bridge | Gateway Mappers | #3379, #3300 | Fail-closed recovery of `call:default_api:*` into valid `tool_calls` |
| **F11** | Geo-Location 400 Error Reclassification | Error Classifier | #3301, #3377 | Reclassify location block as `RetryStrategy::ProxyFailover` |
| **F12** | Real-Time Proxy Health Feedback Loop | Proxy Pool Manager | #1583, #3301 | Live transport failure notification; dynamic proxy node rotation |
| **F13** | Comprehensive E2E Regression Test Suite | Verification Gate | Quality Gate | Unified automated test runner covering all client protocols |
| **F14** | Adversarial Coverage Hardening | Verification Gate | System Security | Fuzzing, malformed SSE chunks, thread starvation, extreme payloads |

---

## 3. Tier 1: Feature Coverage Specifications (70 Test Cases)

### Feature 1: Upstream Issue Taxonomy & Diagnostic Audit
- **TC-T1-F01-01**: Diagnostic matrix completeness verification across all 10 major failure categories (C1–C10).
- **TC-T1-F01-02**: Cross-reference integrity linking upstream GitHub issue numbers (#655, #1822, #3348, #3382, #3379, #3301, #1430, #3345, #3322) to specific source files.
- **TC-T1-F01-03**: Error taxonomy telemetry tagger produces standardized diagnostic labels (`[#3379-RECOVERY]`, `[#3382-FALLBACK]`, `[C1-QUARANTINE]`).
- **TC-T1-F01-04**: Concrete code location mapping verification confirming target lines exist in proxy handlers and mappers.
- **TC-T1-F01-05**: Incident severity classification validation (Critical: Account ban/Deadlock; High: Context explosion/Tool break; Medium: Geo 400).

### Feature 2: Device Profile Isolation
- **TC-T1-F02-01**: Verification of unique `machine_id` generation per account profile.
- **TC-T1-F02-02**: Verification of persistent `mac_machine_id` binding to account identity.
- **TC-T1-F02-03**: Isolated `x-vscode-sessionid` generation per application launch without cross-account contamination.
- **TC-T1-F02-04**: Upstream header injection includes `x-client-name: antigravity` and current client version string.
- **TC-T1-F02-05**: Strict non-leakage of physical host `machine_uid` across multiple authenticated accounts.

### Feature 3: Safe 403 & Quarantine Protocol
- **TC-T1-F03-01**: HTTP 403 Forbidden response transitions account into in-memory Quarantine state.
- **TC-T1-F03-02**: In-memory quarantine cooldown enforces a minimum 5-minute isolation period before retry eligibility.
- **TC-T1-F03-03**: Verification that 403 status strictly suppresses `std::fs::remove_file` (zero disk deletion).
- **TC-T1-F03-04**: Quota synchronization 403 error isolation: failure during background quota probe never marks account as forbidden.
- **TC-T1-F03-05**: Automatic recovery: account automatically returns to pool after quarantine expiration or upon successful health probe.

### Feature 4: Production Route Sanitization
- **TC-T1-F04-01**: Production endpoint `https://cloudcode-pa.googleapis.com/v1internal` is strictly whitelisted for all upstream traffic.
- **TC-T1-F04-02**: Non-production, daily, and sandbox endpoints (`daily-cloudcode-pa.sandbox.googleapis.com`) are intercepted and rejected/normalized.
- **TC-T1-F04-03**: Query string preservation during upstream URL construction across `generateContent` and `streamGenerateContent`.
- **TC-T1-F04-04**: Sensitive credential scrubbing in error logs: redaction of Bearer tokens, `refresh_token`, and proxy passwords.
- **TC-T1-F04-05**: Prevention of SSRF and path traversal in base URL concatenation routines.

### Feature 5: Token Acquisition Non-Blocking Engine
- **TC-T1-F05-01**: Token acquisition timeout expansion to 15 seconds (verifying tolerance of 8-12s operations that previously failed at 5s).
- **TC-T1-F05-02**: Offloading of disk storage I/O and configuration writes to `tokio::task::spawn_blocking`.
- **TC-T1-F05-03**: Fast-path token cache retrieval returns cached token in <5ms without lock contention.
- **TC-T1-F05-04**: Background proactive token refresh 300 seconds prior to expiration with randomized jitter.
- **TC-T1-F05-05**: Graceful timeout rejection: when operations exceed 15s, returns structured busy error without thread starvation.

### Feature 6: In-Memory Config & Background Reload
- **TC-T1-F06-01**: In-memory caching of `gui_config` eliminates synchronous JSON disk reads on every proxy request.
- **TC-T1-F06-02**: Asynchronous processing of pending account reload queue outside the request latency path.
- **TC-T1-F06-03**: Thread-safe configuration reads using `RwLock` / `DashMap` under concurrent multi-agent traffic.
- **TC-T1-F06-04**: Immediate memory cache invalidation and atomic update upon explicit configuration mutations.
- **TC-T1-F06-05**: Fallback resilience: corrupted configuration on disk defaults to baseline in-memory settings.

### Feature 7: Fine-Grained Locking & Mutex Decoupling
- **TC-T1-F07-01**: Independent per-account lock acquisition: operations on Account A do not acquire or block lock on Account B.
- **TC-T1-F07-02**: Concurrent token requests for distinct accounts execute in parallel with 0 wait time.
- **TC-T1-F07-03**: Same-account contention queue preserves FIFO order without thread starvation.
- **TC-T1-F07-04**: Elimination of monolithic `ACCOUNT_INDEX_LOCK` from the critical token lookup path.
- **TC-T1-F07-05**: Lock-free status inspection: reading account availability does not acquire exclusive write locks.

### Feature 8: Robust Context Reconciliation
- **TC-T1-F08-01**: Exact replay prefix match: when `new_input` starts with `history`, only delta turns are extracted.
- **TC-T1-F08-02**: Semantic prefix match: client regenerating turn IDs with identical role and content successfully dedupes history.
- **TC-T1-F08-03**: Semantic suffix match: intermediate tool call turns are preserved without duplicate historical turn appending.
- **TC-T1-F08-04**: Fallback protection: when boundary detection fails but `new_input.len() >= history.len()`, history is not doubled.
- **TC-T1-F08-05**: Context compaction reset: receipt of `compaction` or `compaction_summary` sentinel resets conversation history cleanly.

### Feature 9: Thinking Token Window Compression
- **TC-T1-F09-01**: Unconditional pruning of historical reasoning blocks (`thought: true`) across all past turns.
- **TC-T1-F09-02**: Cryptographic `thoughtSignature` preservation on the latest active reasoning turn.
- **TC-T1-F09-03**: Effective token ceiling preservation: multi-turn sessions remain bounded under 200K tokens instead of breaching 1M.
- **TC-T1-F09-04**: Trailing signature staging: handling empty thinking parts with attached signatures.
- **TC-T1-F09-05**: Synthetic tool loop closure: injecting model completion and user continue sentinels for thinking models.

### Feature 10: OpenAI Gateway Tool-Call Recovery Bridge
- **TC-T1-F10-01**: Detection of plaintext `call:default_api:ToolName{...}` in OpenAI streaming chunk deltas.
- **TC-T1-F10-02**: Structured translation of recovered tool calls into OpenAI standard `tool_calls` format with arguments JSON.
- **TC-T1-F10-03**: Whitelist verification: only registered client tool names are promoted to `tool_calls`.
- **TC-T1-F10-04**: Fail-closed fallback: malformed arguments or unregistered tools safely remain as assistant text.
- **TC-T1-F10-05**: Non-streaming OpenAI response mapper recovery for complete `call:default_api:*` responses.

### Feature 11: Geo-Location 400 Error Reclassification
- **TC-T1-F11-01**: Reclassification of status 400 with 'User location is not supported' as `RetryStrategy::ProxyFailover`.
- **TC-T1-F11-02**: Case-insensitive matching covering variants: 'user location is not supported', 'geofenced', 'region restricted'.
- **TC-T1-F11-03**: Account preservation: account encountering geo-400 is NOT marked as invalid, banned, or rate-limited.
- **TC-T1-F11-04**: Strict distinction between transport geo-400 and genuine semantic bad request 400 (e.g. invalid parameter).
- **TC-T1-F11-05**: Immediate proxy rotation trigger: signal dispatched to proxy pool upon geo-400 detection.

### Feature 12: Real-Time Proxy Health Feedback Loop
- **TC-T1-F12-01**: Dispatch of transport failure notifications from upstream client to `ProxyPoolManager`.
- **TC-T1-F12-02**: Dynamic rotation to next available healthy proxy node in the active pool.
- **TC-T1-F12-03**: Google-specific health probing via HTTPS CONNECT to verify Google edge reachability.
- **TC-T1-F12-04**: Penalization and cooldown of failing proxy nodes to prevent cascading retry storms.
- **TC-T1-F12-05**: Graceful fallback to secondary proxy or direct egress if all pool nodes fail.

### Feature 13: Comprehensive E2E Regression Test Suite
- **TC-T1-F13-01**: End-to-end OpenAI `/v1/chat/completions` translation and execution against mock upstream.
- **TC-T1-F13-02**: End-to-end Claude `/v1/messages` translation and execution against mock upstream.
- **TC-T1-F13-03**: Bidirectional streaming SSE translation for both OpenAI and Claude protocols.
- **TC-T1-F13-04**: Usage telemetry and token counting validation across all mapped requests.
- **TC-T1-F13-05**: Sub-30 second test suite execution time with deterministic assertions.

### Feature 14: Adversarial Coverage Hardening
- **TC-T1-F14-01**: High-frequency concurrent request burst (50 concurrent calls) simulating sudden multi-agent compile spikes.
- **TC-T1-F14-02**: Truncated and malformed SSE chunks handling without process crash or hang.
- **TC-T1-F14-03**: Unicode and special character preservation in prompt and tool call arguments.
- **TC-T1-F14-04**: Network socket disconnect mid-stream handled with clean resource cleanup.
- **TC-T1-F14-05**: Prevention of memory leaks during long-running streaming proxy sessions.

---

## 4. Tier 2: Boundary & Corner Cases Specifications (70 Test Cases)

### Feature 1: Diagnostic Taxonomy Boundary Cases
- **TC-T2-F01-01**: Missing diagnostic headers in error response defaults to unclassified category safely.
- **TC-T2-F01-02**: Telemetry log size bounded to prevent disk exhaustion during error floods.
- **TC-T2-F01-03**: Unrecognized error status codes (e.g. HTTP 418, 599) categorized into generic fallback.
- **TC-T2-F01-04**: Diagnostic audit Markdown parser handles corrupted frontmatter without panic.
- **TC-T2-F01-05**: Handling of simultaneous multi-category error conditions (e.g. 429 inside 403 body).

### Feature 2: Device Profile Boundary Cases
- **TC-T2-F02-01**: Empty or unreadable hardware UUID environment defaults to per-account cryptographic salted hash.
- **TC-T2-F02-02**: Non-ASCII characters in host username or machine name are safely sanitized in headers.
- **TC-T2-F02-03**: Concurrent generation of 100 device profiles yields zero collisions in `machine_id`.
- **TC-T2-F02-04**: Corrupted `storage.json` file recovered without losing account device binding.
- **TC-T2-F02-05**: Maximum header length limits enforced preventing HTTP 431 Request Header Fields Too Large.

### Feature 3: Safe 403 & Quarantine Boundary Cases
- **TC-T2-F03-01**: 403 response with empty response body triggers quarantine without panic.
- **TC-T2-F03-02**: Quarantine cooldown boundary check: request at 299s rejected, request at 301s admitted.
- **TC-T2-F03-03**: High-frequency burst of 403 errors on single account safely deduplicated in quarantine registry.
- **TC-T2-F03-04**: 403 with HTML Google Cloud error page parsed cleanly without JSON deserialization error.
- **TC-T2-F03-05**: All accounts entering quarantine simultaneously returns clean HTTP 503 Service Unavailable.

### Feature 4: Production Route Boundary Cases
- **TC-T2-F04-01**: URL containing `cloudcode-pa.googleapis.com` as query parameter or userinfo rejected.
- **TC-T2-F04-02**: IPv6 loopback and RFC1918 private IP addresses blocked in upstream routing.
- **TC-T2-F04-03**: Method name containing URL path traversal sequences (`../`) rejected before dispatch.
- **TC-T2-F04-04**: Extremely long query string (8KB) handled without buffer truncation or memory leak.
- **TC-T2-F04-05**: Upstream endpoint switching during runtime hot reload applies atomically to inflight requests.

### Feature 5: Token Acquisition Timeout Boundary Cases
- **TC-T2-F05-01**: Exact 15.000s boundary timeout test: verifies task cancellation and lock release.
- **TC-T2-F05-02**: Zero-millisecond timeout specification defaults safely to standard 15s timeout.
- **TC-T2-F05-03**: 200 concurrent tasks competing for 1 available token: zero deadlocks, orderly queue drain.
- **TC-T2-F05-04**: Client disconnection during token acquisition aborts underlying task cleanly.
- **TC-T2-F05-05**: Token expiration at exact moment of acquisition triggers synchronous renewal before dispatch.

### Feature 6: In-Memory Config Boundary Cases
- **TC-T2-F06-01**: Zero-byte configuration file on disk falls back to compiled default settings.
- **TC-T2-F06-02**: Config reload during active high-throughput read operations has zero data races.
- **TC-T2-F06-03**: Partial JSON write on disk detected by validation checksum and ignored.
- **TC-T2-F06-04**: Configuration with 1,000 defined accounts parsed and cached within <50ms.
- **TC-T2-F06-05**: Unicode account labels and non-standard characters preserved intact in cache.

### Feature 7: Fine-Grained Locking Boundary Cases
- **TC-T2-F07-01**: Circular lock dependency avoidance between account quota lock and token lock.
- **TC-T2-F07-02**: Lock release guarantees on task panic or cancellation via RAII guard.
- **TC-T2-F07-03**: Maximum lock acquisition queue depth capped to prevent memory bloat under DDoS.
- **TC-T2-F07-04**: Single account saturated with requests while 99 idle accounts remain immediately accessible.
- **TC-T2-F07-05**: Rapid account deletion while lock is actively held handles cleanup gracefully.

### Feature 8: Robust Context Reconciliation Boundary Cases
- **TC-T2-F08-01**: Empty `history` and empty `new_input` produces empty delta and empty merged result.
- **TC-T2-F08-02**: `new_input` containing fewer items than `history` (client context truncation) handled safely.
- **TC-T2-F08-03**: History with 500 conversation turns reconciled in <10ms without stack overflow.
- **TC-T2-F08-04**: Turn content with large base64 image strings reconciled by reference without memory copy.
- **TC-T2-F08-05**: Rapid alternating role messages (`user`, `user`, `user`) preserved in exact order.

### Feature 9: Thinking Token Compression Boundary Cases
- **TC-T2-F09-01**: Message containing 100 consecutive thinking blocks stripped cleanly in single pass.
- **TC-T2-F09-02**: Thinking block with 500,000 characters of reasoning pruned without regex catastrophic backtracking.
- **TC-T2-F09-03**: Message with only thinking blocks and zero text preserved with synthetic placeholder.
- **TC-T2-F09-04**: Case sensitivity in `thoughtSignature` validated against Google API schema.
- **TC-T2-F09-05**: Pruning applied consistently across both Claude and OpenAI request mappers.

### Feature 10: OpenAI Tool Recovery Boundary Cases
- **TC-T2-F10-01**: `call:default_api:*` with partial JSON arguments across split streaming chunks.
- **TC-T2-F10-02**: Tool call with nested JSON object arguments containing escaped quotes and brackets.
- **TC-T2-F10-03**: Text containing `call:default_api:` inside a markdown code block preserved as literal text.
- **TC-T2-F10-04**: Tool call where function name matches registered tool but arguments are an empty object `{}`.
- **TC-T2-F10-05**: Multiple `call:default_api:*` invocations in a single streaming response.

### Feature 11: Geo-Location 400 Boundary Cases
- **TC-T2-F11-01**: 400 error body containing mixed error messages ('User location is not supported and invalid argument').
- **TC-T2-F11-02**: Empty 400 response body does NOT trigger geo failover (treated as genuine 400).
- **TC-T2-F11-03**: Non-UTF-8 binary bytes in 400 response body handled without panic.
- **TC-T2-F11-04**: Geo-400 error received when proxy pool contains exactly 1 proxy node handles exhaustion cleanly.
- **TC-T2-F11-05**: Geo-400 error with HTML Google block page parsed for geofence keywords.

### Feature 12: Real-Time Proxy Health Boundary Cases
- **TC-T2-F12-01**: All proxy nodes failing health check simultaneously enters graceful degraded state.
- **TC-T2-F12-02**: Proxy latency spike to 30s during health probe times out cleanly without blocking requests.
- **TC-T2-F12-03**: Proxy returning HTTP 407 Proxy Authentication Required categorized as proxy transport error.
- **TC-T2-F12-04**: Rapid flapping proxy node (alternating success/fail) dampened by exponential penalty.
- **TC-T2-F12-05**: Upstream client automatically re-establishes TCP connection pool on proxy switch.

### Feature 13: E2E Test Runner Boundary Cases
- **TC-T2-F13-01**: Mock server port collision automatically binds to next available ephemeral port.
- **TC-T2-F13-02**: Premature client termination emits clean error event without hanging test suite.
- **TC-T2-F13-03**: Tests run in strict isolation with zero cross-test state leakage.
- **TC-T2-F13-04**: Test execution under simulated CPU throttling (2x slow down) still passes within timeout.
- **TC-T2-F13-05**: Verification that test suite exits with non-zero code on any single test assertion failure.

### Feature 14: Adversarial Boundary Cases
- **TC-T2-F14-01**: JSON bombs (nested objects 200 levels deep) rejected safely during parsing.
- **TC-T2-F14-02**: Billion Laughs entity expansion attack in XML payloads blocked.
- **TC-T2-F14-03**: Null byte injection (`%00`) in URLs and model names stripped or rejected.
- **TC-T2-F14-04**: HTTP header injection (CRLF sequences) in account parameters rejected.
- **TC-T2-F14-05**: Extremely large single SSE chunk (10MB) streamed without process OOM crash.

---

## 5. Tier 3: Cross-Feature Combinations (Pairwise Interaction Matrix)

| Interaction ID | Primary Features | Compound Scenario & Verification Objective |
|---|---|---|
| **TC-T3-01** | F02 + F03 + F04 | **Account Isolation Under 403 & Production Routing**: When Account A receives a 403 on production route, it enters quarantine while Account B continues using its isolated `DeviceProfile` on production route without interruption. |
| **TC-T3-02** | F05 + F06 + F07 | **Concurrency Burst Under Heavy I/O**: 20 concurrent requests trigger token acquisition; in-memory config cache and fine-grained per-account locks prevent lock starvation, and 15s timeout easily accommodates disk persistence offloaded to `spawn_blocking`. |
| **TC-T3-03** | F08 + F09 + F10 | **Long-Horizon Multi-Turn Agent with Thinking & Pseudocode Tools**: In an 8-turn conversation, historical thinking blocks are pruned to keep prompt size <100K, session reconciliation avoids duplicate history, and Gemini 3.7 pseudocode tool call is recovered into valid OpenAI/Claude format. |
| **TC-T3-04** | F11 + F12 + F03 | **Geographic Geofence Failover Without Account Invalidation**: Upstream returns 400 'User location is not supported'; proxy health feedback loop immediately rotates to next proxy node; account is NOT quarantined, and retry succeeds over healthy node. |
| **TC-T3-05** | F05 + F03 + F07 | **Quarantined Account Bypass in Token Pool**: When an account is quarantined due to 403, fine-grained locks allow token scheduler to skip quarantined account instantly and acquire token from next active account in <2ms. |
| **TC-T3-06** | F08 + F10 + F13 | **Context Replay with Recovered Tool Use**: Claude gateway recovers `call:default_api:run_command` in turn N; on turn N+1, client submits tool result; session store correctly reconciles history and preserves recovered tool call without syntax corruption. |
| **TC-T3-07** | F04 + F11 + F12 | **Sanitized Route Dispatch Across Proxy Pool**: Request dispatched strictly to production `v1internal` endpoint through dynamic proxy pool; node failure triggers failover while destination URL remains strictly sanitized. |
| **TC-T3-08** | F06 + F07 + F08 | **Background Account Reload During Active Multi-Turn Streaming**: Account pool is reloaded in background task while active multi-turn SSE streams are flowing through session store; zero lock contention or stream stutter. |
| **TC-T3-09** | F09 + F06 + F05 | **Thinking Pruning Under Memory Pressure**: High concurrency requests pruning thinking tokens while memory cache operates under load; memory usage remains stable with zero leak. |
| **TC-T3-10** | F02 + F11 + F12 | **Device Fingerprint Stability Across Proxy Rotations**: When proxy node rotates due to geo-400, the account-bound `DeviceProfile` (`x-machine-id`, `x-vscode-sessionid`) remains stable, preventing Google risk triggers from simultaneous IP and fingerprint change. |

---

## 6. Tier 4: Real-World Application Scenarios

### Scenario RW-01: Claude Code Autonomous Refactoring Loop
- **Client**: Claude Code CLI  
- **Protocol**: Claude `/v1/messages` (Streaming SSE)  
- **Workflow**: 6-turn autonomous edit cycle.  
  1. Turn 1: User requests refactoring. Agent responds with thinking block + `read_file` tool call.
  2. Turn 2: Tool result returned. Agent emits thinking block + `call:default_api:run_command` pseudocode leak.
  3. Turn 3: Gateway recovers pseudocode into Claude `tool_use`. Tool result returned.
  4. Turn 4: Historical thinking blocks pruned from turns 1-2. Token count stays bounded.
  5. Turn 5: Agent performs code edit via tool call.
  6. Turn 6: Agent outputs final success explanation.
- **Pass Criteria**: All 6 turns complete without context duplication; token count never spikes 2x; all tool calls recovered and executed.

### Scenario RW-02: Cursor Composer Multi-File Feature Generation
- **Client**: Cursor IDE  
- **Protocol**: OpenAI `/v1/chat/completions` (Streaming SSE)  
- **Workflow**: High-context prompt (60K tokens) requesting multi-file edits across 4 files.  
  1. Client sends full conversation history with client-regenerated message IDs.
  2. Proxy session store performs semantic LCS matching, extracting only new instructions.
  3. Upstream emits Gemini 3.7 streaming tokens. Thinking tokens pruned from historical payload.
  4. Proxy streams standard OpenAI delta chunks to Cursor without timeout.
- **Pass Criteria**: Zero Cartesian history doubling; stream latency to first token <1.5s; total tokens match expected single-pass length.

### Scenario RW-03: OpenCode Dual-Agent Swarm with High Concurrency
- **Client**: OpenCode Multi-Agent System  
- **Protocol**: Dual concurrent sessions (Agent A and Agent B) hitting proxy simultaneously.  
- **Workflow**:  
  1. Agent A and Agent B simultaneously request tokens for model `gemini-2.5-pro`.
  2. Token manager acquires tokens concurrently using fine-grained locks (<10ms).
  3. Disk writes for quota tracking offloaded to `spawn_blocking`.
  4. 15s timeout ceiling guarantees zero timeouts under burst disk activity.
- **Pass Criteria**: 0 timeouts; 0 mutex deadlocks; both agent sessions complete concurrently.

### Scenario RW-04: Resilient Recovery from Geofenced Proxy Node
- **Client**: OpenClaw Autonomous Worker  
- **Protocol**: OpenAI `/v1/responses`  
- **Workflow**:  
  1. Agent request dispatched through Proxy Node 1.
  2. Google edge returns HTTP 400 'User location is not supported'.
  3. Gateway error classifier identifies `ProxyFailover`.
  4. Account is NOT quarantined. Proxy pool marks Node 1 unhealthy and selects Node 2.
  5. Request retried over Node 2 and succeeds with HTTP 200.
- **Pass Criteria**: End-to-end transparent recovery; client receives successful response with 0 manual intervention.

### Scenario RW-05: Rate-Limit Grace Retry with Cooldown Handling
- **Client**: Autonomous Test Harness  
- **Protocol**: Standard OpenAI / Claude endpoints  
- **Workflow**:  
  1. Account A encounters HTTP 429 with `Retry-After: 2`.
  2. Gateway initiates Grace Retry on same account after 2s delay.
  3. Second request encounters HTTP 429 quota exhaustion (`quotaResetDelay: 60s`).
  4. Gateway rotates to Account B immediately; Account A enters temporary rate-limit cooldown without deletion.
- **Pass Criteria**: Account A preserved on disk; request seamlessly satisfied by Account B.

---

## 7. Automated Test Suite Architecture & Directory Layout

```
tests/
└── e2e/
    ├── harness/
    │   ├── mock_upstream.ts         # High-fidelity mock Google/Claude/OpenAI upstream server
    │   ├── test_context.ts          # Ephemeral test state, accounts, and server lifecycles
    │   └── assertions.ts            # Domain-specific assertions and protocol validators
    ├── suites/
    │   ├── oauth_concurrency_timeout.test.ts # F05, F06, F07 (15s timeout vs 5s concurrency)
    │   ├── context_deduplication.test.ts     # F08 (Semantic LCS & non-duplication)
    │   ├── url_sanitization.test.ts          # F04 (Production whitelisting & log redaction)
    │   ├── error_categorization.test.ts      # F03, F11 (429 vs 403 quarantine)
    │   ├── device_profile_isolation.test.ts  # F02 (Machine ID & fingerprint isolation)
    │   ├── gemini_tool_recovery.test.ts      # F09, F10 (Thinking pruning & pseudocode bridge)
    │   └── geo_location_failover.test.ts     # F11, F12 (Geo 400 & proxy health feedback)
    └── runner.ts                    # Automated master test runner with TAP/JSON reporting
```

### Execution Command:
```bash
npx tsx tests/e2e/runner.ts
```

---

## 8. Expected Output Derivation & Verification Oracles

Every test case derives its authoritative truth from:
1. **Mathematical Contracts**: Levenshtein distance, Longest Common Subsequence (LCS) algorithms, and SHA-256 content hashes for context deduplication.
2. **Upstream Protocol Specifications**: Google Cloud Code `v1internal` Protobuf/JSON schema, Anthropic Claude Messages API specification, and OpenAI Chat Completions REST API schema.
3. **Verified Upstream Issue Root Causes**: Formal error payloads recorded in `DIAGNOSTIC_AUDIT.md` (e.g. Google `type.googleapis.com/google.rpc.RetryInfo`, Gemini 3.7 `call:default_api:*` BNF syntax).
4. **Deterministic Mock Oracles**: Local mock HTTP endpoints capturing exact request headers, bodies, timestamps, and connection states to guarantee reproducibility without external network dependencies.
