# ⚖️ Antigravity Shield — Legal, Licensing, Copyright & Upstream Sourcing Guide

**Document Version:** 1.0.0  
**Effective Date:** 2026-11-04  
**Applies To:** Antigravity Manager, Antigravity Shield, `github.com/antigravity-hub/skills`, and `skills.sh` Ecosystem Integrations  
**Jurisdictions Covered:** United States (17 U.S.C.), European Union (Directive (EU) 2019/790 & Regulation (EU) 2022/2065 DSA), Berne Convention for the Protection of Literary and Artistic Works  

---

## 1. Executive Summary & Legal Framework

### 1.1 Context and Mission
The Antigravity ecosystem curates, indexes, and provisions over 1,000 production-grade AI agent skills (`SKILL.md` documents, executable helper scripts, procedural rules, and architectural knowledge modules). These skills are sourced across heterogeneous public repositories, developer communities, and package registries (notably `skills.sh`, GitHub, and npm).

Our core architectural and ethical mandate is **Zero Infringement, Uncompromised Attribution, and Total Provenance Integrity**. Operating an aggregator and distributor at this scale demands a rigorous legal and technical governance model that protects:
1. **Original Creators:** Safeguarding upstream intellectual property rights, ensuring verbatim attribution, and honoring licensing boundaries.
2. **End Users & Enterprises:** Protecting downstream developers and corporate deployments from copyright infringement liability, license contamination (e.g. copyleft virality), and tainted provenance.
3. **The Antigravity Platform & Ecosystem:** Establishing distributor immunity under established safe harbor frameworks, statutory exceptions, and judicial doctrines across US, EU, and international legal systems.

### 1.2 The Three Pillars of Antigravity Governance
Antigravity governance is constructed upon three structural pillars:
1. **The Server Test & Factual Indexing (Operation A & B):** Referencing public repositories, metadata aggregation, search indexing, and deep-linking do not constitute copyright reproduction or distribution under 17 U.S.C. § 106. Factual compilations are protected under 17 U.S.C. § 102(b) and § 107.
2. **Dual-Tier Distribution Architecture (Operation C):** Strict physical and logical bifurcation between **Tier 1 (Permissive Open-Source Mirroring)** and **Tier 2 (Reference-Only Client Linking)**. Verbatim third-party assets are never centrally mirrored, repackaged, or served without an express open-source license grant.
3. **Mandatory Provenance, Bundling & Attribution:** Strict preservation of upstream `LICENSE` files, Apache 2.0 `NOTICE` files, author credits, and machine-readable cryptographic commit provenance headers in every distributed artifact.

### 1.3 International Statutory Foundations
This guide and its operational runtime are built upon and compliant with:
- **United States Copyright Act (Title 17 of the United States Code):**
  - 17 U.S.C. § 101 (Definitions of literary works, computer programs, and derivative works).
  - 17 U.S.C. § 102 (Subject matter of copyright; idea/expression dichotomy and methods of operation).
  - 17 U.S.C. § 106 (Exclusive rights of copyright owners: reproduction, adaptation, distribution).
  - 17 U.S.C. § 107 (Limitations on exclusive rights: Fair Use).
  - 17 U.S.C. § 512 (Online Copyright Infringement Liability Limitation Act / DMCA Safe Harbors).
- **European Union Legal Directives & Regulations:**
  - Directive (EU) 2019/790 on Copyright and Related Rights in the Digital Single Market (CDSM).
  - Regulation (EU) 2022/2065 on a Single Market for Digital Services (Digital Services Act - DSA, Articles 16–20).
  - Directive 2001/29/EC (InfoSoc Directive) on copyright harmonization in the information society.
- **International Treaties:**
  - The Berne Convention for the Protection of Literary and Artistic Works (Paris Act of July 24, 1971).
  - The WIPO Copyright Treaty (WCT, 1996).
  - The Agreement on Trade-Related Aspects of Intellectual Property Rights (TRIPS, 1994).

---

## 2. Copyright Considerations for AI Agent Skills (17 U.S.C. §§ 101, 102, 106, 107)

### 2.1 Anatomy and Legal Classification of an AI Agent Skill
An AI agent skill packaged as a `SKILL.md` bundle is a hybrid digital work consisting of heterogeneous technical and creative components. Applying a blanket copyright rule across an entire skill is legally unsound; each component possesses a distinct statutory classification under 17 U.S.C. § 101 and § 102:

