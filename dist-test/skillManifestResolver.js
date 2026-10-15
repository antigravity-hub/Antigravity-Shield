// src/services/skillManifestResolver.ts
var KNOWN_HUBS = {
  "vercel-labs/skills": {
    owner: "vercel-labs",
    repo: "skills",
    defaultBranch: "main",
    resolvePath: (slug) => ({
      skillDir: `skills/${slug}`
    })
  },
  "vercel-labs/agent-browser": {
    owner: "vercel-labs",
    repo: "agent-browser",
    defaultBranch: "main",
    resolvePath: () => ({
      skillDir: "skills/agent-browser",
      companionFiles: [
        "skill-data/core/references/index.md",
        "skill-data/core/templates/setup.sh"
      ]
    })
  },
  "anthropics/skills": {
    owner: "anthropics",
    repo: "skills",
    defaultBranch: "main",
    resolvePath: (slug) => {
      const companions = {
        docx: ["scripts/office/soffice.py"],
        xlsx: ["scripts/recalc.py"]
      };
      return {
        skillDir: `skills/${slug}`,
        companionFiles: companions[slug]
      };
    }
  },
  "mattpocock/skills": {
    owner: "mattpocock",
    repo: "skills",
    defaultBranch: "main",
    resolvePath: (slug) => {
      const normalized = (slug || "").toLowerCase().trim();
      const engineeringSkills = /* @__PURE__ */ new Set([
        "implement",
        "code-review",
        "tdd",
        "diagnosing-bugs",
        "verification",
        "systematic-refactoring"
      ]);
      const productivitySkills = /* @__PURE__ */ new Set([
        "grill-me",
        "teach",
        "handoff",
        "grilling",
        "plan-execution"
      ]);
      if (engineeringSkills.has(normalized)) {
        return { skillDir: `skills/engineering/${normalized}` };
      }
      if (productivitySkills.has(normalized)) {
        return { skillDir: `skills/productivity/${normalized}` };
      }
      return { skillDir: `skills/productivity/${normalized}` };
    }
  },
  "obra/superpowers": {
    owner: "obra",
    repo: "superpowers",
    defaultBranch: "main",
    resolvePath: (slug) => ({
      skillDir: `skills/${slug}`,
      companionFiles: slug === "brainstorming" ? ["scripts/frame-template.html", "scripts/helper.js"] : void 0
    })
  },
  "tavily-ai/skills": {
    owner: "tavily-ai",
    repo: "skills",
    defaultBranch: "main",
    resolvePath: (slug) => ({
      skillDir: `skills/${slug}`,
      companionFiles: [
        "references/crawl.md",
        "references/extract.md",
        "references/research.md"
      ]
    })
  }
};
var NON_UPSTREAM_PREFIXES = [
  "deepmind/alphafold",
  "ebi-chembl/",
  "ncbi/",
  "broadinstitute/gtex",
  "rcsb/pdb",
  "open.feishu.cn/",
  "uizze.sh/"
];
function isSkillUpstreamLive(skill) {
  if (skill.isUpstreamLive !== void 0) {
    return skill.isUpstreamLive;
  }
  if (skill.isLocal) {
    return false;
  }
  const id = (skill.id || "").toLowerCase();
  for (const prefix of NON_UPSTREAM_PREFIXES) {
    if (id.startsWith(prefix)) {
      return false;
    }
  }
  const hubKey = `${skill.owner || ""}/${skill.repo || ""}`;
  if (KNOWN_HUBS[hubKey]) {
    return true;
  }
  if (skill.rawManifestUrl && skill.rawManifestUrl.includes("raw.githubusercontent.com")) {
    return true;
  }
  return false;
}
function extractAllowedTools(markdown) {
  if (!markdown || typeof markdown !== "string") return [];
  const lines = markdown.split(/\r?\n/);
  const tools = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^\s*allowed-tools:\s*(.*)$/i);
    if (match) {
      const inlineRest = match[1].trim();
      if (inlineRest) {
        const clean = inlineRest.replace(/^\[|\]$/g, "");
        const items = clean.split(",").map((t) => t.trim().replace(/^-\s*/, "").replace(/^['"]|['"]$/g, "")).filter((t) => t.length > 0);
        tools.push(...items);
      }
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j];
        const trimmed = nextLine.trim();
        if (trimmed.startsWith("---") || trimmed.startsWith("#")) {
          break;
        }
        if (/^-\s+/.test(trimmed)) {
          const item = trimmed.replace(/^-\s+/, "").replace(/^['"]|['"]$/g, "").trim();
          if (item) {
            tools.push(item);
          }
          j++;
        } else if (trimmed === "") {
          j++;
        } else {
          break;
        }
      }
      break;
    }
  }
  return tools;
}
function parsePrerequisitesFromMarkdown(markdown) {
  const prereqs = {
    envVars: [],
    cliCommands: [],
    allowedTools: [],
    dependencies: []
  };
  if (!markdown || typeof markdown !== "string") {
    return prereqs;
  }
  prereqs.allowedTools = extractAllowedTools(markdown);
  const envVarMatches = markdown.match(/\b([A-Z0-9_]{2,}_(?:API_KEY|TOKEN|SECRET|KEY|PASSWORD|AUTH))\b/g);
  if (envVarMatches) {
    const excluded = /* @__PURE__ */ new Set(["PRIMARY_KEY", "FOREIGN_KEY", "COMPOSITE_KEY", "ROW_KEY"]);
    const unique = Array.from(new Set(envVarMatches)).filter((k) => !excluded.has(k));
    prereqs.envVars = unique;
  }
  const cliSet = /* @__PURE__ */ new Set();
  const npmMatches = markdown.match(/npm\s+i(?:nstall)?\s+-g\s+([@a-zA-Z0-9_\-\/]+)/g);
  if (npmMatches) {
    npmMatches.forEach((m) => cliSet.add(m.trim()));
  }
  if (/agent-browser\s+install/i.test(markdown)) {
    cliSet.add("agent-browser install");
  }
  const tvlyMatches = markdown.match(/tvly\s+(?:login|init|install)/g);
  if (tvlyMatches) {
    tvlyMatches.forEach((m) => cliSet.add(m.trim()));
  }
  const pipMatches = markdown.match(/pip\s+install\s+([a-zA-Z0-9_\-]+)/g);
  if (pipMatches) {
    pipMatches.forEach((m) => cliSet.add(m.trim()));
  }
  const curlMatches = markdown.match(/curl\s+-fsSL\s+([^\s|]+\.sh)\s+\|\s+bash/g);
  if (curlMatches) {
    curlMatches.forEach((m) => cliSet.add(m.trim()));
  }
  prereqs.cliCommands = Array.from(cliSet);
  return prereqs;
}
function resolveSkillManifest(skill) {
  const isLive = isSkillUpstreamLive(skill);
  if (skill.rawManifestUrl && skill.repoUrl && skill.branch && skill.skillDir) {
    const prereqs2 = skill.prerequisites || parsePrerequisitesFromMarkdown(skill.content || skill.docsMarkdown?.en || "");
    return {
      repoUrl: skill.repoUrl,
      rawManifestUrl: skill.rawManifestUrl,
      branch: skill.branch,
      skillDir: skill.skillDir,
      companionFiles: skill.companionFiles || [],
      prerequisites: prereqs2,
      isUpstreamLive: isLive
    };
  }
  const cleanSlug = skill.slug || skill.name || skill.id.split("/").pop() || "";
  const hubKey = `${skill.owner || ""}/${skill.repo || ""}`;
  const hub = KNOWN_HUBS[hubKey];
  if (hub && isLive) {
    const { skillDir, companionFiles } = hub.resolvePath(cleanSlug);
    const branch = skill.branch || hub.defaultBranch;
    const repoUrl = `https://github.com/${hub.owner}/${hub.repo}`;
    const rawManifestUrl = `https://raw.githubusercontent.com/${hub.owner}/${hub.repo}/${branch}/${skillDir}/SKILL.md`;
    const prereqs2 = skill.prerequisites || parsePrerequisitesFromMarkdown(skill.content || skill.docsMarkdown?.en || "");
    return {
      repoUrl,
      rawManifestUrl,
      branch,
      skillDir,
      companionFiles: companionFiles || [],
      prerequisites: prereqs2,
      isUpstreamLive: true
    };
  }
  const prereqs = skill.prerequisites || parsePrerequisitesFromMarkdown(skill.content || skill.docsMarkdown?.en || "");
  return {
    repoUrl: skill.repository || skill.remoteUrl || void 0,
    rawManifestUrl: void 0,
    branch: "main",
    skillDir: cleanSlug,
    companionFiles: [],
    prerequisites: prereqs,
    isUpstreamLive: false
  };
}
export {
  extractAllowedTools,
  isSkillUpstreamLive,
  parsePrerequisitesFromMarkdown,
  resolveSkillManifest
};
