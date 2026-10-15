use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tracing::{info, warn};

/// Canonical representation of an AI Agent Skill strictly aligned with frontend SkillItem interface.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SkillItem {
    pub id: String,
    pub name: String,
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub category: String, // "coding" | "design" | "devops" | "data" | "automation" | "science" | "architecture"
    #[serde(default)]
    pub author: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repo: Option<String>,
    #[serde(default = "default_version")]
    pub version: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(default)]
    pub triggers: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default = "default_scope")]
    pub scope: String, // "global" | "workspace"
    #[serde(default)]
    pub is_installed: bool,
    #[serde(default)]
    pub is_enabled: bool,
    /// Strict Local Confinement: Local skills MUST be tagged is_local: true
    #[serde(default)]
    pub is_local: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_official: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub installs: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stars: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub first_seen: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub install_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub local_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub remote_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repository: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audits: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audit_status: Option<String>,
    #[serde(default)]
    pub dependencies: Vec<String>,
    #[serde(default = "default_source_type")]
    pub source_type: String, // "local" | "skills_sh" | "github"
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_enriched: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_role: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub criticality: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub docs_markdown: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repo_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub raw_manifest_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub skill_dir: Option<String>,
    #[serde(default)]
    pub companion_files: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_upstream_live: Option<bool>,
}

fn default_version() -> String {
    "1.0.0".to_string()
}
fn default_scope() -> String {
    "global".to_string()
}
fn default_source_type() -> String {
    "local".to_string()
}

/// Discovered filesystem scan root with priority ranking.
#[derive(Debug, Clone)]
pub struct ScanRoot {
    pub path: PathBuf,
    pub priority: u8,
    pub source_name: &'static str,
}

/// Parsed metadata from YAML frontmatter block.
#[derive(Debug, Default)]
pub struct ParsedFrontmatter {
    pub name: Option<String>,
    pub description: Option<String>,
    pub version: Option<String>,
    pub author: Option<String>,
    pub license: Option<String>,
    pub category: Option<String>,
    pub triggers: Vec<String>,
    pub tags: Vec<String>,
    pub argument_hint: Option<String>,
    pub other: HashMap<String, String>,
}

// ============================================================================
// ZERO-LEAK PRIVACY GUARD: REDACTION & NORMALIZATION
// ============================================================================

static RE_GITHUB_CLASSIC: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\bgh[pousr]_[a-zA-Z0-9]{36}\b").expect("Valid GitHub classic regex")
});

static RE_GITHUB_FINE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\bgithub_pat_[a-zA-Z0-9_]{60,100}\b").expect("Valid GitHub fine PAT regex")
});

static RE_ANTHROPIC: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\bsk-ant-(?:api\d{2}-)?[a-zA-Z0-9_\-]{20,}\b").expect("Valid Anthropic regex")
});

static RE_OPENAI: Lazy<Regex> = Lazy::new(|| {
    // Note: Evaluated strictly after Anthropic, so sk-ant- is already sanitized
    Regex::new(r"\bsk-(?:proj-)?[a-zA-Z0-9_\-]{20,}\b").expect("Valid OpenAI regex")
});

static RE_NOTION: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\b(?:ntn_[a-zA-Z0-9]{20,}|secret_[a-zA-Z0-9]{30,})\b").expect("Valid Notion regex")
});

static RE_21ST: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\b21st(?:_sk)?_[a-zA-Z0-9]{20,}\b").expect("Valid 21st.dev regex")
});

static RE_BEARER: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(bearer\s+)[a-zA-Z0-9_\-\.]+").expect("Valid Bearer regex")
});

static RE_TELEGRAM: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\b\d{8,11}:[a-zA-Z0-9_\-]{35}\b").expect("Valid Telegram regex")
});

static RE_GOOGLE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\bAIza[0-9A-Za-z\-_]{30,45}\b").expect("Valid Google AI regex")
});

static RE_AWS: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\bAKIA[0-9A-Z]{16}\b").expect("Valid AWS Access Key regex")
});

static RE_EXA: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?i)\b(exa[_\-]?api[_\-]?key)[ \t]*([:=])[ \t]*["']?([0-9a-fA-F\-]{32,36}|[a-zA-Z0-9_\-]{20,})["']?"#)
        .expect("Valid Exa API key regex")
});

static RE_URI_CREDENTIALS: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?i)([a-z0-9+.\-]+://[^:\s"']+):([^\s"']+)(@[^@\s"']+)"#)
        .expect("Valid URI credentials regex")
});

static RE_COMPOUND_SECRET: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?i)\b([a-zA-Z0-9_\-]*(?:api[_\-]?key|secret|token|password|passwd|auth|access[_\-]?key|private[_\-]?key)[a-zA-Z0-9_\-]*)[ \t]*([:=])[ \t]*["']?([^\s"'`;,}&]{8,})['"]?"#)
        .expect("Valid generic secret assignment regex")
});

static RE_WIN_USER_ROOT: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?i)[a-zA-Z]:[/\\]users[/\\][a-zA-Z0-9_\.\-]+"#)
        .expect("Valid Windows user path regex")
});

static RE_UNIX_USER_ROOT: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"/(?:home|Users)/[a-zA-Z0-9_\.\-]+"#)
        .expect("Valid Unix user path regex")
});

pub struct ZeroLeakRedactor;

