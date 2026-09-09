use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use regex::Regex;
use serde_json::Value;
use rusqlite::{params, Connection};
use chrono::Utc;
use tauri::Emitter;

#[derive(serde::Serialize, Clone, Debug)]
pub struct BrainScanResult {
    pub conversations_found: usize,
    pub conversations_scanned: usize,
    pub conversations_skipped: usize,
    pub total_new_tokens: u64,
    pub errors: Vec<String>,
}

fn get_brain_dir() -> Result<PathBuf, String> {
    if let Some(mut home) = dirs::home_dir() {
        home.push(".gemini");
        home.push("antigravity");
        home.push("brain");
        Ok(home)
    } else {
        let home_str = std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .map_err(|_| "Could not find home directory".to_string())?;
        let mut p = PathBuf::from(home_str);
        p.push(".gemini");
        p.push("antigravity");
        p.push("brain");
        Ok(p)
    }
}

pub fn scan_brain_conversations() -> Result<BrainScanResult, String> {
    let brain_dir = get_brain_dir()?;
    let mut result = BrainScanResult {
        conversations_found: 0,
        conversations_scanned: 0,
        conversations_skipped: 0,
        total_new_tokens: 0,
        errors: Vec::new(),
    };

    if !brain_dir.exists() {
        return Ok(result);
    }

    let db_path = crate::modules::token_stats::get_db_path()?;
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open DB: {}", e))?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS brain_scan_progress (
            conversation_id TEXT PRIMARY KEY,
            last_line_offset INTEGER NOT NULL DEFAULT 0,
            last_scan_timestamp INTEGER NOT NULL,
            total_tokens_found INTEGER NOT NULL DEFAULT 0
        )",
        [],
    ).map_err(|e| format!("Failed to create table: {}", e))?;

    let uuid_regex = Regex::new(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$").unwrap();

    let entries = match fs::read_dir(&brain_dir) {
        Ok(e) => e,
        Err(e) => {
            result.errors.push(format!("Failed to read brain dir: {}", e));
            return Ok(result);
        }
    };

    for entry in entries.flatten() {
        if let Ok(file_type) = entry.file_type() {
            if !file_type.is_dir() {
                continue;
            }
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if !uuid_regex.is_match(&name) {
            continue;
        }

        result.conversations_found += 1;
        let transcript_path = entry.path().join(".system_generated").join("logs").join("transcript.jsonl");
        if !transcript_path.exists() {
            continue;
        }

        let mut last_offset: usize = 0;
        let mut total_tokens: u64 = 0;
        if let Ok(mut stmt) = conn.prepare("SELECT last_line_offset, total_tokens_found FROM brain_scan_progress WHERE conversation_id = ?1") {
            if let Ok(mut rows) = stmt.query(params![name]) {
                if let Ok(Some(row)) = rows.next() {
                    let offset: i64 = row.get(0).unwrap_or(0);
                    last_offset = offset.max(0) as usize;
                    let tokens: i64 = row.get(1).unwrap_or(0);
                    total_tokens = tokens.max(0) as u64;
                }
            }
        }

        let file = match File::open(&transcript_path) {
            Ok(f) => f,
            Err(e) => {
                result.errors.push(format!("Failed to open {}: {}", name, e));
                continue;
            }
        };

        let reader = BufReader::new(file);
        let mut line_count = 0;
        let mut new_tokens_for_conv = 0;
        let mut lines_processed = 0;

        for line in reader.lines().flatten() {
            line_count += 1;
            if line_count <= last_offset {
                continue;
            }
            lines_processed += 1;

            if let Ok(json) = serde_json::from_str::<Value>(&line) {
                let is_planner = json.get("type").and_then(|v| v.as_str()) == Some("PLANNER_RESPONSE");
                let is_model = json.get("source").and_then(|v| v.as_str()) == Some("MODEL");
                
                let mut line_tokens = 0;

                if let Some(usage) = json.get("usage") {
                    line_tokens += usage.get("output_tokens").or(usage.get("total_tokens")).and_then(|v| v.as_u64()).unwrap_or(0);
                } else if let Some(tokens) = json.get("token_count") {
                    line_tokens += tokens.as_u64().unwrap_or(0);
                } else if let Some(tokens) = json.get("tokens") {
                    line_tokens += tokens.as_u64().unwrap_or(0);
                } else {
                    if let Some(content) = json.get("content").and_then(|v| v.as_str()) {
                        line_tokens += (content.len() / 4) as u64;
                    }
                    if let Some(tool_calls) = json.get("tool_calls").and_then(|v| v.as_array()) {
                        for tool_call in tool_calls {
                            let tc_str = serde_json::to_string(tool_call).unwrap_or_default();
                            line_tokens += (tc_str.len() / 4) as u64;
                        }
                    }
                }

                if line_tokens > 0 && (is_planner || is_model) {
                    new_tokens_for_conv += line_tokens;
                }
            }
        }

        if lines_processed == 0 {
            result.conversations_skipped += 1;
        } else {
            result.conversations_scanned += 1;
            
            if new_tokens_for_conv > 0 {
                // Determine target application: Antigravity IDE vs Antigravity CLI (agy)
                let target_label = match crate::modules::account::load_account_index() {
                    Ok(idx) => match idx.current_target_ide.as_deref() {
                        Some("agy") => "Antigravity CLI",
                        Some("ide") => "Antigravity IDE",
                        _ => "Antigravity IDE",
                    },
                    Err(_) => "Antigravity IDE",
                };

                let account_email = match crate::modules::account::get_current_account() {
                    Ok(Some(acc)) => acc.email,
                    _ => "antigravity-user".to_string(),
                };

                if let Err(e) = crate::modules::token_stats::record_usage(
                    &account_email,
                    target_label,
                    0,
                    new_tokens_for_conv as u32,
                    0,
                ) {
                     result.errors.push(format!("Failed to record usage for {}: {}", name, e));
                }
                result.total_new_tokens += new_tokens_for_conv;
                total_tokens += new_tokens_for_conv;
            }

            let now = Utc::now().timestamp();
            let _ = conn.execute(
                "INSERT INTO brain_scan_progress (conversation_id, last_line_offset, last_scan_timestamp, total_tokens_found) 
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(conversation_id) DO UPDATE SET 
                    last_line_offset = excluded.last_line_offset,
                    last_scan_timestamp = excluded.last_scan_timestamp,
                    total_tokens_found = excluded.total_tokens_found",
                params![name, line_count as i64, now, total_tokens as i64],
            );
        }
    }

    Ok(result)
}

/// Start background real-time watcher polling every 3s
pub fn start_live_watcher(app_handle: Option<tauri::AppHandle>) {
    tauri::async_runtime::spawn(async move {
        tracing::info!("[LiveBrainWatcher] Started background transcript monitor (3s cycle)...");
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;

            let scan_res = tokio::task::spawn_blocking(|| {
                scan_brain_conversations()
            }).await;

            if let Ok(Ok(res)) = scan_res {
                if res.total_new_tokens > 0 {
                    tracing::info!(
                        "[LiveBrainWatcher] 🚀 Live tokens captured: {} tokens across {} conversations",
                        res.total_new_tokens, res.conversations_scanned
                    );
                    if let Some(ref handle) = app_handle {
                        let _ = handle.emit("live_token_stats_update", &res);
                    }
                }
            }
        }
    });
}
