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

/// Physically installs a skill to ~/.gemini/config/skills/<name>/SKILL.md
#[tauri::command]
pub async fn install_skill(skill: SkillItem) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        skills::install_skill_physical(&skill)
    })
    .await
    .map_err(|e| format!("Install skill task failed: {}", e))?
}

/// Physically uninstalls a skill from ~/.gemini/config/skills/<name>
#[tauri::command]
pub async fn uninstall_skill(skill_id: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        skills::uninstall_skill_physical(&skill_id)
    })
    .await
    .map_err(|e| format!("Uninstall skill task failed: {}", e))?
}

/// Physically toggles a skill status (enabled/disabled)
#[tauri::command]
pub async fn toggle_skill_status(skill_id: String, enabled: bool) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        skills::toggle_skill_physical(&skill_id, enabled)
    })
    .await
    .map_err(|e| format!("Toggle skill task failed: {}", e))?
}