impl ZeroLeakRedactor {
    /// In-memory secret redactor masking API keys, private tokens, and credentials.
    pub fn redact(text: &str) -> String {
        // Strict precedence: Anthropic before OpenAI to avoid prefix collision
        let s = RE_GITHUB_CLASSIC.replace_all(text, "[REDACTED_GITHUB_TOKEN]");
        let s = RE_GITHUB_FINE.replace_all(&s, "[REDACTED_GITHUB_PAT]");
        let s = RE_ANTHROPIC.replace_all(&s, "[REDACTED_ANTHROPIC_KEY]");
        let s = RE_OPENAI.replace_all(&s, "[REDACTED_OPENAI_KEY]");
        let s = RE_NOTION.replace_all(&s, "[REDACTED_NOTION_TOKEN]");
        let s = RE_21ST.replace_all(&s, "[REDACTED_21ST_KEY]");
        let s = RE_BEARER.replace_all(&s, "$1[REDACTED_BEARER_TOKEN]");
        let s = RE_TELEGRAM.replace_all(&s, "[REDACTED_TELEGRAM_BOT_TOKEN]");
        let s = RE_GOOGLE.replace_all(&s, "[REDACTED_GOOGLE_API_KEY]");
        let s = RE_AWS.replace_all(&s, "[REDACTED_AWS_KEY]");
        let s = RE_EXA.replace_all(&s, r#"$1: "[REDACTED_EXA_KEY]""#);
        let s = RE_URI_CREDENTIALS.replace_all(&s, "$1:[REDACTED_PASSWORD]$3");
        let s = RE_COMPOUND_SECRET.replace_all(&s, |caps: &regex::Captures| {
            let val = &caps[3];
            if val.starts_with("[REDACTED_") || val.contains("REDACTED_") {
                caps[0].to_string()
            } else {
                format!(r#"{}: "[REDACTED_SECRET]""#, &caps[1])
            }
        });

        Self::normalize_path(&s)
    }

    /// Normalizes OS user paths (e.g. C:\Users\<username>) to ~ and converts backslashes to slashes.
    pub fn normalize_path(path_str: &str) -> String {
        let mut result = path_str.to_string();

        if let Some(home) = dirs::home_dir() {
            let home_str = home.to_string_lossy();
            let home_forward = home_str.replace('\\', "/");
            let home_back = home_str.replace('/', "\\");

            if let Ok(re_f) = Regex::new(&format!("(?i){}", regex::escape(&home_forward))) {
                result = re_f.replace_all(&result, "~").into_owned();
            }
            if let Ok(re_b) = Regex::new(&format!("(?i){}", regex::escape(&home_back))) {
                result = re_b.replace_all(&result, "~").into_owned();
            }
        }

        result = RE_WIN_USER_ROOT.replace_all(&result, "~").into_owned();
        result = RE_UNIX_USER_ROOT.replace_all(&result, "~").into_owned();
        result.replace('\\', "/")
    }
}

/// Normalizes local filesystem path for display.
pub fn normalize_user_path(path_str: &str) -> String {
    ZeroLeakRedactor::normalize_path(path_str)
}

// ============================================================================
// READ-BOUNDARY FENCE & CONFINEMENT GUARD
// ============================================================================

pub struct ReadBoundaryFence;

impl ReadBoundaryFence {
    const FORBIDDEN_EXTENSIONS: &'static [&'static str] = &[
        "env", "credentials", "key", "pem", "crt", "p12", "pfx",
        "exe", "bat", "cmd", "ps1", "sh", "vbs", "py", "js", "ts",
        "db", "sqlite", "sqlite3", "dll", "so", "dylib",
    ];

    const FORBIDDEN_FILENAMES: &'static [&'static str] = &[
        "mcp_config.json", "config.json", "settings.json", "token.json",
        "accounts.json", "credentials.json", "id_rsa", "id_ed25519",
    ];

    /// Validates target path against strict read boundaries.
    pub fn validate_read_path(path: &Path) -> Result<(), String> {
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| "Invalid file name".to_string())?;

        // 1. Target Allowlist: Only SKILL.md, SKILL.md.disabled, or plugin.json
        let is_allowed = file_name.eq_ignore_ascii_case("SKILL.md")
            || file_name.eq_ignore_ascii_case("SKILL.md.disabled")
            || file_name.eq_ignore_ascii_case("plugin.json");

        if !is_allowed {
            return Err(format!(
                "Read-Boundary Fence Violation: Forbidden file '{}'. Only 'SKILL.md' and 'plugin.json' are accessible.",
                file_name
            ));
        }

        // 2. Reject dotfiles
        if file_name.starts_with('.') {
            return Err(format!(
                "Read-Boundary Fence Violation: Hidden files are strictly blocked ('{}').",
                file_name
            ));
        }

        // 3. Reject sensitive filenames
        let lower_name = file_name.to_ascii_lowercase();
        for &forbidden in Self::FORBIDDEN_FILENAMES {
            if lower_name == forbidden {
                return Err(format!(
                    "Read-Boundary Fence Violation: Blocked sensitive config '{}'.",
                    file_name
                ));
            }
        }

        // 4. Reject dangerous extensions
        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            let lower_ext = ext.to_ascii_lowercase();
            for &forbidden_ext in Self::FORBIDDEN_EXTENSIONS {
                if lower_ext == forbidden_ext {
                    return Err(format!(
                        "Read-Boundary Fence Violation: Forbidden extension '.{}'.",
                        ext
                    ));
                }
            }
        }

        // 5. Parent directory traversal check
        for component in path.components() {
            if let std::path::Component::ParentDir = component {
                return Err("Read-Boundary Fence Violation: Directory traversal ('..') is prohibited.".to_string());
            }
        }

        Ok(())
    }

    /// Reads file under fence protection with 1 MiB hard ceiling and secret redaction.
    pub fn read_skill_file(path: &Path) -> Result<String, String> {
        Self::validate_read_path(path)?;

        if let Ok(meta) = fs::metadata(path) {
            const MAX_SIZE: u64 = 1024 * 1024; // 1 MiB
            if meta.len() > MAX_SIZE {
                return Err(format!(
                    "Read-Boundary Fence Violation: File size ({} bytes) exceeds 1 MiB ceiling.",
                    meta.len()
                ));
            }
        }

        let raw_bytes = fs::read(path).map_err(|e| format!("Failed to read '{:?}': {}", path, e))?;
        let raw_str = String::from_utf8_lossy(&raw_bytes).to_string();

        Ok(ZeroLeakRedactor::redact(&raw_str))
    }
}

pub struct LocalConfinementGuard;

impl LocalConfinementGuard {
    /// Filters out locally confined skills from outbound telemetry payloads.
    pub fn filter_outbound(skills: &[SkillItem]) -> Vec<SkillItem> {
        skills
            .iter()
            .filter(|s| !s.is_local && s.source_type != "local")
            .cloned()
            .collect()
    }

    /// Hard assert preventing any network transmission of local skills.
    pub fn assert_can_transmit(skill: &SkillItem) -> Result<(), String> {
        if skill.is_local || skill.source_type == "local" {
            return Err(format!(
                "Privacy Violation: Skill '{}' is locally confined (isLocal: true) and cannot be transmitted to external endpoints.",
                skill.id
            ));
        }
        Ok(())
    }
}

// ============================================================================
// RESILIENT FRONTMATTER & MARKDOWN PARSER
// ============================================================================