| Skill Component | Example Artifacts | Statutory Classification | Copyrightability & Legal Status | Primary Precedent & Authority |
|---|---|---|---|---|
| **Frontmatter & Functional Metadata** | YAML header (`name:`, `description:`, `triggers:`, `argument-hint:`, `tags:`, `parameters:`) | System metadata, specifications, and methods of operation (17 U.S.C. § 102(b)) | **Non-Copyrightable Facts.** Unprotected ideas, functional keys, and system triggers. Compilations receive "thin" protection against verbatim database scraping only. | *Feist Publications, Inc. v. Rural Tel. Serv. Co.*, 499 U.S. 340 (1991); *Baker v. Selden*, 101 U.S. 99 (1879); *Lotus Dev. Corp. v. Borland Int'l, Inc.*, 49 F.3d 807 (1st Cir. 1995). |
| **Procedural Directives & Workflow Invariants** | System prompts, behavioral guidelines, reasoning instructions, step-by-step algorithms, error recovery prose | Literary Work (17 U.S.C. § 101) | **Copyrightable Expression.** The creative authorial selection, phrasing, architectural nuance, and specific verbal arrangement are protected by copyright. | *Google LLC v. Oracle America, Inc.*, 141 S. Ct. 1183 (2021); *Computer Associates Int'l, Inc. v. Altai, Inc.*, 982 F.2d 693 (2d Cir. 1992). |
| **Companion Scripts & Tools** | Executable automation scripts (`scripts/*.py`, `*.sh`, `*.js`, `*.ps1`) | Computer Program (17 U.S.C. § 101) | **Copyrightable Software.** Fully protected literary works subject to software copyright law and specific open-source licenses. | 17 U.S.C. § 101; *Apple Computer, Inc. v. Franklin Computer Corp.*, 714 F.2d 1240 (3d Cir. 1983). |
| **Architectural Reference Docs** | Reference markdown files (`references/*.md`, API specs) | Literary Work (17 U.S.C. § 101) | **Copyrightable Documentation.** Creative explanations, diagrams, and domain synthesis are protected. | *Feist*, 499 U.S. 340; *Harper & Row v. Nation Enterprises*, 471 U.S. 539 (1985). |
| **Translations & Adaptations** | Persian documentation (`doc.fa.md`), localized prompts | Derivative Work (17 U.S.C. § 101, § 106(2)) | **Derivative Copyright.** Requires lawful authorization from the original copyright holder unless the underlying work is licensed under permissive terms. | 17 U.S.C. § 106(2); *Radji v. Khakbaz*, 607 F. Supp. 1296 (D.D.C. 1985). |

### 2.2 Analysis of Core Distributor Operations
Antigravity Shield engages in three distinct technical operations with third-party skill repositories:

#### Operation A: Catalog Referencing & Deep Linking
- **Mechanism:** Antigravity Manager indexes skill identifiers, author handles, repository URLs, install counts, and descriptive summaries in `src/config/skillsCatalog.ts`.
- **Copyright Analysis (The Server Test):**
  - Under the landmark Ninth Circuit doctrine established in *Perfect 10, Inc. v. Amazon.com, Inc.*, 508 F.3d 1146 (9th Cir. 2007), copyright infringement of the reproduction right (17 U.S.C. § 106(1)) or distribution right (§ 106(3)) requires that a copy of the protected work be hosted or transmitted directly from the defendant's server.
  - Hyperlinking, indexing, and deep-linking do not transmit or reproduce copyrighted bytes. The user's client browser or agent is directed to retrieve the data directly from the author's public host.
  - In the European Union, the Court of Justice of the European Union (CJEU) affirmed in *Svensson and Others v. Retriever Sverige AB* (Case C-466/12, 2014) and *GS Media BV v. Sanoma Media Netherlands BV* (Case C-160/15, 2016) that providing a hyperlink to a work freely accessible on another website does not constitute a "communication to the public" under Article 3(1) of Directive 2001/29/EC.
  - **Conclusion:** Indexing and linking to public upstream skills is **100% non-infringing as a matter of settled law**.

#### Operation B: Search Indexing & Factual Compilation
- **Mechanism:** Ingestion and organization of skill names, categories, taxonomy tags, and telemetry metrics to provide a structured discovery interface.
- **Copyright Analysis (Transformative Fair Use):**
  - Under 17 U.S.C. § 107, four non-exclusive statutory factors govern Fair Use:
    1. *Purpose and character of the use:* Highly transformative. Creating a functional, searchable catalog that enables interoperability across 20 AI agents serves a distinct functional purpose from the underlying creative instruction (*Kelly v. Arriba Soft Corp.*, 336 F.3d 811 (9th Cir. 2003); *Authors Guild v. Google, Inc.*, 804 F.3d 202 (2d Cir. 2015)).
    2. *Nature of the copyrighted work:* The indexed components (names, parameters, short descriptions) are factual and functional, lying at the perimeter of copyright protection.
    3. *Amount and substantiality used:* Only brief snippets and factual parameters necessary for catalog navigation are indexed.
    4. *Effect upon the potential market:* The Antigravity index enhances the discovery, attribution, and adoption of upstream skills, actively benefiting original creators rather than supplanting their market.
  - **Conclusion:** Catalog aggregation constitutes **lawful transformative fair use under 17 U.S.C. § 107**.

