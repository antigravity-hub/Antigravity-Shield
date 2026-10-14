import fs from 'fs';
import path from 'path';

const catalogPath = path.resolve('src/config/skillsCatalog.ts');
let raw = fs.readFileSync(catalogPath, 'utf8');

// Find start of array
const arrayStart = raw.indexOf('export const SKILLS_SH_CATALOG: SkillItem[] = [');
if (arrayStart === -1) {
  console.error('Cannot find array start in skillsCatalog.ts');
  process.exit(1);
}

const jsonStart = raw.indexOf('[', arrayStart);
// Find the closing bracket followed by semicolon for the catalog array
const closingPattern = '\n];';
const jsonEnd = raw.indexOf(closingPattern, jsonStart);
if (jsonEnd === -1) {
  console.error('Cannot find array end in skillsCatalog.ts');
  process.exit(1);
}

const arrayStr = raw.substring(jsonStart, jsonEnd + 2); // includes ']'
const tail = raw.substring(jsonEnd + closingPattern.length); // helper functions after array
let skills;
try {
  skills = JSON.parse(arrayStr);
} catch (e) {
  // If not strict JSON, use Function evaluation safely
  skills = new Function(`return ${arrayStr}`)();
}

console.log(`Loaded ${skills.length} skills from catalog.`);

// Role and Criticality inference tables
function inferDomain(skill) {
  const text = `${skill.id} ${skill.name} ${skill.title} ${skill.category} ${(skill.tags || []).join(' ')} ${(skill.triggers || []).join(' ')} ${skill.description}`.toLowerCase();
  
  if (/alphafold|genome|protein|ncbi|blast|chembl|pubchem|pubmed|biorxiv|clinvar|pdb|jaspar|ucsc|ols|uniprot|unibind|reactome|predictingthepast|medical/.test(text)) {
    return 'science';
  }
  if (/figma|apple-design|emil|animation|gsap|framer|motion|canvas|svg|tailwind|css|react-bits|magic-ui|hairline|zdog|vanta|lightweight-3d|threejs|three\.js|spline|remotion|lottie|ui-ux|frontend-design/.test(text)) {
    return 'frontend';
  }
  if (/nest|express|node|prisma|postgres|sql|database|backend|microservice|kafka|redis|auth|webhook|api-anything/.test(text)) {
    return 'backend';
  }
  if (/nextjs|next\.js|full-stack|fullstack|remix|astro/.test(text)) {
    return 'fullstack';
  }
  if (/docker|kubernetes|ci\/cd|github-actions|nginx|cloudflare|terraform|devops|android-cli/.test(text)) {
    return 'devops';
  }
  if (/clean-architecture|system-design|architect|refactor|solid|code-review|perpetual|ponytail|matt-murphy|platform-performance/.test(text)) {
    return 'architecture';
  }
  if (/browser|crawl|playwright|telegram|bot|scrape|google-flow|automation|workflow|lark|flow/.test(text)) {
    return 'automation';
  }
  if (/bigquery|clickhouse|analytics|biostatistics|quant|data|memclaw|timescale/.test(text)) {
    return 'data';
  }
  if (skill.category === 'design') return 'frontend';
  if (skill.category === 'coding') return 'fullstack';
  if (skill.category === 'devops') return 'devops';
  if (skill.category === 'data') return 'data';
  if (skill.category === 'science') return 'science';
  if (skill.category === 'architecture') return 'architecture';
  return 'general';
}

function inferCriticality(skill, domain) {
  const text = `${skill.id} ${skill.name} ${skill.title}`.toLowerCase();
  if (/react-best-practices|backend-architect|backend-dev-guidelines|frontend-dev-guidelines|postgres-best-practices|postgresql-optimization|platform-performance|matt-murphy|code-review|find-skills|grill-me|node-best-practices|clean-architecture/.test(text)) {
    return 'critical';
  }
  if (/animation|threejs|gsap|spline|lottie|hairline|apple-design|quant|seo|marketing|telegram-bot|alphafold|agent-browser/.test(text)) {
    return 'recommended';
  }
  return 'specialized';
}

function cleanDescription(skill) {
  let d = skill.description || '';
  if (d.startsWith('Official trending agent skill') || d.startsWith('Production agent skill')) {
    return `Official agent skill for ${skill.title} developed by ${skill.author || 'Community'}. Delivers specialized agent instructions, boundary enforcement, and production engineering patterns.`;
  }
  const parts = d.split('.').filter(sentence => 
    !sentence.includes('Ranked') && 
    !sentence.includes('Skills.sh') && 
    !sentence.includes('verified installs')
  );
  let cleaned = parts.join('.').trim();
  if (cleaned.endsWith('.')) cleaned = cleaned.slice(0, -1).trim();
  if (!cleaned || cleaned.length < 15) {
    cleaned = `Specialized agent skill for ${skill.title} developed by ${skill.author || 'Community'} for automated workflows and production best practices`;
  }
  return cleaned + '.';
}