/// Splits YAML frontmatter from markdown body, handling duplicate/empty delimiters.
pub fn split_frontmatter<'a>(content: &'a str) -> (Vec<&'a str>, &'a str) {
    let clean = content.strip_prefix('\u{feff}').unwrap_or(content);
    let lines: Vec<&'a str> = clean.lines().collect();
    let mut i = 0;

    // Skip leading blank lines before first delimiter
    while i < lines.len() && lines[i].trim().is_empty() {
        i += 1;
    }

    if i >= lines.len() || lines[i].trim() != "---" {
        return (Vec::new(), clean);
    }

    i += 1;
    let mut frontmatter_lines = Vec::new();
    let mut found_closing = false;

    while i < lines.len() {
        let line = lines[i];
        let trimmed = line.trim();

        if trimmed == "---" {
            let has_content = frontmatter_lines
                .iter()
                .any(|l: &&'a str| !l.trim().is_empty() && l.contains(':'));

            if !has_content {
                // Leading empty delimiter detected (e.g. core-web-vitals: "--- \n\n ---") -> reset buffer!
                frontmatter_lines.clear();
                i += 1;
                continue;
            } else {
                found_closing = true;
                i += 1;
                break;
            }
        } else {
            frontmatter_lines.push(line);
            i += 1;
        }
    }

    let body_start_byte = if found_closing && i < lines.len() {
        let remaining_lines = &lines[i..];
        if !remaining_lines.is_empty() {
            (remaining_lines[0].as_ptr() as usize) - (clean.as_ptr() as usize)
        } else {
            clean.len()
        }
    } else {
        clean.len()
    };

    if !found_closing {
        return (Vec::new(), clean);
    }

    (frontmatter_lines, &clean[body_start_byte..])
}

/// Parses frontmatter lines into structured metadata with multiline scalar folding.
pub fn parse_frontmatter_lines(lines: &[&str]) -> ParsedFrontmatter {
    let mut result = ParsedFrontmatter::default();
    let mut i = 0;

    while i < lines.len() {
        let line = lines[i];
        let trimmed = line.trim();

        if trimmed.is_empty() || trimmed.starts_with('#') {
            i += 1;
            continue;
        }

        if let Some(colon_idx) = line.find(':') {
            let key = line[..colon_idx].trim().to_lowercase();
            let val_part = line[colon_idx + 1..].trim();

            // Folded (>, >-) or literal (|, |-) multiline scalars
            if val_part == ">" || val_part == ">-" || val_part == "|" || val_part == "|-" {
                let is_folded = val_part.starts_with('>');
                let mut scalar_lines = Vec::new();
                i += 1;

                while i < lines.len() {
                    let next_line = lines[i];
                    if next_line.starts_with(' ') || next_line.starts_with('\t') {
                        scalar_lines.push(next_line.trim());
                        i += 1;
                    } else if next_line.trim().is_empty() {
                        i += 1;
                    } else {
                        break; // Unindented line terminates scalar
                    }
                }

                let merged = if is_folded {
                    scalar_lines.join(" ")
                } else {
                    scalar_lines.join("\n")
                };

                assign_frontmatter_field(&mut result, &key, merged.trim());
                continue;
            }

            // Flow array: [a, b, c]
            if val_part.starts_with('[') && val_part.ends_with(']') {
                let inner = &val_part[1..val_part.len() - 1];
                let items: Vec<String> = inner
                    .split(',')
                    .map(|s| strip_quotes(s.trim()))
                    .filter(|s| !s.is_empty())
                    .collect();

                if key == "triggers" {
                    result.triggers = items;
                } else if key == "tags" {
                    result.tags = items;
                }
                i += 1;
                continue;
            }

            // Normal scalar
            let clean_val = strip_quotes(val_part);
            assign_frontmatter_field(&mut result, &key, &clean_val);
        }

        i += 1;
    }

    result
}

fn strip_quotes(s: &str) -> String {
    let trimmed = s.trim();
    if (trimmed.starts_with('"') && trimmed.ends_with('"'))
        || (trimmed.starts_with('\'') && trimmed.ends_with('\''))
    {
        if trimmed.len() >= 2 {
            return trimmed[1..trimmed.len() - 1].to_string();
        }
    }
    trimmed.to_string()
}

fn assign_frontmatter_field(dest: &mut ParsedFrontmatter, key: &str, val: &str) {
    match key {
        "name" => dest.name = Some(val.to_string()),
        "description" => dest.description = Some(val.to_string()),
        "version" => dest.version = Some(val.to_string()),
        "author" => dest.author = Some(val.to_string()),
        "license" => dest.license = Some(val.to_string()),
        "category" => dest.category = Some(val.to_string()),
        "argument-hint" => dest.argument_hint = Some(val.to_string()),
        _ => {
            dest.other.insert(key.to_string(), val.to_string());
        }
    }
}

/// Strictly validates opening/closing delimiters '---', non-empty 'name', and non-empty 'description'.
pub fn validate_skill_frontmatter(content: &str) -> Result<ParsedFrontmatter, String> {
    let (lines, _) = split_frontmatter(content);
    if lines.is_empty() {
        return Err("Missing YAML frontmatter delimiters ('---')".to_string());
    }
    let parsed = parse_frontmatter_lines(&lines);
    if parsed.name.as_deref().unwrap_or("").trim().is_empty() {
        return Err("YAML frontmatter missing required 'name' field".to_string());
    }
    if parsed.description.as_deref().unwrap_or("").trim().is_empty() {
        return Err("YAML frontmatter missing required 'description' field".to_string());
    }
    Ok(parsed)
}

/// Extracts title from the first Level-1 Markdown header (# Title) in markdown body.
pub fn extract_title(body: &str, fallback_name: &str) -> String {
    for line in body.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("# ") {
            let candidate = trimmed[2..].trim();
            if !candidate.is_empty() {
                return candidate.to_string();
            }
        }
    }

    // Fallback: title-case from name (e.g. "core-web-vitals" -> "Core Web Vitals")
    fallback_name
        .split(['-', '_'])
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Infers domain category across the 7 core categories.
pub fn infer_category(
    dir_name: &str,
    description: &str,
    path: &Path,
    explicit_category: Option<&str>,
) -> String {
    if let Some(cat) = explicit_category {
        let lower = cat.to_lowercase();
        if matches!(
            lower.as_str(),
            "coding" | "design" | "devops" | "data" | "automation" | "science" | "architecture"
        ) {
            return lower;
        }
    }

    let lower_path = path.to_string_lossy().to_lowercase();
    let lower_name = dir_name.to_lowercase();
    let lower_desc = description.to_lowercase();

    // 1. Science
    if lower_path.contains("science")
        || lower_name.contains("alphafold")
        || lower_name.contains("genome")
        || lower_name.contains("protein")
        || lower_name.contains("pdb")
        || lower_name.contains("dna")
        || lower_name.contains("rna")
        || lower_name.contains("bio")
        || lower_name.contains("chembl")
        || lower_name.contains("medical")
        || lower_name.contains("pubmed")
        || lower_name.contains("clinical")
        || lower_name.contains("uniprot")
        || lower_name.contains("dbsnp")
        || lower_name.contains("ncbi")
        || lower_desc.contains("پزشکی")
        || lower_desc.contains("زیستی")
        || lower_desc.contains("آمار زیستی")
        || lower_desc.contains("protein")
        || lower_desc.contains("genome")
        || lower_desc.contains("clinical")
    {
        return "science".to_string();
    }

    // 2. Automation (prioritized over generic design matches)
    if lower_name.contains("flow")
        || lower_name.contains("telegram")
        || lower_name.contains("bot")
        || lower_name.contains("scrape")
        || lower_name.contains("crawler")
        || lower_name.contains("gdrive")
        || lower_name.contains("gdocs")
        || lower_name.contains("gsheets")
        || lower_name.contains("automate")
        || lower_desc.contains("اتوماسیون")
        || lower_desc.contains("automation")
        || lower_desc.contains("automate")
    {
        return "automation".to_string();
    }

    // 3. Design & Motion (carefully token-matched to prevent "builder" falsely matching "ui")
    let has_ui_ux_token = lower_name.split(['-', '_']).any(|w| w == "ui" || w == "ux")
        || lower_desc.contains(" ui ")
        || lower_desc.contains(" ux ")
        || lower_desc.contains("ui/ux")
        || lower_desc.contains("user interface");

    if lower_name.contains("design")
        || lower_name.contains("animate")
        || lower_name.contains("motion")
        || has_ui_ux_token
        || lower_name.contains("css")
        || lower_name.contains("tailwind")
        || lower_name.contains("svg")
        || lower_name.contains("3d")
        || lower_name.contains("threejs")
        || lower_name.contains("spline")
        || lower_name.contains("lottie")
        || lower_name.contains("gsap")
        || lower_name.contains("hairline")
        || lower_desc.contains("طراحی")
        || lower_desc.contains("animation")
        || lower_desc.contains("interface design")
    {
        return "design".to_string();
    }

    // 4. Data & Storage
    if lower_name.contains("data")
        || lower_name.contains("postgres")
        || lower_name.contains("sql")
        || lower_name.contains("sqlite")
        || lower_name.contains("redis")
        || lower_name.contains("prisma")
        || lower_name.contains("indexing")
        || lower_name.contains("analytics")
        || lower_desc.contains("پایگاه‌داده")
        || lower_desc.contains("database")
        || lower_desc.contains("spss")
    {
        return "data".to_string();
    }

    // 5. DevOps & Cloud
    if lower_name.contains("devops")
        || lower_name.contains("docker")
        || lower_name.contains("kubernetes")
        || lower_name.contains("cloudflare")
        || lower_name.contains("nginx")
        || lower_name.contains("deploy")
        || lower_name.contains("tunnel")
        || lower_name.contains("infra")
        || lower_desc.contains("دوآپس")
    {
        return "devops".to_string();
    }

    "coding".to_string()
}

/// Parses raw markdown file into canonical SkillItem.
pub fn parse_skill_markdown(
    content: &str,
    fallback_name: &str,
    skill_dir: &Path,
    is_enabled: bool,
    _source_name: &str,
) -> SkillItem {
    let (frontmatter_lines, body) = split_frontmatter(content);
    let meta = parse_frontmatter_lines(&frontmatter_lines);

    let name = meta.name.unwrap_or_else(|| fallback_name.to_string());
    let raw_desc = meta.description.unwrap_or_default();
    let description = ZeroLeakRedactor::redact(&raw_desc);
    let title = extract_title(body, &name);
    let category = infer_category(
        fallback_name,
        &description,
        skill_dir,
        meta.category.as_deref(),
    );
    let author = meta.author.unwrap_or_else(|| "Community".to_string());
    let version = meta.version.unwrap_or_else(|| "1.0.0".to_string());

    let mut triggers = meta.triggers;
    if triggers.is_empty() {
        if let Some(hint) = meta.argument_hint {
            triggers.push(format!("/{} {}", name, hint));
        } else {
            triggers.push(format!("/{}", name));
        }
    }

    let mut tags = meta.tags;
    if tags.is_empty() {
        tags.push(category.clone());
        tags.push("Local".to_string());
    }

    let icon = match category.as_str() {
        "design" => "Palette",
        "data" => "Database",
        "devops" => "Cloud",
        "automation" => "Bot",
        "science" => "Atom",
        _ => "Code2",
    }
    .to_string();

    let id = fallback_name.trim_end_matches(".disabled").to_string();
    let norm_path = normalize_user_path(&skill_dir.to_string_lossy());

    SkillItem {
        id,
        name,
        title,
        description,
        category,
        author,
        repo: None,
        version,
        icon: Some(icon),
        triggers,
        tags,
        scope: "global".to_string(),
        is_installed: true,
        is_enabled,
        is_local: true,
        is_official: Some(false),
        installs: None,
        install_path: Some(norm_path.clone()),
        local_path: Some(norm_path),
        content: None,
        source_url: None,
        dependencies: Vec::new(),
        source_type: "local".to_string(),
        ..Default::default()
    }
}

// ============================================================================
// SCANNER & ROOT RESOLUTION
// ============================================================================

/// Returns all standard skill roots relative to the user's home directory.
pub fn get_skill_scan_roots() -> Vec<ScanRoot> {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return Vec::new(),
    };

    let mut roots = Vec::new();

    // Priority 1: User Global Skills (~/.gemini/config/skills)
    let primary = home.join(".gemini").join("config").join("skills");
    if primary.is_dir() {
        roots.push(ScanRoot {
            path: primary,
            priority: 1,
            source_name: "global",
        });
    }

    // Priority 2: Custom Skills Plugin (~/.gemini/config/plugins/custom-skills/skills)
    let custom = home
        .join(".gemini")
        .join("config")
        .join("plugins")
        .join("custom-skills")
        .join("skills");
    if custom.is_dir() {
        roots.push(ScanRoot {
            path: custom,
            priority: 2,
            source_name: "custom-skills",
        });
    }

    // Priority 3: General Plugins (~/.gemini/config/plugins/*/skills)
    let plugins_dir = home.join(".gemini").join("config").join("plugins");
    if let Ok(entries) = fs::read_dir(&plugins_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if name != "custom-skills" {
                    let plugin_skills = path.join("skills");
                    if plugin_skills.is_dir() {
                        roots.push(ScanRoot {
                            path: plugin_skills,
                            priority: 3,
                            source_name: "plugins",
                        });
                    }
                }
            }
        }
    }

    roots
}