#### Operation C: Persistent Central Mirroring & Redistribution
- **Mechanism:** Uploading third-party `SKILL.md` files, companion scripts, and translated documentation to a centralized repository (`github.com/antigravity-hub/skills`) and serving them via Content Delivery Networks (CDNs, e.g. jsDelivr, GitHub Pages).
- **Copyright Analysis (Reproduction & Distribution Bar):**
  - Unlike referencing, persistent mirroring involves copying protected expression to our servers (§ 106(1)) and distributing those copies to end-users (§ 106(3)).
  - This operation is **strictly prohibited without an express, legally binding open-source license grant** from the copyright holder.
  - **The GitHub Myth Rebutted:** A common fallacy among developers assumes that publishing a repository publicly on GitHub places it in the "public domain" or allows arbitrary re-distribution. This is legally false. Section D.4 of the GitHub Terms of Service specifies that by setting a repository to public, the author grants other GitHub users rights to view and fork the repository *within the GitHub service*. It does NOT grant third parties the right to extract, re-license, bundle, mirror on external CDNs, or create standalone distribution networks. Unlicensed public repositories remain **All Rights Reserved** under the Berne Convention.

---

## 3. Comprehensive License Compatibility Matrix

To operationalize legal compliance, Antigravity Shield evaluates every indexed skill against the following authoritative compatibility matrix:

| License Family | Canonical SPDX ID | Classification | Ecosystem Tier | Commercial Use | Mirroring & CDN Delivery | Modification & Derivative (`doc.fa.md`) | Mandatory Conditions & Attribution Invariants |
|---|---|---|---|---|---|---|---|
| **MIT License** | `MIT` | Permissive | **Tier 1 (Mirrorable)** | ✅ Yes | ✅ Yes | ✅ Yes | Must retain verbatim copyright notice and permission notice in all copies or substantial portions. |
| **Apache License 2.0** | `Apache-2.0` | Permissive | **Tier 1 (Mirrorable)** | ✅ Yes | ✅ Yes | ✅ Yes | Must retain license text (§ 4a), state prominent modifications (§ 4b), retain copyright/patent/trademark notices (§ 4c), and **redistribute the upstream `NOTICE` file** if present (§ 4d). Includes patent grant (§ 3). |
| **BSD 2-Clause** | `BSD-2-Clause` | Permissive | **Tier 1 (Mirrorable)** | ✅ Yes | ✅ Yes | ✅ Yes | Must retain copyright notice, condition list, and disclaimer in source code and binary redistributions. |
| **BSD 3-Clause** | `BSD-3-Clause` | Permissive | **Tier 1 (Mirrorable)** | ✅ Yes | ✅ Yes | ✅ Yes | BSD-2 requirements PLUS: neither author nor contributor names may be used to endorse or promote derived products without prior written consent. |
| **ISC License** | `ISC` | Permissive | **Tier 1 (Mirrorable)** | ✅ Yes | ✅ Yes | ✅ Yes | Must retain verbatim copyright notice and permission notice. Functionally equivalent to 2-Clause BSD. |
| **Creative Commons Zero** | `CC0-1.0` | Permissive (Public Domain) | **Tier 1 (Mirrorable)** | ✅ Yes | ✅ Yes | ✅ Yes | Unconditional dedication to public domain worldwide; fallback waiver of all copyright and neighboring rights. |
| **The Unlicense** | `Unlicense` | Permissive (Public Domain) | **Tier 1 (Mirrorable)** | ✅ Yes | ✅ Yes | ✅ Yes | Public domain dedication with non-warranty disclaimer. Universal permission granted. |
| **Creative Commons Attribution 4.0** | `CC-BY-4.0` | Permissive | **Tier 1 (Mirrorable)** | ✅ Yes | ✅ Yes | ✅ Yes | Must provide attribution to creator, notice of license, disclaimer of warranties, and URI/link to material. |
| **GNU General Public License v2** | `GPL-2.0-only` / `GPL-2.0-or-later` | Strong Copyleft | **Tier 2 (Reference-Only)** | ✅ Yes | ⚠️ Restricted | ⚠️ Strong Copyleft | Mandatory distribution of complete corresponding source code. Any derivative work must be licensed under GPLv2. Central registry mirroring risks copyleft contamination. |
| **GNU General Public License v3** | `GPL-3.0-only` / `GPL-3.0-or-later` | Strong Copyleft | **Tier 2 (Reference-Only)** | ✅ Yes | ⚠️ Restricted | ⚠️ Strong Copyleft | Viral copyleft requirement (§ 5). Anti-Tivoization hardware clauses (§ 6). Incompatible with proprietary or permissive multi-skill bundles. Must be installed directly via client CLI. |
| **GNU Affero GPL v3** | `AGPL-3.0-only` / `AGPL-3.0-or-later` | Network Copyleft | **Tier 2 (Reference-Only)** | ✅ Yes | ⚠️ Restricted | ⚠️ Network Viral | Extends copyleft to network interactions (§ 13). Triggered when run across client-server agent networks. Strictly reference-only. |
| **Mozilla Public License 2.0** | `MPL-2.0` | Weak Copyleft | **Tier 2 (Reference-Only)** | ✅ Yes | ⚠️ Restricted | ⚠️ File-Level Copyleft | File-level copyleft. Modifications to covered files must remain MPL-2.0. Mirroring allowed only with source offer. |
| **CC NonCommercial 4.0** | `CC-BY-NC-4.0` | Restricted | **Tier 2 (Reference-Only)** | ❌ No | ❌ No | ⚠️ NonCommercial Only | Prohibits commercial reproduction or exploitation. Centralized hosting in commercial developer tools violates NC restrictions. |
| **CC NoDerivatives 4.0** | `CC-BY-ND-4.0` | Restricted | **Tier 2 (Reference-Only)** | ✅ Yes | ⚠️ Verbatim Only | ❌ **PROHIBITED** | Strictly prohibits distributing translations (`doc.fa.md`), modified prompts, or adaptations (§ 3a1). Verbatim upstream client clone only. |
| **Business Source License 1.1** | `BUSL-1.1` | Source-Available | **Tier 2 (Reference-Only)** | ⚠️ Restricted | ❌ No | ⚠️ Restricted | Non-compete and commercial production restrictions until change date. Redistribution via distributor hubs prohibited. |
| **Server Side Public License** | `SSPL-1.0` | Source-Available | **Tier 2 (Reference-Only)** | ⚠️ Restricted | ❌ No | ⚠️ Service Viral | Requires offering entire infrastructure management code if offered as a service. |
| **Unlicensed ("All Rights Reserved")** | `UNLICENSED` | Proprietary / Default | **Tier 2 (Reference-Only)** | ❌ No | ❌ **STRICTLY PROHIBITED** | ❌ **STRICTLY PROHIBITED** | Automatic Berne Convention default. No redistribution, copying, mirroring, or translation permitted without explicit private authorization. |

