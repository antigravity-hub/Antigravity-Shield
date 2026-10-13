use crate::modules::skills::{self, SkillItem};

/// Scan and return all locally installed skills with Zero-Leak sanitization.
#[tauri::command]
pub async fn list_installed_skills() -> Result<Vec<SkillItem>, String> {
    tokio::task::spawn_blocking(skills::scan_installed_skills)
        .await
        .map_err(|e| format!("Skills scanner task failed: {}", e))?
}

/// Safely read SKILL.md markdown content with directory traversal guard and Zero-Leak secret redaction.
#[tauri::command]
pub async fn read_skill_content(
    skill_id: String,
    is_local: Option<bool>,
) -> Result<String, String> {
    let local = is_local.unwrap_or(true);
    tokio::task::spawn_blocking(move || {
        skills::read_skill_markdown(&skill_id, local)
    })
    .await
    .map_err(|e| format!("Skill read task failed: {}", e))?
}