/// Alias for get_skill_scan_roots returning Paths.
pub fn get_skills_directories() -> Vec<PathBuf> {
    get_skill_scan_roots().into_iter().map(|r| r.path).collect()
}

/// Scans all local roots, parses frontmatters, deduplicates by id, and returns sorted SkillItems.
pub fn scan_installed_skills() -> Result<Vec<SkillItem>, String> {
    let roots = get_skill_scan_roots();
    let mut skills_map: HashMap<String, (SkillItem, u8)> = HashMap::new();

    for root in roots {
        let entries = match fs::read_dir(&root.path) {
            Ok(e) => e,
            Err(err) => {
                warn!("Unable to read skills directory {:?}: {}", root.path, err);
                continue;
            }
        };

        // Check if root itself has a direct SKILL.md (anomaly: android-cli-plugin/skills/SKILL.md)
        let root_skill = root.path.join("SKILL.md");
        let root_skill_disabled = root.path.join("SKILL.md.disabled");
        if root_skill.is_file() || root_skill_disabled.is_file() {
            let is_disabled = root_skill_disabled.is_file()
                || root.path.ends_with(".disabled")
                || root.path.join(".disabled").exists();
            let target_file = if root_skill.is_file() {
                root_skill
            } else {
                root_skill_disabled
            };
            let parent_name = root
                .path
                .parent()
                .and_then(|p| p.file_name())
                .and_then(|n| n.to_str())
                .unwrap_or("direct-skill");

            if let Ok(raw_bytes) = fs::read(&target_file) {
                let raw_content = String::from_utf8_lossy(&raw_bytes).to_string();
                let skill = parse_skill_markdown(
                    &raw_content,
                    parent_name,
                    &root.path,
                    !is_disabled,
                    root.source_name,
                );
                let id = skill.id.clone();
                skills_map.entry(id).or_insert((skill, root.priority));
            }
        }

        // Iterate subdirectories
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let dir_name = match path.file_name().and_then(|n| n.to_str()) {
                Some(name) => name,
                None => continue,
            };

            if dir_name.starts_with('.') {
                continue;
            }

            let skill_file = path.join("SKILL.md");
            let skill_file_disabled = path.join("SKILL.md.disabled");
            let target_file = if skill_file.is_file() {
                Some(skill_file)
            } else if skill_file_disabled.is_file() {
                Some(skill_file_disabled)
            } else {
                None
            };

            if let Some(file_path) = target_file {
                let id = dir_name.trim_end_matches(".disabled").to_string();

                // Priority check: lower numeric priority value wins (Priority 1 > Priority 2 > Priority 3)
                if let Some((_, existing_pri)) = skills_map.get(&id) {
                    if root.priority >= *existing_pri {
                        continue;
                    }
                }

                let is_dir_disabled = dir_name.ends_with(".disabled")
                    || file_path.ends_with("SKILL.md.disabled")
                    || path.join(".disabled").exists()
                    || root.path.to_string_lossy().contains(".disabled");

                match fs::read(&file_path) {
                    Ok(raw_bytes) => {
                        let raw_content = String::from_utf8_lossy(&raw_bytes).to_string();
                        let skill = parse_skill_markdown(
                            &raw_content,
                            dir_name,
                            &path,
                            !is_dir_disabled,
                            root.source_name,
                        );
                        skills_map.insert(id, (skill, root.priority));
                    }
                    Err(err) => {
                        warn!("Failed to read {:?}: {}", file_path, err);
                    }
                }
            }
        }
    }

    let mut result: Vec<SkillItem> = skills_map.into_values().map(|(item, _)| item).collect();
    result.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    info!("Successfully scanned {} local skills", result.len());
    Ok(result)
}