### 3.1 License Invariant Rules for Technical Implementers
1. **The Copyleft Quarantine Rule:** Under no circumstances may a skill licensed under GPLv2, GPLv3, AGPLv3, or SSPL be committed into `github.com/antigravity-hub/skills` as a mirrored asset. Doing so creates legal arguments that the aggregated hub repository constitutes a derivative work or combined distribution, triggering copyleft demands on surrounding skills. Copyleft skills **MUST remain in Tier 2 (Reference-Only)**.
2. **The Translation Boundary Rule (17 U.S.C. § 106(2)):** Translating a skill's procedural text into Persian (`doc.fa.md`) legally constitutes authoring a Derivative Work. This is permitted for Tier 1 permissive skills (MIT, Apache, BSD, CC-BY) provided the original author is credited. It is **STRICTLY FORBIDDEN** for `CC-BY-ND` (NoDerivatives) skills and `UNLICENSED` skills.
3. **The Apache 2.0 NOTICE Invariant (§ 4d):** If an upstream Apache-2.0 repository contains a file named `NOTICE` (case-insensitive), that file is legally inseparable from the license grant. Any physical installation or mirror of that skill MUST include the verbatim `NOTICE` text alongside the `LICENSE` file.

---

## 4. Dual-Tier Governance: Tier 1 (Mirrorable) vs Tier 2 (Reference-Only)

To achieve absolute copyright safety across thousands of heterogeneous repositories, Antigravity Shield enforces a **Dual-Tier Distribution Architecture**:

```
                              ┌──────────────────────────────────────────────┐
                              │ Upstream Skill Discovery (skills.sh / GitHub)│
                              └──────────────────────┬───────────────────────┘
                                                     │
                                                     ▼
                                      ┌──────────────────────────────┐
                                      │ Automated License Detector   │
                                      │ (SPDX Parsing & Legal Heuristic)
                                      └──────────────┬───────────────┘
                                                     │
                         ┌───────────────────────────┴───────────────────────────┐
                         │                                                       │
                         ▼                                                       ▼
           [Permissive Open Source]                               [Copyleft, Restricted, or Unlicensed]
       (MIT, Apache-2.0, BSD, ISC, CC0)                           (GPL, AGPL, CC-NC, CC-ND, BSL, None)
                         │                                                       │
                         ▼                                                       ▼
        ┌─────────────────────────────────┐                     ┌─────────────────────────────────┐
        │       TIER 1 (MIRRORABLE)       │                     │    TIER 2 (REFERENCE-ONLY)      │
        ├─────────────────────────────────┤                     ├─────────────────────────────────┤
        │ • Verified open-source license  │                     │ • Unlicensed, copyleft, or NC   │
        │ • Mirror full assets to Hub     │                     │ • Metadata & deep-link only     │
        │ • Bundle upstream LICENSE/NOTICE│                     │ • ZERO physical files on server │
        │ • Bilingual docs (en + fa)      │                     │ • Client-side direct CLI install│
        │ • Fast CDN delivery (jsDelivr)  │                     │ • `npx skills add <repo>` bridge│
        └────────────────┬────────────────┘                     └────────────────┬────────────────┘
                         │                                                       │
                         ▼                                                       ▼
        ┌─────────────────────────────────┐                     ┌─────────────────────────────────┐
        │  Antigravity Hub CDN & Storage  │                     │   Direct Client-to-Upstream     │
        │  (~/.gemini/config/skills/<id>) │                     │   (Shallow Git Clone / Local)   │
        └─────────────────────────────────┘                     └─────────────────────────────────┘
```

