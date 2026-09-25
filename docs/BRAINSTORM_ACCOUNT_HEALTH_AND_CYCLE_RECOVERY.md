# Product Discovery & Brainstorming: Account Health, Verification & Cycle Precision

**Product Trio Discovery Document**  
*Framework: Continuous Product Discovery (Teresa Torres, Product Trio: PM, Designer, Engineer)*  
*Module: Account Lifecycle, Quota Engine & Error Handling*

---

## 1. Opportunity & Context

### Objective
Provide a rock-solid, frustration-free account management experience for Antigravity-Manager by eliminating false-positive status flapping (orange/green), restoring complete visibility into verification challenges (fixing inert info buttons), and fixing deceptive weekly cycle countdowns.

### Target Segment
Software developers, engineers, and AI power-users operating high-throughput multi-account pools with Antigravity and Gemini Code Assist.

### Core Problems Identified
1. **Status Flapping (Orange ↔ Green)**: Accounts repeatedly transitioned between "Verification Required" (orange) and normal state (green) within minutes without user intervention.
   - *Root Cause*: Background quota polling encountering transient HTTP 429 (`RESOURCE_EXHAUSTED`) misclassified rate limits as identity verification blocks (`validation_blocked = true`), cached quotas (all 99%), and subsequently cleared the block on the next poll.
2. **Inert Error Details on Orange Accounts**: When accounts turned orange, clicking the details `(i)` button only displayed model quota percentages (99%) and omitted all error causes and recovery actions.
   - *Root Cause*: `AccountDetailsDialog` lacked alerts for `validation_blocked` and `is_forbidden`, table/card status badges were static text spans, and no `onViewError` button was exposed within the table's inline validation banner.
3. **Deceptive Weekly Reset Timers & Stepper Collapse**: Problematic accounts displayed an identical 4.5-hour timer in the 7-day Weekly column, causing the 7-day stepper to collapse below 1 day (0.18 days, burning at 28% on Day 1).
   - *Root Cause*: Quota calculation logic fell back to model-level rolling 5-hour resets when no weekly bucket existed in Google's API response, passing a short 4.5-hour timestamp into the 7-day stepper formula (`4.5h / 24h = 0.18d`).

---

## 2. Multi-Perspective Ideation (Product Trio)

### Perspective A: Product Manager (Value, Strategy & User Trust)
1. **Zero-Panic Rate-Limit Isolation**: Never misclassify transient upstream rate limits (HTTP 429) as security or identity challenges. Rate limits must be transparently absorbed via backoff without locking accounts.
2. **One-Click In-App / Browser Recovery**: Provide direct, one-click access to Google authentication URLs with account-specific hints (`authuser`) rather than generic manual guides.
3. **Honest Quota Transparency**: Strictly differentiate between 5-hour rolling windows and 7-day weekly allowances. If an account has no active weekly restriction, clearly state "Ready" or "N/A" rather than a fabricated countdown.
4. **Account State Timeline & Audit**: Allow users to inspect recent state transitions (e.g. rate-limited at 10:14, cleared at 10:19) to build confidence in system automation.
5. **Pre-Switch Verification Guard**: Prevent accidental IDE/Platform switching into an account that is currently challenge-locked, offering instant verification before switching.

### Perspective B: Product Designer (UX, Ergonomics & Visual Clarity)
1. **Interactive State Badges**: Transform static badges (`Verification Required`, `Forbidden`, `Proxy Disabled`) into interactive chips with hover feedback and direct click-through to error details.
2. **Contextual Status Banners in Details Dialog**: In `AccountDetailsDialog` (opened via `(i)`), display high-priority alerts with direct actions ("Verify in Browser", "View Error Details") before rendering quota bars.
3. **7-Day Liquid Stepper Safeguard**: Enforce that the 7-day liquid stepper and weekly countdown only activate when genuine multi-day cycle data (> 24 hours) is present.
4. **Comprehensive Table Row Actions**: Ensure the table's inline validation banner includes both "Verify in Browser" / "View Guide", "Re-check", and an explicit "View Error" button.
5. **Adaptive Visual Hierarchy for Quotas**: Clearly label the origin of reset timers (Rolling 5-Hour vs Weekly 7-Day) with distinct icon treatments and tooltips.

### Perspective C: Software Engineer (Architecture, Correctness & Reliability)
1. **Strict Error Classification Boundary (Rust Backend)**: Completely decouple `RESOURCE_EXHAUSTED` / 429 from `VALIDATION_REQUIRED` in `account.rs` and `token_manager.rs`. Never set `validation_blocked` inside `recover_cached_quota_on_rate_limit`.
2. **Multi-Day Cycle Filter (`quota.ts`)**: In `getAccountCycleReset`, ignore model-level reset timestamps shorter than 24 hours when evaluating weekly cycles.
3. **Full Quota Fast-Path (`isReady = true`)**: Treat unused or 100% full weekly quotas as fully ready, suppressing dummy sliding timestamps emitted by upstream APIs.
4. **Unified Error Handler Wiring**: Connect `onViewError` across `AccountTable`, `AccountCard`, and `AccountDetailsDialog` so users can inspect diagnostic information from any entry point.
5. **Localization Parity**: Maintain complete dictionary parity across all 13 supported languages for error tooltips, badge labels, and recovery instructions.

---

## 3. Prioritized Top 5 Solutions

| Priority | Feature / Architecture Solution | Focus Area | Impact | Effort |
|---|---|---|---|---|
| **P1** | **Backend Rate-Limit Decoupling** | Rust Backend (`account.rs`) | **Critical**: Eliminates account flapping and fake verification blocks. | Low |
| **P2** | **Multi-Day Cycle Filter & 100% Quota Fast-Path** | Frontend Logic (`quota.ts`) | **High**: Eliminates deceptive weekly countdowns and 0.18-day stepper anomalies. | Low |
| **P3** | **Integrated Status Alerts in Quota Details Modal** | Frontend UI (`AccountDetailsDialog.tsx`) | **High**: Solves the issue where clicking `(i)` hid error details behind 99% quotas. | Low |
| **P4** | **Interactive Status Badges & Table Error Actions** | Frontend UI (`AccountTable.tsx`, `AccountCard.tsx`) | **High**: One-click path from any warning badge to diagnostic error details. | Low |
| **P5** | **Direct Browser Verification with Account Parameterization** | Utility & IPC (`guideOpener.ts`, `AccountErrorDialog.tsx`) | **Medium**: One-click verification in browser, prioritizing user convenience. | Done |

---

## 4. Architectural Details & Assumptions

### 1. Rate-Limit Decoupling
- **Description**: `recover_cached_quota_on_rate_limit` provides a safety fallback during transient rate limits by returning cached model information without marking the account as `validation_blocked`.
- **Key Assumption**: Google's `RESOURCE_EXHAUSTED` responses are temporary and will naturally resolve without requiring the user to complete identity challenges.

### 2. Multi-Day Cycle Filter
- **Description**: `getAccountCycleReset` strictly requires `diff > 24 * 3600 * 1000` when falling back to model `reset_time` during weekly evaluations.
- **Key Assumption**: Model-level `reset_time` from Google is exclusively a 5-hour sliding window; true weekly resets only exist in `quota_groups` buckets.

### 3. Unified Error Disclosure
- **Description**: All entry points (`(i)` button, table badges, card badges, inline banners) route directly to `AccountErrorDialog` while offering direct browser verification links.
- **Key Assumption**: Users prioritize knowing *why* an account is blocked and *how to fix it immediately* without navigating across multiple screens.