/// Public alias for scan_installed_skills.
pub fn scan_local_skills() -> Result<Vec<SkillItem>, String> {
    scan_installed_skills()
}

/// Safely reads the SKILL.md body with directory traversal check and Zero-Leak secret redaction.
pub fn read_skill_markdown(skill_id: &str, _is_local: bool) -> Result<String, String> {
    // 1. Sanitize skill_id against directory traversal
    if skill_id.is_empty()
        || skill_id.contains('/')
        || skill_id.contains('\\')
        || skill_id.contains("..")
        || skill_id.contains('\0')
    {
        return Err("Invalid skill ID: directory traversal detected".to_string());
    }

    let roots = get_skill_scan_roots();
    for root in roots {
        let candidate_dir = root.path.join(skill_id);
        let candidate_file = candidate_dir.join("SKILL.md");
        let candidate_disabled = candidate_dir.join("SKILL.md.disabled");

        let target_file = if candidate_file.is_file() {
            Some(candidate_file)
        } else if candidate_disabled.is_file() {
            Some(candidate_disabled)
        } else {
            None
        };

        if let Some(path) = target_file {
            return ReadBoundaryFence::read_skill_file(&path);
        }

        // Direct root check if skill_id matches root's parent plugin
        let direct_skill = root.path.join("SKILL.md");
        if direct_skill.is_file() {
            if let Some(parent_name) = root.path.parent().and_then(|p| p.file_name()).and_then(|n| n.to_str()) {
                if parent_name == skill_id {
                    return ReadBoundaryFence::read_skill_file(&direct_skill);
                }
            }
        }
    }

    Err(format!("Skill '{}' not found in local directories", skill_id))
}

/// Public alias for read_skill_markdown.
pub fn read_skill_content_safe(skill_id: &str, _install_path: Option<&str>) -> Result<String, String> {
    read_skill_markdown(skill_id, true)
}