### 4.1 Tier 1: Mirrorable (Permissive Open-Source)
- **Eligibility:** Verified permissive license (`MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`, `CC0-1.0`, `Unlicense`, `CC-BY-4.0`).
- **Distribution Mechanism:**
  - Upstream assets (`SKILL.md`, `scripts/`, `references/`) are mirrored in `github.com/antigravity-hub/skills`.
  - Served to Antigravity Shield clients via jsDelivr CDN and GitHub Raw.
  - Translated Persian guides (`doc.fa.md`) are generated, containing derivative attribution disclosures.
- **Physical Provisioning:** When a user clicks "Install", the Tauri backend downloads the authentic files and places them directly into `~/.gemini/config/skills/<clean_name>/`.
- **Compliance Requirement:** An exact copy of the upstream `LICENSE` and `NOTICE` file is bundled alongside `SKILL.md` in the local directory.

### 4.2 Tier 2: Reference-Only (Client-Side Direct Linking)
- **Eligibility:** Any skill that is Unlicensed ("All Rights Reserved"), Copyleft (`GPL`, `AGPL`, `MPL`), Commercially Restricted (`CC-BY-NC`), Adaptation-Restricted (`CC-BY-ND`), Source-Available (`BSL`, `SSPL`), or Proprietary.
- **Distribution Mechanism:**
  - **Zero Server Hosting:** The Antigravity Hub repository and CDN **never host, mirror, cache, or distribute** the procedural files (`SKILL.md`) or scripts of Tier 2 skills.
  - **Metadata Only:** The catalog (`src/config/skillsCatalog.ts`, `manifest.json`, `catalog.min.json`) stores only non-copyrightable metadata: name, author handle, upstream repository link, install count, and the exact native install command string (`nativeInstallCmd`).
- **Physical Provisioning:**
  - Antigravity Shield does NOT download or stage Tier 2 assets through its servers.
  - Instead, the client invokes a local terminal subprocess bridge (`npx skills add <source> --skill <id>`) or performs a direct, client-to-upstream shallow `git clone` on the user's local operating system.
  - The transaction occurs strictly between the user's personal workstation and the author's public repository. Antigravity Shield never touches or transmits the copyrighted bytes.

---

## 5. Mandatory Attribution, Bundling & Provenance Protocols

### 5.1 Standard Provenance Metadata Schema
Every skill indexed in the Antigravity ecosystem must carry standardized, machine-readable provenance metadata. In TypeScript (`src/types/ecosystem.ts`), this is formalized as:

```typescript
export type SkillDistributionMode = 'mirror' | 'reference_only';
export type SkillLicenseType = 'permissive' | 'copyleft' | 'restricted' | 'unlicensed';

export interface SkillProvenanceMetadata {
  license?: string;                  // Canonical SPDX ID (e.g. "MIT", "Apache-2.0", "UNLICENSED")
  licenseType?: SkillLicenseType;    // 'permissive' | 'copyleft' | 'restricted' | 'unlicensed'
  distributionMode?: SkillDistributionMode; // 'mirror' (Tier 1) vs 'reference_only' (Tier 2)
  spdxId?: string;                   // Explicit SPDX identifier string
  upstreamCommitSha?: string;        // Exact 40-character Git commit hash verified at audit
  upstreamLicenseUrl?: string;       // Direct URL to upstream LICENSE or NOTICE
  noticeText?: string;               // Verbatim copyright/attribution notice string
  nativeInstallCmd?: string;         // Verified CLI command, e.g. "npx skills add <source> --skill <id>"
  rank?: number;                     // Leaderboard position (1 to 1000)
  isUpstreamReachable?: boolean;     // Network liveness check status
  tombstoned?: boolean;              // Soft-delete deprecation flag
}
```

### 5.2 Physical Bundling Protocol
Whenever a Tier 1 skill is provisioned to disk (either in `hub-export/docs/<slug>/` or locally in `~/.gemini/config/skills/<clean_name>/`), the provisioning engine must guarantee the physical presence of licensing files:

