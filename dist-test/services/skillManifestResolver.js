const KNOWN_HUBS = {
    'vercel-labs/skills': {
        owner: 'vercel-labs',
        repo: 'skills',
        defaultBranch: 'main',
        resolvePath: (slug) => ({
            skillDir: `skills/${slug}`,
        }),
    },
    'vercel-labs/agent-browser': {
        owner: 'vercel-labs',
        repo: 'agent-browser',
        defaultBranch: 'main',
        resolvePath: () => ({
            skillDir: 'skills/agent-browser',
            companionFiles: [
                'skill-data/core/references/index.md',
                'skill-data/core/templates/setup.sh',
            ],
        }),
    },
    'anthropics/skills': {
        owner: 'anthropics',
        repo: 'skills',
        defaultBranch: 'main',
        resolvePath: (slug) => {
            const companions = {
                docx: ['scripts/office/soffice.py'],
                xlsx: ['scripts/recalc.py'],
            };
            return {
                skillDir: `skills/${slug}`,
                companionFiles: companions[slug],
            };
        },
    },
    'mattpocock/skills': {
        owner: 'mattpocock',
        repo: 'skills',
        defaultBranch: 'main',
        resolvePath: (slug) => {
            // Matt Pocock's monorepo partitions skills into categorized subdirectories
            const engineeringSkills = new Set([
                'implement',
                'code-review',
                'tdd',
                'diagnosing-bugs',
                'verification',
                'systematic-refactoring',
            ]);
            const productivitySkills = new Set([
                'grill-me',
                'teach',
                'handoff',
                'grilling',
                'plan-execution',
            ]);
            if (engineeringSkills.has(slug)) {
                return { skillDir: `skills/engineering/${slug}` };
            }
            if (productivitySkills.has(slug)) {
                return { skillDir: `skills/productivity/${slug}` };
            }
            // Default guess
            return { skillDir: `skills/productivity/${slug}` };
        },
    },
    'obra/superpowers': {
        owner: 'obra',
        repo: 'superpowers',
        defaultBranch: 'main',
        resolvePath: (slug) => ({
            skillDir: `skills/${slug}`,
            companionFiles: slug === 'brainstorming'
                ? ['scripts/frame-template.html', 'scripts/helper.js']
                : undefined,
        }),
    },
    'tavily-ai/skills': {
        owner: 'tavily-ai',
        repo: 'skills',
        defaultBranch: 'main',
        resolvePath: (slug) => ({
            skillDir: `skills/${slug}`,
            companionFiles: [
                'references/crawl.md',
                'references/extract.md',
                'references/research.md',
            ],
        }),
    },
};
/**
 * Science and local plugin prefixes that do NOT exist on external GitHub.
 */
const NON_UPSTREAM_PREFIXES = [
    'deepmind/alphafold',
    'ebi-chembl/',
    'ncbi/',
    'broadinstitute/gtex',
    'rcsb/pdb',
    'open.feishu.cn/',
    'uizze.sh/',
];
/**
 * Checks whether a skill represents a verified live public repository.
 */
export function isSkillUpstreamLive(skill) {
    if (skill.isUpstreamLive !== undefined) {
        return skill.isUpstreamLive;
    }
    if (skill.isLocal) {
        return false;
    }
    const id = (skill.id || '').toLowerCase();
    for (const prefix of NON_UPSTREAM_PREFIXES) {
        if (id.startsWith(prefix)) {
            return false;
        }
    }
    const hubKey = `${skill.owner || ''}/${skill.repo || ''}`;
    if (KNOWN_HUBS[hubKey]) {
        return true;
    }
    if (skill.rawManifestUrl && skill.rawManifestUrl.includes('raw.githubusercontent.com')) {
        return true;
    }
    return false;
}
/**
 * Parses prerequisite execution telemetry (allowed-tools, env vars, CLI commands)
 * from Markdown and YAML frontmatter.
 */