/// Physically installs a skill to ~/.gemini/config/skills/<clean_name>/SKILL.md with atomic staging,
/// upstream live downloading via reqwest, multi-file companion support, and offline fallback.
pub async fn install_skill_physical(skill: &SkillItem) -> Result<String, String> {
    let home = dirs::home_dir().ok_or_else(|| "Could not resolve user home directory".to_string())?;
    let primary = home.join(".gemini").join("config").join("skills");
    if !primary.exists() {
        fs::create_dir_all(&primary).map_err(|e| format!("Failed to create skills root directory: {}", e))?;
    }

    // Determine clean directory name
    let raw_name = if !skill.name.is_empty() {
        &skill.name
    } else {
        skill.id.rsplit('/').next().unwrap_or(&skill.id)
    };

    let clean_name = raw_name
        .replace('/', "-")
        .replace('\\', "-")
        .replace("..", "")
        .replace('\0', "")
        .trim()
        .to_string();

    if clean_name.is_empty() {
        return Err("Invalid skill name for installation".to_string());
    }

    let target_dir = primary.join(&clean_name);
    // Security check: ensure target_dir is strictly inside primary
    if !target_dir.starts_with(&primary) {
        return Err("Path traversal detected in target directory".to_string());
    }

    // Step 1: Create isolated temporary staging directory
    let stage_uuid = uuid::Uuid::new_v4().to_string();
    let staging_dir = primary.join(format!(".tmp_{}_{}", clean_name, &stage_uuid[..8]));
    if staging_dir.exists() {
        let _ = fs::remove_dir_all(&staging_dir);
    }
    fs::create_dir_all(&staging_dir)
        .map_err(|e| format!("Failed to create staging directory: {}", e))?;

    let mut cleanup_staging = true;

    let execution_result: Result<String, String> = async {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(8))
            .user_agent("Antigravity-Shield/6.0")
            .build()
            .map_err(|e| format!("HTTP client build failed: {}", e))?;

        let mut manifest_content: Option<String> = None;
        let is_live = skill.is_upstream_live.unwrap_or(false);

        // Try downloading live from upstream if configured
        if is_live {
            if let Some(ref url) = skill.raw_manifest_url {
                info!("Attempting live manifest fetch from: {}", url);
                match http_client.get(url).send().await {
                    Ok(resp) if resp.status().is_success() => {
                        match resp.text().await {
                            Ok(text) => {
                                info!("Successfully fetched live manifest from {} ({} bytes)", url, text.len());
                                manifest_content = Some(text);
                            }
                            Err(e) => {
                                warn!("Failed to decode response text from {}: {}", url, e);
                            }
                        }
                    }
                    Ok(resp) => {
                        warn!("Upstream fetch from {} returned HTTP {}", url, resp.status());
                    }
                    Err(e) => {
                        warn!("Network fetch error from {}: {}", url, e);
                    }
                }
            }
        }

        // Resilient Offline Fallback: If live fetch failed or skill is local/synthetic, compose canonical content
        let content_to_write = if let Some(live_text) = manifest_content {
            if validate_skill_frontmatter(&live_text).is_ok() {
                live_text
            } else {
                let clean_desc = skill.description.replace('\r', "").replace('\n', " ");
                let triggers_str = skill.triggers.join(", ");
                format!(
                    "---\nname: {}\ndescription: {}\ncategory: {}\nversion: {}\ntriggers: [{}]\n---\n\n{}",
                    clean_name, clean_desc, skill.category, skill.version, triggers_str, live_text.trim()
                )
            }
        } else if let Some(ref c) = skill.content {
            let trimmed = c.trim();
            if trimmed.starts_with("---") && validate_skill_frontmatter(trimmed).is_ok() {
                trimmed.to_string()
            } else {
                let clean_desc = skill.description.replace('\r', "").replace('\n', " ");
                let triggers_str = skill.triggers.join(", ");
                format!(
                    "---\nname: {}\ndescription: {}\ncategory: {}\nversion: {}\ntriggers: [{}]\n---\n\n{}",
                    clean_name, clean_desc, skill.category, skill.version, triggers_str, trimmed
                )
            }
        } else {
            generate_canonical_skill_md(skill, &clean_name)
        };

        // Write primary SKILL.md in staging
        let staging_skill_file = staging_dir.join("SKILL.md");
        fs::write(&staging_skill_file, content_to_write.as_bytes())
            .map_err(|e| format!("Failed to write SKILL.md in staging: {}", e))?;

        // Strict YAML Frontmatter Validation Gate
        validate_skill_frontmatter(&content_to_write)
            .map_err(|e| format!("Staged SKILL.md failed frontmatter validation: {}", e))?;

        // Multi-File Companion Downloads
        if is_live && !skill.companion_files.is_empty() {
            if let Some(ref raw_manifest_url) = skill.raw_manifest_url {
                let base_url = raw_manifest_url.trim_end_matches("/SKILL.md");
                for companion_rel in &skill.companion_files {
                    let clean_rel = companion_rel.trim().trim_start_matches('/').replace('\\', "/");
                    if clean_rel.contains("..") || clean_rel.is_empty() {
                        continue;
                    }

                    let companion_url = format!("{}/{}", base_url, clean_rel);
                    info!("Fetching companion file from {}", companion_url);

                    let dest_file = staging_dir.join(&clean_rel);
                    if !dest_file.starts_with(&staging_dir) {
                        continue;
                    }
                    if let Some(parent) = dest_file.parent() {
                        let _ = fs::create_dir_all(parent);
                    }

                    match http_client.get(&companion_url).send().await {
                        Ok(c_resp) if c_resp.status().is_success() => {
                            if let Ok(c_bytes) = c_resp.bytes().await {
                                let _ = fs::write(&dest_file, &c_bytes);
                                info!("Saved companion file to {:?} ({} bytes)", dest_file, c_bytes.len());
                            }
                        }
                        Ok(c_resp) => {
                            warn!("Companion fetch {} returned HTTP {}", companion_url, c_resp.status());
                        }
                        Err(c_err) => {
                            warn!("Companion fetch error {}: {}", companion_url, c_err);
                        }
                    }
                }
            }
        }

        // Two-phase directory promotion on Windows (safe swap)
        let backup_dir = primary.join(format!(".backup_{}_{}", clean_name, &stage_uuid[..8]));
        if target_dir.exists() {
            fs::rename(&target_dir, &backup_dir)
                .map_err(|e| format!("Failed to create backup of existing directory: {}", e))?;
        }

        match fs::rename(&staging_dir, &target_dir) {
            Ok(_) => {
                cleanup_staging = false;
                if backup_dir.exists() {
                    let _ = fs::remove_dir_all(&backup_dir);
                }
                let installed_file = target_dir.join("SKILL.md");
                info!("Successfully atomically installed skill '{}' to {:?}", clean_name, installed_file);
                Ok(installed_file.to_string_lossy().to_string())
            }
            Err(rename_err) => {
                // Rollback from backup if rename failed
                if backup_dir.exists() {
                    let _ = fs::rename(&backup_dir, &target_dir);
                }
                Err(format!("Atomic directory promotion failed: {}", rename_err))
            }
        }
    }.await;

    if cleanup_staging && staging_dir.exists() {
        let _ = fs::remove_dir_all(&staging_dir);
    }

    execution_result
}

/// Physically uninstalls a skill by removing ~/.gemini/config/skills/<clean_name>
pub fn uninstall_skill_physical(skill_id: &str) -> Result<(), String> {
    let home = dirs::home_dir().ok_or_else(|| "Could not resolve user home directory".to_string())?;
    let primary = home.join(".gemini").join("config").join("skills");

    let raw_name = skill_id.rsplit('/').next().unwrap_or(skill_id);
    let clean_name = raw_name
        .replace('/', "-")
        .replace('\\', "-")
        .replace("..", "")
        .replace('\0', "")
        .trim()
        .to_string();

    if clean_name.is_empty() {
        return Err("Invalid skill ID for uninstallation".to_string());
    }

    let target_dir = primary.join(&clean_name);
    if !target_dir.starts_with(&primary) {
        return Err("Path traversal detected in uninstallation path".to_string());
    }

    if target_dir.is_dir() {
        fs::remove_dir_all(&target_dir).map_err(|e| format!("Failed to remove skill directory: {}", e))?;
        info!("Successfully removed skill directory {:?}", target_dir);
    }
    let target_dir_disabled = primary.join(format!("{}.disabled", clean_name));
    if target_dir_disabled.is_dir() {
        let _ = fs::remove_dir_all(&target_dir_disabled);
    }

    Ok(())
}

/// Physically toggles a skill enabled/disabled by renaming SKILL.md <-> SKILL.md.disabled
pub fn toggle_skill_physical(skill_id: &str, enabled: bool) -> Result<(), String> {
    let roots = get_skill_scan_roots();
    let raw_name = skill_id.rsplit('/').next().unwrap_or(skill_id);
    let clean_name = raw_name
        .replace('/', "-")
        .replace('\\', "-")
        .replace("..", "")
        .replace('\0', "")
        .trim()
        .to_string();

    if clean_name.is_empty() {
        return Err("Invalid skill ID for status toggle".to_string());
    }

    // Search across roots for the skill directory
    for root in roots {
        let candidate_active = root.path.join(&clean_name);
        let candidate_disabled = root.path.join(format!("{}.disabled", clean_name));

        // 1. If active directory exists
        if candidate_active.is_dir() {
            let skill_file = candidate_active.join("SKILL.md");
            let skill_file_disabled = candidate_active.join("SKILL.md.disabled");

            if !enabled {
                if skill_file.is_file() {
                    let _ = fs::rename(&skill_file, &skill_file_disabled);
                    info!("Disabled skill '{}' by renaming SKILL.md -> SKILL.md.disabled", clean_name);
                    return Ok(());
                }
            } else {
                if skill_file_disabled.is_file() {
                    let _ = fs::rename(&skill_file_disabled, &skill_file);
                    info!("Enabled skill '{}' by renaming SKILL.md.disabled -> SKILL.md", clean_name);
                    return Ok(());
                }
            }
        }

        // 2. If directory itself was renamed with .disabled
        if candidate_disabled.is_dir() {
            if enabled {
                let _ = fs::rename(&candidate_disabled, &candidate_active);
                let skill_file = candidate_active.join("SKILL.md");
                let skill_file_disabled = candidate_active.join("SKILL.md.disabled");
                if skill_file_disabled.is_file() && !skill_file.is_file() {
                    let _ = fs::rename(&skill_file_disabled, &skill_file);
                }
                info!("Enabled skill '{}' by restoring directory name", clean_name);
                return Ok(());
            }
        }
    }

    Ok(())
}