1. **`LICENSE.md` / `LICENSE`:**
   - Must contain the verbatim upstream license text.
   - Must contain the author's copyright statement, e.g.:
     ```markdown
     # License & Attribution: <Skill Title>
     
     - SPDX-License-Identifier: MIT
     - License Type: Permissive
     - Distribution Mode: Tier 1 (Mirror)
     - Upstream Repository: https://github.com/<owner>/<repo>
     - Verified Upstream Commit: a1b2c3d4e5f6...
     
     ## Notice
     Copyright (c) 2026 <Upstream Author>. Licensed under the MIT License.
     ```
2. **`NOTICE.md` / `NOTICE` (Apache 2.0 Invariant):**
   - For skills licensed under Apache-2.0 with an upstream `NOTICE` file, the file must be bundled verbatim alongside `LICENSE.md`. Omitting an upstream `NOTICE` file constitutes a breach of Section 4(d) of the Apache 2.0 license.

For Tier 2 skills, `hub-export/docs/<slug>/NOTICE.md` is emitted as a legal disclaimer:
```markdown
# Upstream Reference Notice: <Skill Title>

- License: UNLICENSED (restricted)
- Distribution Mode: Tier 2 (Reference-Only)
- Upstream Repository: https://github.com/<owner>/<repo>
- Native CLI Installation: `npx skills add <source> --skill <id>`

## Legal Notice (Safe Harbor & Copyright Protection)
This skill is indexed by Antigravity Hub as **Reference-Only**.
Antigravity Shield does NOT mirror, bundle, or redistribute verbatim proprietary assets for this skill.
To install and utilize this skill, execute the native upstream CLI command above.
```

### 5.3 Machine-Readable Provenance Header
Every mirrored `SKILL.md` distributed via Antigravity Hub must carry an immutable, machine-readable HTML comment banner prepended to line 1:

```html
<!-- ANTIGRAVITY-PROVENANCE-START
name: find-skills
spdx-license-identifier: MIT
upstream-repository: https://github.com/vercel-labs/skills
upstream-commit-sha: 7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b
ingestion-date: 2026-11-04T00:00:00Z
distribution-tier: Tier 1 (Mirrorable)
ANTIGRAVITY-PROVENANCE-END -->
```

Automated verification linters will flag any mirrored skill lacking this provenance envelope.

### 5.4 Derivative Work Disclosure Banner (Persian Translations)
When generating localized procedural guides (`doc.fa.md`) for Tier 1 permissive skills, the document must open with the following bilingual disclosure banner:

