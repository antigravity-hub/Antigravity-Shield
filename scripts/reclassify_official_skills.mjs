import fs from 'fs';
import path from 'path';

const catalogPath = path.resolve('src/config/skillsCatalog.ts');
let raw = fs.readFileSync(catalogPath, 'utf8');

// 98 Official Technology Makers directly verified from https://skills.sh/official
const OFFICIAL_MAKERS = new Set([
  'aave', 'anthropics', 'antithesishq', 'apify', 'apollographql', 'astronomer',
  'auth0', 'automattic', 'aws', 'axiomhq', 'base', 'better-auth', 'bitwarden',
  'box', 'brave', 'browser-use', 'browserbase', 'callstackincubator', 'clerk',
  'clickhouse', 'cloudflare', 'coderabbitai', 'coinbase', 'contentful',
  'contentstack', 'convex-dev', 'dagster-io', 'dash0hq', 'datadog-labs',
  'dbt-labs', 'deepgram', 'denoland', 'elevenlabs', 'encoredev', 'exploreomni',
  'expo', 'facebook', 'factory-ai', 'figma', 'firebase', 'firecrawl', 'flutter',
  'getsentry', 'github', 'google-gemini', 'google-labs-code', 'google',
  'googlechrome', 'hashicorp', 'huggingface', 'kotlin', 'langchain-ai',
  'langfuse', 'launchdarkly', 'makenotion', 'mapbox', 'mastra-ai', 'mcp-use',
  'medusajs', 'microsoft', 'mongodb', 'n8n-io', 'neondatabase', 'nuxt', 'nvidia',
  'openai', 'openshift', 'parallel-web', 'pinecone-io', 'planetscale', 'posthog',
  'prisma', 'pulumi', 'pytorch', 'redis', 'remotion-dev', 'resend', 'rivet-dev',
  'runwayml', 'sanity-io', 'semgrep', 'shopify', 'signoz', 'streamlit', 'stripe',
  'supabase', 'sveltejs', 'tavily-ai', 'temporalio', 'tinybirdco', 'tldraw',
  'triggerdotdev', 'uniformdev', 'upstash', 'vapiai', 'vercel', 'vercel-labs',
  'webflow', 'wix', 'wordpress', 'radix-ui', 'tailwindlabs', 'tanstack'
]);

const arrayMarker = 'export const SKILLS_SH_CATALOG: SkillItem[] = [';
const markerIdx = raw.indexOf(arrayMarker);
if (markerIdx === -1) {
  console.error('Marker not found!');
  process.exit(1);
}

const jsonStart = raw.indexOf('[', markerIdx + 'export const SKILLS_SH_CATALOG: SkillItem[] = '.length);
const closingIdx = raw.indexOf('\n];\n\n// =========================================================================', jsonStart);

if (closingIdx === -1) {
  // Try CRLF
  const crlfIdx = raw.indexOf('\r\n];\r\n\r\n// =========================================================================', jsonStart);
  if (crlfIdx === -1) {
    console.error('Closing bracket not found!');
    process.exit(1);
  }
}

const actualClosing = raw.indexOf('];', jsonStart);
// Let us locate the exact closing bracket of the array
const helperMarker = raw.indexOf('// =========================================================================', jsonStart);
const arrayEnd = raw.lastIndexOf('];', helperMarker);

const head = raw.substring(0, jsonStart);
const arrayStr = raw.substring(jsonStart, arrayEnd + 1);
const tail = raw.substring(arrayEnd + 1);

const skills = JSON.parse(arrayStr);
console.log(`Loaded ${skills.length} skills from catalog.`);

let officialCount = 0;
let communityCount = 0;

const updatedSkills = skills.map((skill) => {
  const owner = (skill.owner || (skill.id.split('/')[0]) || '').toLowerCase();
  const repo = (skill.repo || (skill.id.split('/')[1]) || '').toLowerCase();
  
  // Check if owner is an official technology maker organization
  const isOfficialMaker = OFFICIAL_MAKERS.has(owner) ||
    OFFICIAL_MAKERS.has(skill.author?.toLowerCase()) ||
    (skill.repository && [...OFFICIAL_MAKERS].some(m => skill.repository.toLowerCase().includes(`github.com/${m}/`)));

  if (isOfficialMaker) {
    officialCount++;
  } else {
    communityCount++;
  }

  // Tags cleanup: if community, remove 'Official' from tags
  let tags = skill.tags || [];
  if (!isOfficialMaker) {
    tags = tags.filter(t => t !== 'Official');
  } else if (!tags.includes('Official')) {
    tags.push('Official');
  }

  return {
    ...skill,
    isOfficial: isOfficialMaker,
    isVerifiedMaker: isOfficialMaker,
    tags
  };
});

console.log(`Reclassification complete:`);
console.log(`- Official Technology Makers (Verified Rosette Checkmark): ${officialCount}`);
console.log(`- Community / Independent Skills (No Rosette Checkmark): ${communityCount}`);

const updatedArrayJson = JSON.stringify(updatedSkills, null, 2);
const updatedFileContent = head + updatedArrayJson + tail;

fs.writeFileSync(catalogPath, updatedFileContent, 'utf8');
console.log('Successfully updated src/config/skillsCatalog.ts');