export function parsePrerequisitesFromMarkdown(markdown) {
    const prereqs = {
        envVars: [],
        cliCommands: [],
        allowedTools: [],
        dependencies: [],
    };
    if (!markdown || typeof markdown !== 'string') {
        return prereqs;
    }
    // 1. Extract allowed-tools from YAML frontmatter or inline text
    const allowedToolsMatch = markdown.match(/allowed-tools:\s*([^\r\n]+)/i);
    if (allowedToolsMatch && allowedToolsMatch[1]) {
        const rawTools = allowedToolsMatch[1].trim();
        const parsed = rawTools
            .split(',')
            .map((t) => t.trim().replace(/^['"]|['"]$/g, ''))
            .filter((t) => t.length > 0);
        prereqs.allowedTools = parsed;
    }
    // 2. Extract Environment variables (API keys, Tokens, Secrets)
    const envVarMatches = markdown.match(/\b([A-Z0-9_]{3,}_(?:API_KEY|TOKEN|SECRET|KEY|PASSWORD|AUTH))\b/g);
    if (envVarMatches) {
        const excluded = new Set(['PRIMARY_KEY', 'FOREIGN_KEY', 'COMPOSITE_KEY', 'ROW_KEY']);
        const unique = Array.from(new Set(envVarMatches)).filter((k) => !excluded.has(k));
        prereqs.envVars = unique;
    }
    // 3. Extract CLI commands (e.g. npm i -g @tavily/cli, tvly login, etc.)
    const cliSet = new Set();
    // npm install global
    const npmMatches = markdown.match(/npm\s+i(?:nstall)?\s+-g\s+([@a-zA-Z0-9_\-\/]+)/g);
    if (npmMatches) {
        npmMatches.forEach((m) => cliSet.add(m.trim()));
    }
    // agent-browser install command
    if (/agent-browser\s+install/i.test(markdown)) {
        cliSet.add('agent-browser install');
    }
    // tvly login / init
    const tvlyMatches = markdown.match(/tvly\s+(?:login|init|install)/g);
    if (tvlyMatches) {
        tvlyMatches.forEach((m) => cliSet.add(m.trim()));
    }
    // pip install
    const pipMatches = markdown.match(/pip\s+install\s+([a-zA-Z0-9_\-]+)/g);
    if (pipMatches) {
        pipMatches.forEach((m) => cliSet.add(m.trim()));
    }
    // curl install scripts
    const curlMatches = markdown.match(/curl\s+-fsSL\s+([^\s|]+\.sh)\s+\|\s+bash/g);
    if (curlMatches) {
        curlMatches.forEach((m) => cliSet.add(m.trim()));
    }
    prereqs.cliCommands = Array.from(cliSet);
    return prereqs;
}
/**
 * Resolves a SkillItem into canonical upstream URLs and metadata.
 */
export function resolveSkillManifest(skill) {
    const isLive = isSkillUpstreamLive(skill);
    // If already explicitly populated on the skill object
    if (skill.rawManifestUrl && skill.repoUrl && skill.branch && skill.skillDir) {
        const prereqs = skill.prerequisites ||
            parsePrerequisitesFromMarkdown(skill.content || skill.docsMarkdown?.en || '');
        return {
            repoUrl: skill.repoUrl,
            rawManifestUrl: skill.rawManifestUrl,
            branch: skill.branch,
            skillDir: skill.skillDir,
            companionFiles: skill.companionFiles || [],
            prerequisites: prereqs,
            isUpstreamLive: isLive,
        };
    }
    const cleanSlug = skill.slug || skill.name || skill.id.split('/').pop() || '';
    const hubKey = `${skill.owner || ''}/${skill.repo || ''}`;
    const hub = KNOWN_HUBS[hubKey];
    if (hub && isLive) {
        const { skillDir, companionFiles } = hub.resolvePath(cleanSlug);
        const branch = skill.branch || hub.defaultBranch;
        const repoUrl = `https://github.com/${hub.owner}/${hub.repo}`;
        const rawManifestUrl = `https://raw.githubusercontent.com/${hub.owner}/${hub.repo}/${branch}/${skillDir}/SKILL.md`;
        const prereqs = skill.prerequisites ||
            parsePrerequisitesFromMarkdown(skill.content || skill.docsMarkdown?.en || '');
        return {
            repoUrl,
            rawManifestUrl,
            branch,
            skillDir,
            companionFiles: companionFiles || [],
            prerequisites: prereqs,
            isUpstreamLive: true,
        };
    }
    // Fallback for skills without known upstream repo
    const prereqs = skill.prerequisites ||
        parsePrerequisitesFromMarkdown(skill.content || skill.docsMarkdown?.en || '');
    return {
        repoUrl: skill.repository || skill.remoteUrl || undefined,
        rawManifestUrl: undefined,
        branch: 'main',
        skillDir: cleanSlug,
        companionFiles: [],
        prerequisites: prereqs,
        isUpstreamLive: false,
    };
}