```markdown
> ⚖️ **تذکر حقوقی و حق تألیف (Copyright & Provenance Notice):**  
> این سند برگردان و شرح معماری ماژول متن‌باز `find-skills` است که اثر اصیل آن متعلق به **Vercel, Inc.** در مخزن رسمی `https://github.com/vercel-labs/skills` می‌باشد. این اثر بر پایه مجوز متن‌باز **MIT License** بازنشر شده و تمامی حقوق مادی و معنوی مؤلف اصلی محفوظ است.  
> *Original Work Copyright (c) 2026 Vercel, Inc. Translated and adapted under MIT License.*
```

---

## 6. Safe Harbor Compliance & Distributor Governance (DMCA § 512 & EU DSA)

### 6.1 United States Digital Millennium Copyright Act (17 U.S.C. § 512)
Antigravity Shield operates as an intermediary service provider and aggregator. To ensure complete immunity from copyright infringement damages, our architecture satisfies all statutory safe harbor subsections under 17 U.S.C. § 512:

| DMCA Section | Statutory Category | Antigravity Operational Component | Mandatory Safe Harbor Conditions |
|---|---|---|---|
| **17 U.S.C. § 512(a)** | Transitory Digital Network Communications | Client-side native CLI installation (`execute_skill_native_install`) direct from upstream | Transmission initiated by user; routing automated; no intermediate copies retained beyond technical necessity. |
| **17 U.S.C. § 512(b)** | System Caching | Intermediate CDN caching (jsDelivr / GitHub Pages) for Tier 1 assets | Caching is automated; unmodified content; complies with upstream refresh rules; respects deletion/tombstones within 24 hours. |
| **17 U.S.C. § 512(c)** | Information Stored on Systems at Direction of Users | Community pull requests and skill submissions to `github.com/antigravity-hub/skills` | No actual knowledge or red flag awareness of infringement; expeditious takedown upon notice; designated copyright agent. |
| **17 U.S.C. § 512(d)** | Information Location Tools | Search catalog and index in Antigravity Manager (`skillsCatalog.ts`) | No financial benefit directly attributable to infringing activity; expeditious disabling of links upon receipt of formal notification. |

#### Statutory Safe Harbor Prerequisites (§ 512(c)(2) & § 512(i))
To maintain DMCA safe harbor immunity, Antigravity Shield strictly enforces:
1. **Designated DMCA Agent:** A designated agent is registered with the United States Copyright Office directory and listed on all public documentation.
   - **Entity:** Antigravity Architecture & Legal Council
   - **Contact Email:** `legal@antigravity-hub.org`
   - **Mailing Address:** Antigravity Open Ecosystem Compliance, 100 Montgomery St, Suite 1500, San Francisco, CA 94104
2. **Expeditious Notice and Takedown Protocol (24-Hour SLA):**
   - Upon receipt of a legally sufficient notification of claimed infringement satisfying 17 U.S.C. § 512(c)(3), our operations team removes or disables access to the challenged material within **24 hours**.
3. **Repeat Infringer Policy (§ 512(i)(1)(A)):**
   - The ecosystem enforces a strict **Two-Strike Policy**. Any contributor, organization, or automated bot that submits infringing content to `antigravity-hub/skills` twice will be permanently banned from contributing, and their repository accounts blocked across our infrastructure.
4. **Counter-Notification & Put-Back (§ 512(g)):**
   - If a skill maintainer believes their skill was removed by mistake or misidentification, they may submit a formal counter-notification. The material will be restored in 10 to 14 business days unless the original complainant files a court action.

### 6.2 European Union Digital Services Act (Regulation (EU) 2022/2065 - DSA)
For users and operations within the European Union, Antigravity Shield complies with Articles 16–20 of the DSA:
- **Article 16 (Notice and Action Mechanisms):** Easy-to-access, electronic submission portal for copyright and illegal content notices, enabling structured reporting with precise location URLs and rationale.
- **Article 17 (Statement of Reasons):** If any skill is delisted or blocked, Antigravity Shield provides a clear, specific statement of reasons to the affected skill author, detailing whether the decision was based on copyright claims, terms of service violations, or automated reachability failures.
- **Article 20 (Internal Complaint-Handling System):** Skill authors are granted a **6-month window** to appeal any delisting or takedown decision, which will be reviewed by senior engineering and legal staff without automated dismissal.
- **Transparency Register:** All takedown requests, whether under DMCA or DSA, are cryptographically logged in an internal transparency ledger.

---

## 7. Automated Upstream Reachability & Tombstone Synchronization

### 7.1 Upstream Lifecycle & Epistemic Grounding
Public open-source repositories are dynamic. Authors may delete repositories, change organization names, relicense projects, or receive DMCA notices directly from upstream platforms (GitHub). A static catalog becomes legally and technically compromised if it points to non-existent or revoked sources.

Antigravity Shield deploys an **Automated Upstream Reachability & Tombstone Synchronization Engine** (executed via daily cron workflows and on-demand verification scripts):

```
       [Daily Scheduled Health Scanner: scripts/refresh_skills_pipeline.mjs]
                                     │
                                     ▼
                ┌─────────────────────────────────────────┐
                │ Probe Upstream GitHub / skills.sh URLs │
                │ (HTTP HEAD / GET with backoff)         │
                └────────────────────┬────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           │                         │                         │
           ▼                         ▼                         ▼
      [HTTP 200]             [HTTP 404 / 410]             [HTTP 451]
  (Healthy & Live)          (Deleted / Renamed)       (Legal DMCA Takedown)
           │                         │                         │
           ▼                         ▼                         ▼
   [isUpstreamReachable:     [tombstoned: true]        [tombstoned: true]
           true]             [isUpstreamReachable:     [Immediate Purge from
                                   false]                Active Mirror]
