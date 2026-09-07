//! Structure Codex system/developer instructions for Gemini without rewriting them.
//!
//! This module only classifies existing Codex prompt blocks into Antigravity-like
//! XML sections. It must not summarize, reinterpret, or invent behavior rules.

#[derive(Debug, Default)]
struct ContextSections {
    identity: Vec<String>,
    user_information: Vec<String>,
    environment_permissions: Vec<String>,
    app_context: Vec<String>,
    customizations: Vec<String>,
    skills: Vec<String>,
    plugins: Vec<String>,
    memory: Vec<String>,
    planning_mode: Vec<String>,
    communication_style: Vec<String>,
}

pub fn build_official_style_system_instruction(
    system_instructions: &[String],
    proxy_identity: Option<&str>,
    global_prompt: Option<&str>,
    request_type: &str,
    mapped_model: &str,
    session_id: &str,
) -> String {
    let mut sections = ContextSections::default();

    sections.user_information.push(format!(
        "Request type: {}\nMapped model: {}\nSession ID: {}",
        request_type, mapped_model, session_id
    ));

    if let Some(prompt) = global_prompt.map(str::trim).filter(|s| !s.is_empty()) {
        sections.customizations.push(prompt.to_string());
    }

    for instruction in system_instructions {
        classify_instruction(instruction, &mut sections);
    }

    if sections.identity.is_empty()
        && sections.customizations.is_empty()
        && sections.environment_permissions.is_empty()
        && sections.skills.is_empty()
    {
        if let Some(identity) = proxy_identity.map(str::trim).filter(|s| !s.is_empty()) {
            sections.identity.push(identity.to_string());
        }
    }

    render_sections(sections)
}

fn classify_instruction(instruction: &str, sections: &mut ContextSections) {
    let mut remaining = strip_codex_step_markers(instruction);

    extract_tag_to_section(
        &mut remaining,
        "permissions instructions",
        &mut sections.environment_permissions,
    );
    extract_tag_to_section(&mut remaining, "app-context", &mut sections.app_context);
    extract_tag_to_section(
        &mut remaining,
        "collaboration_mode",
        &mut sections.planning_mode,
    );
    extract_tag_to_section(&mut remaining, "skills_instructions", &mut sections.skills);
    extract_tag_to_section(
        &mut remaining,
        "plugins_instructions",
        &mut sections.plugins,
    );

    if let Some(memory) = extract_memory_block(&mut remaining) {
        sections.memory.push(memory);
    }

    let remaining = collapse_blank_lines(&remaining);
    if remaining.trim().is_empty() {
        return;
    }

    if contains_identity(&remaining) {
        let (identity, communication) = split_identity_and_communication(&remaining);
        if !identity.trim().is_empty() {
            sections.identity.push(identity);
        }
        if let Some(communication) = communication {
            sections.communication_style.push(communication);
        }
    } else if looks_like_customization(&remaining) {
        sections.customizations.push(remaining);
    } else {
        sections.customizations.push(remaining);
    }
}

fn render_sections(sections: ContextSections) -> String {
    let mut out = String::new();

    append_section(&mut out, "identity", &join_dedup(sections.identity));
    append_section(
        &mut out,
        "user_information",
        &join_dedup(sections.user_information),
    );
    append_section(
        &mut out,
        "environment_permissions",
        &join_dedup(sections.environment_permissions),
    );
    append_section(&mut out, "app_context", &join_dedup(sections.app_context));
    append_section(
        &mut out,
        "customizations",
        &join_dedup(sections.customizations),
    );
    append_section(&mut out, "skills", &join_dedup(sections.skills));
    append_section(&mut out, "plugins", &join_dedup(sections.plugins));
    append_section(&mut out, "memory", &join_dedup(sections.memory));
    append_section(
        &mut out,
        "planning_mode",
        &join_dedup(sections.planning_mode),
    );
    append_section(
        &mut out,
        "communication_style",
        &join_dedup(sections.communication_style),
    );

    out
}

fn extract_tag_to_section(text: &mut String, tag: &str, target: &mut Vec<String>) {
    let mut extracted = Vec::new();
    let mut output = String::new();
    let mut rest = text.as_str();
    let start_tag = format!("<{}>", tag);
    let end_tag = format!("</{}>", tag);

    while let Some(start) = rest.find(&start_tag) {
        output.push_str(&rest[..start]);
        let after_start = &rest[start + start_tag.len()..];
        let Some(end) = after_start.find(&end_tag) else {
            output.push_str(after_start);
            *text = output;
            target.extend(extracted);
            return;
        };
        extracted.push(after_start[..end].trim().to_string());
        rest = &after_start[end + end_tag.len()..];
    }
    output.push_str(rest);

    *text = output;
    target.extend(extracted.into_iter().filter(|s| !s.trim().is_empty()));
}

fn extract_memory_block(text: &mut String) -> Option<String> {
    let start = text.find("## Memory")?;
    let memory = text[start..].trim().to_string();
    text.truncate(start);
    if memory.is_empty() {
        None
    } else {
        Some(memory)
    }
}

fn split_identity_and_communication(text: &str) -> (String, Option<String>) {
    for marker in [
        "# Working with the user",
        "## Formatting rules",
        "## Final answer instructions",
        "## Intermediary updates",
    ] {
        if let Some(index) = text.find(marker) {
            let identity = text[..index].trim().to_string();
            let communication = text[index..].trim().to_string();
            return (
                identity,
                if communication.is_empty() {
                    None
                } else {
                    Some(communication)
                },
            );
        }
    }

    (text.trim().to_string(), None)
}

fn contains_identity(text: &str) -> bool {
    text.contains("You are Codex")
        || text.contains("You are Antigravity")
        || text.contains("You are a search engine bot")
}

fn looks_like_customization(text: &str) -> bool {
    text.contains("AGENTS.md")
        || text.contains("<INSTRUCTIONS>")
        || text.contains("project-doc")
        || text.contains("# Repository Guidelines")
        || text.contains("customize")
        || text.contains("customization")
}

fn append_section(out: &mut String, tag: &str, content: &str) {
    let content = strip_codex_step_markers(content);
    let content = content.trim();
    if content.is_empty() {
        return;
    }
    if !out.is_empty() {
        out.push('\n');
    }
    out.push('<');
    out.push_str(tag);
    out.push_str(">\n");
    out.push_str(content);
    out.push_str("\n</");
    out.push_str(tag);
    out.push('>');
}

fn join_dedup(items: Vec<String>) -> String {
    let mut seen = std::collections::HashSet::new();
    let mut result = Vec::new();
    for item in items {
        let cleaned = collapse_blank_lines(&strip_codex_step_markers(&item));
        let cleaned = cleaned.trim();
        if cleaned.is_empty() {
            continue;
        }
        if seen.insert(cleaned.to_string()) {
            result.push(cleaned.to_string());
        }
    }
    result.join("\n\n")
}

fn strip_codex_step_markers(content: &str) -> String {
    content
        .lines()
        .filter(|line| {
            let trimmed = line.trim();
            !(trimmed.starts_with("[codex-turn:")
                && trimmed.contains(" step:")
                && trimmed.contains(" type:")
                && trimmed.ends_with(']'))
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn collapse_blank_lines(text: &str) -> String {
    let mut out = String::new();
    let mut blank_count = 0;
    for line in text.lines() {
        if line.trim().is_empty() {
            blank_count += 1;
            if blank_count <= 1 {
                out.push('\n');
            }
            continue;
        }
        blank_count = 0;
        out.push_str(line.trim_end());
        out.push('\n');
    }
    out.trim().to_string()
}