fn generate_canonical_skill_md(skill: &SkillItem, clean_name: &str) -> String {
    let triggers_str = skill.triggers.join(", ");
    format!(
        "---\nname: {}\ndescription: {}\ncategory: {}\nversion: {}\ntriggers: [{}]\n---\n\n# {}\n\n{}\n",
        clean_name,
        skill.description,
        skill.category,
        skill.version,
        triggers_str,
        skill.title,
        skill.description
    )
}

// ============================================================================
// UNIT TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_frontmatter_double_delimiter() {
        let sample = "---\n\n---\nname: core-web-vitals\ndescription: Optimize Core Web Vitals\n---\n\n# Core Web Vitals optimization\n";
        let (lines, body) = split_frontmatter(sample);
        assert!(!lines.is_empty());
        let meta = parse_frontmatter_lines(&lines);
        assert_eq!(meta.name.as_deref(), Some("core-web-vitals"));
        assert_eq!(meta.description.as_deref(), Some("Optimize Core Web Vitals"));
        let title = extract_title(body, "core-web-vitals");
        assert_eq!(title, "Core Web Vitals optimization");
    }

    #[test]
    fn test_frontmatter_folded_scalar() {
        let sample = "---\nname: ponytail\ndescription: >\n  Lazy senior dev mode: the smallest change that fully solves the task, and a\n  reply a busy human understands in one read.\nargument-hint: \"[lite|full|ultra]\"\n---\n\n# Ponytail\n";
        let (lines, body) = split_frontmatter(sample);
        let meta = parse_frontmatter_lines(&lines);
        assert_eq!(meta.name.as_deref(), Some("ponytail"));
        assert_eq!(
            meta.description.as_deref(),
            Some("Lazy senior dev mode: the smallest change that fully solves the task, and a reply a busy human understands in one read.")
        );
        assert_eq!(meta.argument_hint.as_deref(), Some("[lite|full|ultra]"));
        let title = extract_title(body, "ponytail");
        assert_eq!(title, "Ponytail");
    }

    #[test]
    fn test_frontmatter_chomped_scalar() {
        let sample = "---\nname: credentials\ndescription: >-\n  Instructions for handling API keys safely,\n  verifying their presence.\n---\n\n# Safe Credentials Protocol\n";
        let (lines, body) = split_frontmatter(sample);
        let meta = parse_frontmatter_lines(&lines);
        assert_eq!(meta.name.as_deref(), Some("credentials"));
        assert_eq!(
            meta.description.as_deref(),
            Some("Instructions for handling API keys safely, verifying their presence.")
        );
        let title = extract_title(body, "credentials");
        assert_eq!(title, "Safe Credentials Protocol");
    }

    #[test]
    fn test_frontmatter_persian_utf8() {
        let sample = "---\nname: medical-biostatistics\ndescription: تحلیل آماری داده‌های پزشکی و زیستی با SPSS و پایتون\n---\n\n# مهارت تخصصی آمار زیستی (Medical Biostatistics)\n";
        let (lines, body) = split_frontmatter(sample);
        let meta = parse_frontmatter_lines(&lines);
        assert_eq!(meta.name.as_deref(), Some("medical-biostatistics"));
        assert_eq!(
            meta.description.as_deref(),
            Some("تحلیل آماری داده‌های پزشکی و زیستی با SPSS و پایتون")
        );
        let title = extract_title(body, "medical-biostatistics");
        assert_eq!(title, "مهارت تخصصی آمار زیستی (Medical Biostatistics)");
    }

    #[test]
    fn test_frontmatter_quoted_strings() {
        let sample = "---\nname: ui-ux-pro-max\ndescription: \"Comprehensive design guide for web and mobile applications.\"\nauthor: 'Design Team'\n---\n\n# UI/UX Pro Max\n";
        let (lines, _) = split_frontmatter(sample);
        let meta = parse_frontmatter_lines(&lines);
        assert_eq!(meta.name.as_deref(), Some("ui-ux-pro-max"));
        assert_eq!(
            meta.description.as_deref(),
            Some("Comprehensive design guide for web and mobile applications.")
        );
        assert_eq!(meta.author.as_deref(), Some("Design Team"));
    }

    #[test]
    fn test_zero_leak_redaction_secrets() {
        let sample = format!(
            r#"
            github: {}_{}
            fine_pat: github_pat_11AAAAAAA01234567890abcdefghijklmnopqrstuvwxyz_01234567890abcdefghijklmnopqrstuvwxyz_012
            anthropic: sk-ant-api03-abcdef1234567890abcdefghijklmnopqrstuvwxyz123456
            openai: sk-proj-abc123XYZ4567890_-abcdefghijklmnopqrstuvwxyz123456
            notion: {}_{}
            twenty_first: 21st_sk_302a891c9617509e17ecbe8f0d4d33c27037cd83b6e090e89c3be8ce6ffc8d27
            telegram: 123456789:ABCdefGHIjklMNOpqrSTUvwxYZ123456789
            google: AIzaSyD-1234567890abcdefghijklmnopqrstuvw
            aws: AKIAIOSFODNN7EXAMPLE
            exa: EXA_API_KEY = "c9080270-7db2-43cf-bf5e-80c00fff2133"
            db_pass: db_password = "SuperSecretP@ssw0rd!123"
            header: "Bearer token1234567890abcdef"
        "#,
            "ghp", "QBWMCXkUWGTEMx58iyAIkiWLN7LDFX2yzSf0",
            "ntn", "523038876136rJUIjKcfU4xvJgbCB1y7OBrihTM5QJ66jL"
        );

        let redacted = ZeroLeakRedactor::redact(&sample);

        assert!(!redacted.contains("ghp_QBW"));
        assert!(!redacted.contains("github_pat_"));
        assert!(!redacted.contains("sk-ant-"));
        assert!(!redacted.contains("sk-proj-"));
        assert!(!redacted.contains("ntn_523"));
        assert!(!redacted.contains("21st_sk_"));
        assert!(!redacted.contains("123456789:ABC"));
        assert!(!redacted.contains("AIzaSyD-"));
        assert!(!redacted.contains("AKIAIOS"));
        assert!(!redacted.contains("c9080270-"));
        assert!(!redacted.contains("SuperSecretP@ssw0rd"));
        assert!(!redacted.contains("token1234567890abcdef"));

        assert!(redacted.contains("[REDACTED_GITHUB_TOKEN]"));
        assert!(redacted.contains("[REDACTED_ANTHROPIC_KEY]"));
        assert!(redacted.contains("[REDACTED_OPENAI_KEY]"));
        assert!(redacted.contains("[REDACTED_NOTION_TOKEN]"));
        assert!(redacted.contains("[REDACTED_21ST_KEY]"));
        assert!(redacted.contains("[REDACTED_GOOGLE_API_KEY]"));
        assert!(redacted.contains("[REDACTED_AWS_KEY]"));
    }

    #[test]
    fn test_path_normalization() {
        let win_path = r"C:\Users\ersha\.gemini\config\skills\apple-design\SKILL.md";
        let norm = ZeroLeakRedactor::normalize_path(win_path);
        assert!(!norm.to_lowercase().contains("ersha"));
        assert_eq!(norm, "~/.gemini/config/skills/apple-design/SKILL.md");

        let unix_path = "/home/ersha/.gemini/config/skills/ponytail/SKILL.md";
        let norm_unix = ZeroLeakRedactor::normalize_path(unix_path);
        assert_eq!(norm_unix, "~/.gemini/config/skills/ponytail/SKILL.md");
    }

    #[test]
    fn test_read_boundary_fence_enforcement() {
        assert!(ReadBoundaryFence::validate_read_path(&PathBuf::from(r"C:\skills\test\SKILL.md")).is_ok());
        assert!(ReadBoundaryFence::validate_read_path(&PathBuf::from(r"C:\skills\test\SKILL.md.disabled")).is_ok());
        assert!(ReadBoundaryFence::validate_read_path(&PathBuf::from(r"C:\plugins\test\plugin.json")).is_ok());

        assert!(ReadBoundaryFence::validate_read_path(&PathBuf::from(r"C:\skills\test\.env")).is_err());
        assert!(ReadBoundaryFence::validate_read_path(&PathBuf::from(r"C:\skills\test\.credentials")).is_err());
        assert!(ReadBoundaryFence::validate_read_path(&PathBuf::from(r"C:\skills\test\mcp_config.json")).is_err());
        assert!(ReadBoundaryFence::validate_read_path(&PathBuf::from(r"C:\skills\test\id_rsa")).is_err());
        assert!(ReadBoundaryFence::validate_read_path(&PathBuf::from(r"C:\skills\test\cert.pem")).is_err());
        assert!(ReadBoundaryFence::validate_read_path(&PathBuf::from(r"C:\skills\test\script.py")).is_err());
        assert!(ReadBoundaryFence::validate_read_path(&PathBuf::from(r"C:\skills\test\..\..\secrets.txt")).is_err());
    }

    #[test]
    fn test_local_confinement_invariant() {
        let local_skill = SkillItem {
            id: "local-secret-skill".to_string(),
            name: "local-secret-skill".to_string(),
            title: "Private Skill".to_string(),
            description: "Internal company prompt".to_string(),
            category: "coding".to_string(),
            author: "Internal".to_string(),
            repo: None,
            version: "1.0.0".to_string(),
            icon: None,
            triggers: vec![],
            tags: vec![],
            scope: "global".to_string(),
            is_installed: true,
            is_enabled: true,
            is_local: true,
            is_official: None,
            installs: None,
            local_path: Some("~/.gemini/config/skills/local-secret-skill".to_string()),
            install_path: Some("~/.gemini/config/skills/local-secret-skill".to_string()),
            content: None,
            source_url: None,
            dependencies: vec![],
            source_type: "local".to_string(),
            ..Default::default()
        };

        assert!(LocalConfinementGuard::assert_can_transmit(&local_skill).is_err());
        let outbound = LocalConfinementGuard::filter_outbound(&[local_skill]);
        assert_eq!(outbound.len(), 0);
    }

    #[test]
    fn test_zero_leak_multiline_and_database_uri() {
        // Multiline header comment
        let text = "# DB Password:\ndb_password = \"MySecretP@ssw0rd!\"\n";
        let redacted = ZeroLeakRedactor::redact(text);
        assert!(!redacted.contains("MySecretP@ssw0rd!"));
        assert!(redacted.contains("db_password: \"[REDACTED_SECRET]\""));

        // Database URI
        let db_url = "DATABASE_URL = \"postgres://postgres:SuperSecretP@ssw0rd!123@localhost:5432/mydb\"\n";
        let redacted_url = ZeroLeakRedactor::redact(db_url);
        assert!(!redacted_url.contains("SuperSecretP@ssw0rd!123"));
        assert!(redacted_url.contains("postgres://postgres:[REDACTED_PASSWORD]@localhost:5432/mydb"));

        // Preserving specific token classification (e.g. Exa key not overwritten by generic secret)
        let exa_line = "exa_api_key = \"c9080270-7db2-43cf-bf5e-80c00fff2133\"";
        let redacted_exa = ZeroLeakRedactor::redact(exa_line);
        assert!(redacted_exa.contains("[REDACTED_EXA_KEY]"));
        assert!(!redacted_exa.contains("[REDACTED_SECRET]"));
    }

    #[test]
    fn test_category_inference() {
        assert_eq!(infer_category("medical-biostatistics", "تحلیل آماری داده‌های پزشکی", &PathBuf::from("custom-skills"), None), "science");
        assert_eq!(infer_category("gsap-scrolltrigger", "Web animation with ScrollTrigger", &PathBuf::from("skills"), None), "design");
        assert_eq!(infer_category("postgres-best-practices", "Supabase database indexing", &PathBuf::from("custom-skills"), None), "data");
        assert_eq!(infer_category("telegram-bot-builder", "Automate workflows with bot", &PathBuf::from("custom-skills"), None), "automation");
        assert_eq!(infer_category("backend-architect", "Scale microservices and APIs", &PathBuf::from("custom-skills"), None), "coding");
        assert_eq!(infer_category("backend-architect", "Scale microservices and APIs", &PathBuf::from("custom-skills"), Some("architecture")), "architecture");
        assert_eq!(infer_category("system-design", "Enterprise architecture patterns", &PathBuf::from("skills"), Some("Architecture")), "architecture");
    }

    #[test]
    fn test_validate_skill_frontmatter_valid() {
        let valid_sample = "---\nname: find-skills\ndescription: Discover and install AI agent skills\n---\n\n# Find Skills\n";
        let res = validate_skill_frontmatter(valid_sample);
        assert!(res.is_ok());
        let parsed = res.unwrap();
        assert_eq!(parsed.name.as_deref(), Some("find-skills"));
        assert_eq!(parsed.description.as_deref(), Some("Discover and install AI agent skills"));
    }

    #[test]
    fn test_validate_skill_frontmatter_missing_delimiter() {
        let invalid = "name: find-skills\ndescription: Missing delimiter\n";
        let res = validate_skill_frontmatter(invalid);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Missing YAML frontmatter delimiters"));
    }

    #[test]
    fn test_validate_skill_frontmatter_missing_closing_delimiter() {
        let invalid = "---\nname: find-skills\ndescription: Missing closing delimiter\n\n# Body";
        let res = validate_skill_frontmatter(invalid);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Missing YAML frontmatter delimiters"));
    }

    #[test]
    fn test_validate_skill_frontmatter_missing_name() {
        let invalid = "---\ndescription: Missing name field\n---\n";
        let res = validate_skill_frontmatter(invalid);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("missing required 'name' field"));
    }

    #[test]
    fn test_validate_skill_frontmatter_missing_description() {
        let invalid = "---\nname: only-name\n---\n";
        let res = validate_skill_frontmatter(invalid);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("missing required 'description' field"));
    }
}