```

### 7.2 Tombstone Protocol (Safe Harbor Alignment)
When an upstream repository returns:
- **HTTP 404 Not Found** or **HTTP 410 Gone:** The repository has been deleted or privatized by the creator.
- **HTTP 451 Unavailable For Legal Reasons:** The repository has been taken down by GitHub pursuant to a DMCA takedown notice or court order.
- **HTTP 403 Forbidden:** The repository has been restricted or made private.

The automated engine executes the following immutable runbook:
1. **Catalog Metadata Update:**
   - Sets `isUpstreamReachable = false`.
   - Sets `tombstoned = true`.
   - Records the timestamp and HTTP status code.
2. **Purge from Central Mirror:**
   - Within **24 hours**, any mirrored assets residing in `github.com/antigravity-hub/skills` are deleted from the active branch to prevent continuing reproduction of revoked content.
3. **UI State & Guardrail Enforcement:**
   - In Antigravity Manager (`SkillsTab.tsx`), the skill is marked with a muted badge: `[Repository Unavailable]` or `[Tombstoned]`.
   - The "Install" button is disabled. A tooltip informs the user: *"This upstream repository has been removed or revoked by its author. Installation is blocked to protect ecosystem integrity."*

### 7.3 License Drift Detection & Commit Pinning
To prevent "bait-and-switch" vulnerabilities (where an author publishes under MIT and later re-licenses to proprietary or BSL):
1. **Commit SHA Pinning:** Every audited Tier 1 skill records its exact `upstreamCommitSha`.
2. **Irrevocability of Open-Source Grants:** Under established US contract and copyright law, an open-source license grant under MIT or Apache 2.0 is irrevocable for copies obtained under that license. The pinned commit remains validly licensed.
3. **Drift Detection:** If a subsequent automated sync detects that `HEAD` of the upstream repository has changed license to a restrictive license, the skill is automatically transitioned to **Tier 2 (Reference-Only)** for all subsequent versions, pausing automatic mirror updates.

---

## 8. Compliance Checklist & Operational Runbook

All engineering subteams and contributing developers must adhere to the following operational checklists before committing code to the Antigravity workspace:

### 8.1 For TypeScript & Frontend Engineers
- [ ] **Type Compliance:** Ensure `SkillItem` in `src/types/ecosystem.ts` declares `license`, `licenseType`, `distributionMode`, `spdxId`, `nativeInstallCmd`, `rank`, `upstreamCommitSha`, `upstreamLicenseUrl`, `noticeText`, `isUpstreamReachable`, and `tombstoned`.
- [ ] **Optionality Safety:** Ensure new properties remain optional (`?`) on `SkillItem` to prevent regressions across existing catalog consumers, or provide safe fallback defaults.
- [ ] **UI Visual Badges:** In `SkillsTab.tsx` and detail modals, display distinct visual badges:
  - Tier 1: Green accent badge (`Tier 1 - Mirror`).
  - Tier 2: Neutral / amber badge (`Tier 2 - Reference Only`).
  - Tombstoned: Red / muted badge (`Unavailable / Tombstoned`).
- [ ] **Native CLI Integration:** In Tier 2 views, provide a 1-click button to copy the authentic `nativeInstallCmd` to the user's clipboard (`navigator.clipboard.writeText(...)`).
- [ ] **Compiler Verification:** Run `npx tsc --noEmit` and confirm exit code 0 before opening pull requests.

### 8.2 For Rust & Tauri Backend Engineers
- [ ] **Serde Struct Alignment:** Ensure `pub struct SkillItem` in `src-tauri/src/modules/skills.rs` declares all matching legal fields with `#[serde(default, skip_serializing_if = "Option::is_none")]`.
- [ ] **Physical License Bundling:** In `install_skill_physical`, ensure that whenever a Tier 1 skill is staged, the upstream `LICENSE` file and any existing `NOTICE` file are downloaded and written to `~/.gemini/config/skills/<clean_name>/LICENSE` and `NOTICE`.
- [ ] **Anti-Boilerplate Integrity Gate:** Maintain the physical content gate (>250 bytes, zero template phrases) to reject empty or canned placeholder markdown.
- [ ] **Directory Traversal Sanitization:** Ensure companion file extractors strictly reject path traversal markers (`../` or leading slashes) to prevent arbitrary file writes.
- [ ] **Native CLI Execution Bridge:** Implement Tauri command `execute_skill_native_install` to spawn client-side terminal processes (`npx skills add ...`) for Tier 2 skills with streaming logs.

### 8.3 For Data Pipeline & Hub Automation Engineers
- [ ] **Dual-Tier Export Handling:** In `scripts/exportHubSkills.mjs`, dynamically classify skills into `mirror` vs `reference_only`.
- [ ] **Attribution File Generation:** In `hub-export/docs/<slug>/`, write `LICENSE.md` for Tier 1 mirror skills, and write `NOTICE.md` for Tier 2 reference-only skills.
- [ ] **Manifest & Catalog Minification:** Ensure `hub-export/manifest.json` and `catalog.min.json` serialize `license`, `licenseType`, `distributionMode`, `spdxId`, and `nativeInstallCmd`.
- [ ] **Provenance Comment Injection:** Prepend the standard HTML provenance comment banner to all mirrored markdown files.
- [ ] **Rate-Limiting & Backoff:** In all GitHub scraping pipelines, implement exponential backoff and adhere to GitHub API rate limits (60 req/hr unauthenticated, 5,000 req/hr authenticated).

### 8.4 For QA, Security & Forensic Auditors
- [ ] **Zero Synthetic 404s:** Verify that no catalog entry points to synthetic placeholder repositories (e.g. fake `<owner>/skills` endpoints).
- [ ] **Physical Audit of Installed Skills:** Sample installed skills in `~/.gemini/config/skills/` to confirm that every Tier 1 installation contains an authentic `LICENSE` file.
- [ ] **SPDX Normalization:** Validate that all license identifiers match official SPDX naming conventions (e.g. `Apache-2.0`, not `Apache2` or `ASL2.0`).
- [ ] **Automated Verification Runner:** Confirm that `scripts/verify_skills_catalog_and_install.mjs` executes and passes all test assertions across reachability, install command syntax, and physical deployment integrity.

---

*This guide is maintained under the stewardship of the Antigravity Shield Architecture & Legal Council. Changes to licensing classifications or distributor tier rules require unanimous review by principal system architects.*
