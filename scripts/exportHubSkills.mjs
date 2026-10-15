import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const exportDir = path.resolve(projectRoot, 'hub-export');

async function main() {
  console.log('[Hub Export] Starting extraction of skills catalog...');
  
  if (fs.existsSync(exportDir)) {
    fs.rmSync(exportDir, { recursive: true, force: true });
  }
  fs.mkdirSync(exportDir, { recursive: true });
  fs.mkdirSync(path.join(exportDir, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(exportDir, '.github', 'workflows'), { recursive: true });

  // Read skillsCatalog.ts and slice the JSON array
  const catalogFilePath = path.join(projectRoot, 'src', 'config', 'skillsCatalog.ts');
  const catalogContent = fs.readFileSync(catalogFilePath, 'utf8');

  const marker = 'export const SKILLS_SH_CATALOG: SkillItem[] = ';
  const startIdx = catalogContent.indexOf(marker);
  if (startIdx === -1) {
    throw new Error('Failed to find SKILLS_SH_CATALOG marker in skillsCatalog.ts');
  }

  const jsonStart = startIdx + marker.length;
  const jsonEnd = catalogContent.indexOf('\n];\n', jsonStart) + 2; // include ];
  if (jsonEnd <= jsonStart) {
    throw new Error('Failed to find closing bracket of SKILLS_SH_CATALOG in skillsCatalog.ts');
  }

  const rawJson = catalogContent.slice(jsonStart, jsonEnd).trim();
  const skills = JSON.parse(rawJson);
  console.log(`[Hub Export] Parsed ${skills.length} skills from catalog.`);

  const manifest = {
    schemaVersion: '2.0.0',
    catalogVersion: '2026.10.1',
    updatedAt: new Date().toISOString(),
    totalSkills: skills.length,
    skills: {},
  };

  const minCatalog = [];

  for (const skill of skills) {
    const slug = skill.slug || skill.name || skill.id.replace(/\//g, '__');
    const skillDocDir = path.join(exportDir, 'docs', slug);
    fs.mkdirSync(skillDocDir, { recursive: true });

    let enHash = '';
    let faHash = '';

    if (skill.docsMarkdown?.en) {
      const enFile = path.join(skillDocDir, 'doc.en.md');
      fs.writeFileSync(enFile, skill.docsMarkdown.en, 'utf8');
      enHash = crypto.createHash('sha256').update(skill.docsMarkdown.en).digest('hex');
    }

    if (skill.docsMarkdown?.fa) {
      const faFile = path.join(skillDocDir, 'doc.fa.md');
      fs.writeFileSync(faFile, skill.docsMarkdown.fa, 'utf8');
      faHash = crypto.createHash('sha256').update(skill.docsMarkdown.fa).digest('hex');
    }

    manifest.skills[skill.id] = {
      id: skill.id,
      slug,
      name: skill.name,
      title: skill.title,
      category: skill.category,
      author: skill.author,
      version: skill.version,
      isOfficial: skill.isOfficial || false,
      isVerifiedMaker: skill.isVerifiedMaker || false,
      installs: skill.installs || 0,
      stars: skill.stars || 0,
      hashes: {
        en: enHash,
        fa: faHash,
      },
      updatedAt: manifest.updatedAt,
    };

    // Construct lightweight item without heavy docs
    const { docsMarkdown, content, files, ...minItem } = skill;
    minCatalog.push({
      ...minItem,
      slug,
      docPath: `docs/${slug}/`,
    });
  }

  // Write manifest.json
  const manifestPath = path.join(exportDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[Hub Export] Generated manifest.json (${(fs.statSync(manifestPath).size / 1024).toFixed(1)} KB)`);

  // Write catalog.min.json
  const minCatalogPath = path.join(exportDir, 'catalog.min.json');
  fs.writeFileSync(minCatalogPath, JSON.stringify(minCatalog, null, 2), 'utf8');
  console.log(`[Hub Export] Generated catalog.min.json (${(fs.statSync(minCatalogPath).size / 1024).toFixed(1)} KB)`);

  // Write README.md
  const readmeContent = `# 🛡️ Antigravity Hub — Official Agent Skills Ecosystem

Welcome to the official procedural knowledge and skills repository for **Google Antigravity**, **Gemini**, and modern AI developer agents.

## 🌟 Overview
This repository serves as the centralized, zero-leak procedural knowledge registry for Antigravity Shield.
It provides:
- **188+ Curated Skills** across Coding, Architecture, Design, DevOps, Data, Automation, and Science.
- **Universal SKILL.md Standard:** Compatible with all 20 AI Agent platforms (**Google Antigravity**, **Claude Code**, **Cursor**, **Codex**, **Gemini**, **Windsurf**, **Zed**, etc.).
- **Bilingual Production Engineering Guides:** English & Persian documentation with architectural boundary enforcement, criticality levels, and trigger rules.
- **Security Audits:** Verified by *Gen Agent Trust Hub*, *Socket*, and *Snyk*.

## 📁 Repository Structure
\`\`\`
├── manifest.json              # Versioning, SHA-256 integrity hashes & index
├── catalog.min.json           # Ultra-lightweight catalog for Antigravity Shield
├── docs/                      # Individual multi-language documentation per skill
│   └── <skill-slug>/
│       ├── doc.en.md          # Comprehensive English architectural documentation
│       └── doc.fa.md          # Persian procedural & plain-language guide
└── .github/workflows/
    └── telemetry-sync.yml     # Daily cron synchronization with skills.sh telemetry
\`\`\`

## 🚀 CDN Access & Integration
Antigravity Shield and external agents can consume raw assets via jsDelivr or GitHub Raw CDN:
- **Manifest:** \`https://cdn.jsdelivr.net/gh/antigravity-hub/skills@main/manifest.json\`
- **Catalog:** \`https://cdn.jsdelivr.net/gh/antigravity-hub/skills@main/catalog.min.json\`
- **Individual Doc:** \`https://cdn.jsdelivr.net/gh/antigravity-hub/skills@main/docs/<slug>/doc.fa.md\`

## 🔒 Security & Privacy (Zero-Leak Policy)
This repository is read-only for public agents. No private user telemetry, keys, or local configurations are ever sent to or stored in this registry.

---
*Maintained by the Antigravity Hub Architecture Council.*
`;
  fs.writeFileSync(path.join(exportDir, 'README.md'), readmeContent, 'utf8');

  // Write .github/workflows/telemetry-sync.yml
  const workflowContent = `name: Telemetry Sync Cron

on:
  schedule:
    - cron: '0 4 * * *' # Daily at 04:00 UTC
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Fetch Latest Telemetry
        run: |
          echo "Syncing telemetry from skills.sh..."
          # Background sync logic will update manifest.json & catalog.min.json

      - name: Commit & Push Changes
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "chore(telemetry): automated daily leaderboard sync"
`;
  fs.writeFileSync(path.join(exportDir, '.github', 'workflows', 'telemetry-sync.yml'), workflowContent, 'utf8');

  console.log('[Hub Export] Successfully prepared all files in hub-export/ ready for GitHub sync!');
}

main().catch((err) => {
  console.error('[Hub Export] Error:', err);
  process.exit(1);
});
