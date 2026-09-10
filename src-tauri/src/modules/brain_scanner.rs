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

fn get_gemini_antigravity_envs() -> Vec<PathBuf> {
    let home = dirs::home_dir()
        .or_else(|| std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")).ok().map(PathBuf::from));
    let Some(home_path) = home else { return Vec::new(); };
    let gemini_dir = home_path.join(".gemini");
    if !gemini_dir.exists() { return Vec::new(); }

    let mut envs = Vec::new();
    if let Ok(entries) = fs::read_dir(&gemini_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("antigravity") && entry.path().is_dir() {
                envs.push(entry.path());
            }
        }
    }
    envs
}

fn extract_model_from_blob(data: &[u8]) -> Option<String> {
    // 1. Check Protobuf tag 19 (0x9a 0x01) - Google Antigravity standard model field
    if let Some(pos) = data.windows(2).rposition(|w| w == [0x9a, 0x01]) {
        if pos + 2 < data.len() {
            let len = data[pos + 2] as usize;
            if pos + 3 + len <= data.len() {
                if let Ok(s) = std::str::from_utf8(&data[pos + 3..pos + 3 + len]) {
                    if s.len() >= 3 && s.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '.' || c == '_') {
                        return Some(s.to_string());
                    }
                }
            }
        }
    }
    // 2. Vendor-agnostic regex fallback for any model name
    if let Ok(re) = Regex::new(r"(?i)(?:gemini|claude|gpt|o1|o3|o4|deepseek|llama|qwen|mistral|codestral)-[a-zA-Z0-9\.\-]+") {
        let text = String::from_utf8_lossy(data);
        if let Some(m) = re.find_iter(&text).last() {
            return Some(m.as_str().to_string());
        }
    }
    None
}

fn get_conversation_metadata(env_dir: &PathBuf, conversation_id: &str) -> (String, String) {
    let mut model = "gemini-auto".to_string();
    let mut platform = if env_dir.to_string_lossy().contains("ide") {
        "Antigravity IDE".to_string()
    } else if env_dir.to_string_lossy().contains("cli") || env_dir.to_string_lossy().contains("agy") {
        "Antigravity CLI".to_string()
    } else {
        "Antigravity Platform".to_string()
    };

    let db_path = env_dir.join("conversations").join(format!("{}.db", conversation_id));
    if db_path.exists() {
        if let Ok(conn) = Connection::open_with_flags(&db_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY) {
            // Extract platform from executor_metadata
            if let Ok(data) = conn.query_row("SELECT data FROM executor_metadata LIMIT 1", [], |r| r.get::<_, Vec<u8>>(0)) {
                let data_lossy = String::from_utf8_lossy(&data);
                if data_lossy.contains("As IDE feedback") || data_lossy.contains("antigravity-ide") {
                    platform = "Antigravity IDE".to_string();
                }
            }
            // Extract model from gen_metadata
            if let Ok(data) = conn.query_row("SELECT data FROM gen_metadata ORDER BY idx DESC LIMIT 1", [], |r| r.get::<_, Vec<u8>>(0)) {
                if let Some(m) = extract_model_from_blob(&data) {
                    model = m;
                }
            }
        }
    }

    (model, platform)
}

pub fn scan_brain_conversations() -> Result<BrainScanResult, String> {
    let env_dirs = get_gemini_antigravity_envs();
    let mut result = BrainScanResult {
        conversations_found: 0,
        conversations_scanned: 0,
        conversations_skipped: 0,
        total_new_tokens: 0,
        errors: Vec::new(),
    };

    if env_dirs.is_empty() {
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

    let account_email = match crate::modules::account::get_current_account() {
        Ok(Some(acc)) => acc.email,
        _ => "ershad.zolfi@gmail.com".to_string(),
    };

    for env_dir in env_dirs {
        let brain_dir = env_dir.join("brain");
        if !brain_dir.exists() {
            continue;
        }

        let entries = match fs::read_dir(&brain_dir) {
            Ok(e) => e,
            Err(e) => {
                result.errors.push(format!("Failed to read brain dir: {}", e));
                continue;
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

            // Prefer transcript_full.jsonl for complete, untruncated tokens
            let full_transcript = entry.path().join(".system_generated").join("logs").join("transcript_full.jsonl");
            let std_transcript = entry.path().join(".system_generated").join("logs").join("transcript.jsonl");
            let transcript_path = if full_transcript.exists() {
                full_transcript
            } else if std_transcript.exists() {
                std_transcript
            } else {
                continue;
            };

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
            let mut new_in_tokens = 0u64;
            let mut new_out_tokens = 0u64;
            let mut lines_processed = 0;

            for line in reader.lines().flatten() {
                line_count += 1;
                if line_count <= last_offset {
                    continue;
                }
                lines_processed += 1;

                if let Ok(json) = serde_json::from_str::<Value>(&line) {
                    let stype = json.get("type").and_then(|v| v.as_str());
                    let source = json.get("source").and_then(|v| v.as_str());

                    let mut in_t = 0u64;
                    let mut out_t = 0u64;

                    if let Some(usage) = json.get("usage") {
                        in_t = usage.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                        out_t = usage.get("output_tokens").or(usage.get("total_tokens")).and_then(|v| v.as_u64()).unwrap_or(0);
                    }

                    if stype == Some("USER_INPUT") || stype == Some("USER_EXPLICIT") || source == Some("USER") {
                        if in_t == 0 {
                            let content_len = json.get("content").and_then(|v| v.as_str()).map(|s| s.len()).unwrap_or(0);
                            in_t = (content_len as f64 / 3.8).ceil() as u64;
                        }
                        new_in_tokens += in_t.max(1);
                    } else if stype == Some("GENERIC") {
                        // Tool outputs are part of model input
                        let content_len = json.get("content").and_then(|v| v.as_str()).map(|s| s.len()).unwrap_or(0);
                        let tool_in = (content_len as f64 / 3.8).ceil() as u64;
                        new_in_tokens += tool_in.max(1);
                    } else if stype == Some("PLANNER_RESPONSE") || source == Some("MODEL") {
                        if out_t == 0 {
                            let content_len = json.get("content").and_then(|v| v.as_str()).map(|s| s.len()).unwrap_or(0);
                            let thinking_len = json.get("thinking").and_then(|v| v.as_str()).map(|s| s.len()).unwrap_or(0);
                            let tc_len = json.get("tool_calls").and_then(|v| v.as_array())
                                .map(|arr| arr.iter().map(|tc| serde_json::to_string(tc).unwrap_or_default().len()).sum::<usize>())
                                .unwrap_or(0);
                            out_t = ((content_len + thinking_len + tc_len) as f64 / 3.8).ceil() as u64;
                        }
                        new_out_tokens += out_t.max(1);
                    }
                }
            }

            if lines_processed == 0 {
                result.conversations_skipped += 1;
            } else {
                result.conversations_scanned += 1;
                let new_tokens_for_conv = new_in_tokens + new_out_tokens;
                
                if new_tokens_for_conv > 0 {
                    let (model, platform) = get_conversation_metadata(&env_dir, &name);
                    let now = Utc::now().timestamp();

                    if let Err(e) = crate::modules::token_stats::record_usage_full(
                        &account_email,
                        &model,
                        new_in_tokens as u32,
                        new_out_tokens as u32,
                        0,
                        &platform,
                        Some(now),
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