function generateDocs(skill, role, criticality, cleanedDesc) {
  const roleNameEn = {
    frontend: 'Frontend Engineers & UI Specialists',
    backend: 'Backend Developers & System Architects',
    fullstack: 'Full-Stack Software Engineers',
    devops: 'DevOps & Infrastructure Engineers',
    architecture: 'Principal Architects & Tech Leads',
    data: 'Data Engineers & Database Administrators',
    science: 'Computational Biologists & Life Science Researchers',
    automation: 'Automation Specialists & Bot Developers',
    general: 'General Software Engineering Teams'
  }[role] || 'Software Engineers';

  const roleNameFa = {
    frontend: 'مهندسان فرانت‌اند و طراحان رابط کاربری (UI/UX)',
    backend: 'توسعه‌دهندگان بک‌اند و معماران سیستم',
    fullstack: 'مهندسان فول‌استک و توسعه محصول',
    devops: 'مهندسان دوآپس، زیرساخت و کلود',
    architecture: 'معماران ارشد نرم‌افزار و راهبران فنی',
    data: 'مهندسان داده و مدیران پایگاه داده (DBA)',
    science: 'پژوهشگران علوم داده، بیوانفورماتیک و داروسازی',
    automation: 'متخصصان اتوماسیون، وب اسکرپینگ و توسعه بات',
    general: 'کلیه تیم‌های مهندسی نرم‌افزار'
  }[role] || 'مهندسان نرم‌افزار';

  const critBadgeEn = criticality === 'critical' ? '🔴 CRITICAL (Must-Have)' : criticality === 'recommended' ? '🟡 HIGH PRIORITY (Recommended)' : '🔵 SPECIALIZED UTILITY';
  const critBadgeFa = criticality === 'critical' ? '🔴 حیاتی (الزامی برای پروژه)' : criticality === 'recommended' ? '🟡 اولویت بالا (توصیه اکید)' : '🔵 ابزار تخصصی ماژولار';

  const roleBadgeEn = role.toUpperCase();
  const roleBadgeFa = {
    frontend: 'فرانت‌اند (FRONTEND)',
    backend: 'بک‌اند (BACKEND)',
    fullstack: 'فول‌استک (FULLSTACK)',
    devops: 'دوآپس و زیرساخت (DEVOPS)',
    architecture: 'معماری و سیستم (ARCHITECTURE)',
    data: 'پایگاه داده و دیتا (DATA)',
    science: 'علمی و تحقیقاتی (SCIENCE)',
    automation: 'اتوماسیون (AUTOMATION)',
    general: 'عمومی (GENERAL)'
  }[role];

  // Specific domain details
  const triggersList = (skill.triggers || [`/${skill.name}`]).map(t => `\`${t.startsWith('/') ? t : '/' + t}\``).join(', ');

  const docsEn = `# ${skill.title}

> [!IMPORTANT]
> **Level:** ${critBadgeEn}  
> **Domain:** \`${roleBadgeEn}\` | **Category:** \`${skill.category.toUpperCase()}\` | **Version:** \`v${skill.version || '1.0.0'}\`

## ⚡ In Plain English
${cleanedDesc}
This skill acts as a dedicated co-pilot extension inside Antigravity, equipping the AI agent with deep procedural domain knowledge, boundary constraints, and battle-tested industry heuristics.

## 🎯 Target Audience & Domain
- **Primary Audience:** ${roleNameEn}
- **Architecture Layer:** ${roleBadgeEn}
- **Ecosystem Focus:** Modern high-performance production codebases

## 🔥 Criticality & Impact in Project
${criticality === 'critical' 
  ? `> [!CAUTION]
> **Core Architectural Pillar:** This skill prevents fatal anti-patterns, memory leaks, security vulnerabilities, or performance bottlenecks in your ${roleBadgeEn} pipeline. Highly essential for mission-critical apps.`
  : `> [!TIP]
> **Productivity & Polish Accelerator:** Enhances engineering velocity, ergonomics, and visual/operational quality while adhering to strict zero-leak principles.`
}

## ✅ When to Use
- When designing, implementing, or refactoring components related to **${skill.title}**.
- When conducting rigorous architectural reviews, code hygiene audits, or troubleshooting regressions.
- When you need exact best practices without guessing or relying on hallucinated API contracts.

## 🚫 When NOT to Use
- When working on lightweight standalone prototypes where standard baseline defaults suffice.
- When an isolated non-standard legacy stack explicitly forbids modern architectural patterns.

## 🚀 Value Added to Your Project
- **100% Zero-Leak Isolation:** Runs locally inside your secure Antigravity environment with complete key privacy.
- **Production-Grade Consistency:** Eliminates vibe-coding and phantom edits through verified patterns.
- **Deterministic Velocity:** Delivers instant expert guidelines tailored specifically for ${skill.title}.

## 📦 Activation Triggers
Activate via chat prompts or slash-commands: ${triggersList}
`;

  const docsFa = `# ${skill.title}

> [!IMPORTANT]
> **سطح اهمیت:** ${critBadgeFa}  
> **حوزه تخصصی:** \`${roleBadgeFa}\` | **دسته‌بندی:** \`${skill.category.toUpperCase()}\` | **نسخه:** \`v${skill.version || '1.0.0'}\`

## ⚡ به زبان ساده چیست؟
${cleanedDesc}
این مهارت به عنوان یک متخصص ارشد و همکار هوشمند در Antigravity عمل می‌کند و ایجنت را به دانش عمیق رویه‌ای، مهار خطاهای رایج، الگوهای معماری ضدگلوله و استانداردهای روز صنعت مجهز می‌سازد.

## 🎯 برای چه کسانی کاربرد دارد؟
- **مخاطب اصلی:** ${roleNameFa}
- **لایه معماری:** ${roleBadgeFa}
- **تمرکز اجرایی:** پروژه‌های واقعی، مقیاس‌پذیر و نیازمند قابلیت اطمینان بالا

## 🔥 میزان اهمیت و نقش در پروژه
${criticality === 'critical'
  ? `> [!CAUTION]
> **ستون حیاتی معماری:** استفاده از این مهارت برای جلوگیری از نشت حافظه، شکاف‌های امنیتی، افت شدید پرفورمنس یا باگ‌های پنهان در لایه ${roleBadgeFa} الزامی است.`
  : `> [!TIP]
> **شتاب‌دهنده کیفیت و سرعت توسعه:** پیاده‌سازی تمیز، ارگونومیک و بدون آزمون و خطای کامپوننت‌ها و ماژول‌ها را با رعایت کامل اصل Zero-Leak تضمین می‌کند.`
}

## ✅ چه زمانی باید استفاده شود؟
- هنگام طراحی، کدنویسی، دیباگ یا ریفکتور بخش‌های مرتبط با **${skill.title}**.
- در فرآیند بازبینی کد (Code Review)، ممیزی استانداردها و ارتقای پرفورمنس سیستم.
- هنگامی که به گایدلاین‌های دقیق صنعتی بدون توهمات مدل زبانی (Hallucinations) نیاز دارید.

## 🚫 چه زمانی نباید استفاده شود؟
- در پروژه‌های تست بسیار ابتدایی و دموی موقت که نیازی به رعایت استانداردهای پروداکشن ندارند.
- در سیستم‌های قدیمی ایزوله‌ای که معماری متناقض با استانداردهای مدرن دارند.

## 🚀 چه قابلیت یا ارزش افزوده‌ای ایجاد می‌کند؟
- **ایزولاسیون ۱۰۰٪ محلی (Zero-Leak):** حفظ کامل حریم خصوصی و عدم نشت اطلاعات یا کلیدها به بیرون.
- **ریشه‌کنی خطاهای فانتوم:** اجرای جراحی تمیز کد با رعایت ناورداهای ریاضی و معماری.
- **افزایش سرعت توسعه:** پاسخگویی آنی با راه‌حل‌های بهینه بدون نیاز به ساعت‌ها جستجو در مستندات پراکنده.

## 📦 نحوه فراخوانی و تریگرها
از طریق پرامپت چت یا دستورات اسلش فعال می‌شود: ${triggersList}
`;

  return { docsEn, docsFa };
}

// Process all skills
let updatedCount = 0;
const enrichedSkills = skills.map((skill) => {
  const role = inferDomain(skill);
  const criticality = inferCriticality(skill, role);
  const cleanedDesc = cleanDescription(skill);
  const { docsEn, docsFa } = generateDocs(skill, role, criticality, cleanedDesc);

  updatedCount++;
  return {
    ...skill,
    description: cleanedDesc,
    isEnriched: true, // Verification tick flag requested by user
    targetRole: role,
    criticality: criticality,
    docsMarkdown: {
      en: docsEn,
      fa: docsFa,
    },
  };
});

console.log(`Enriched ${updatedCount} skills with clean descriptions, dual-language markdown and isEnriched: true.`);

// Write back to skillsCatalog.ts
const newHeader = raw.substring(0, arrayStart) + 'export const SKILLS_SH_CATALOG: SkillItem[] = ';
const newFileContent = newHeader + JSON.stringify(enrichedSkills, null, 2) + ';\n' + tail;

fs.writeFileSync(catalogPath, newFileContent, 'utf8');
console.log('Successfully saved enriched catalog to src/config/skillsCatalog.ts');
