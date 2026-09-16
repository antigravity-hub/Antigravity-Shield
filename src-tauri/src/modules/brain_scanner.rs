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

/// Safely decode an unsigned LEB128 varint from `data` at `offset`.
/// Returns `Some((value, bytes_read))` or `None` on overflow / EOF.
pub fn decode_varint(data: &[u8], mut offset: usize) -> Option<(usize, usize)> {
    let mut value: usize = 0;
    let mut shift: u32 = 0;
    let start = offset;
    while offset < data.len() {
        let byte = data[offset];
        offset += 1;
        value |= ((byte & 0x7F) as usize) << shift;
        if (byte & 0x80) == 0 {
            return Some((value, offset - start));
        }
        shift += 7;
        if shift >= usize::BITS {
            return None;
        }
    }
    None
}

/// Check if candidate string looks like a legitimate model name, not a file, path, or platform string
pub fn is_valid_model_candidate(s: &str) -> bool {
    let lower = s.trim().to_lowercase();
    if s.len() < 3 || s.len() > 80 {
        return false;
    }
    if crate::modules::token_stats::is_non_model_identifier(s) {
        return false;
    }
    if lower.contains("guide")
        || lower.contains(".md")
        || lower.contains(".txt")
        || lower.contains(".rs")
        || lower.contains(".ts")
        || lower.contains(".json")
        || lower.contains(".lock")
        || lower.contains("node_modules")
        || lower.contains('/')
        || lower.contains('\\')
    {
        return false;
    }

    // Must match legitimate AI model naming patterns
    lower.starts_with("gemini")
        || lower.starts_with("claude")
        || lower.starts_with("gpt")
        || lower.starts_with("o1")
        || lower.starts_with("o3")
        || lower.starts_with("deepseek")
        || lower.starts_with("qwen")
        || lower.starts_with("llama")
        || lower.starts_with("mistral")
        || lower.starts_with("glm")
        || lower.starts_with("g-")
        || lower.starts_with("c-")
}

pub fn extract_model_from_blob(data: &[u8]) -> Option<String> {
    // 1. Check Protobuf tag 19 wire type 2 (0x9a 0x01) - Google Antigravity standard model field
    let mut search_end = data.len();
    while let Some(rel_pos) = data[..search_end].windows(2).rposition(|w| w == [0x9a, 0x01]) {
        let pos = rel_pos;
        if pos + 2 < data.len() {
            if let Some((len, varint_len)) = decode_varint(data, pos + 2) {
                let str_start = pos + 2 + varint_len;
                if len >= 3 && len <= 128 && str_start + len <= data.len() {
                    if let Ok(s) = std::str::from_utf8(&data[str_start..str_start + len]) {
                        if is_valid_model_candidate(s) {
                            return Some(s.to_string());
                        }
                    }
                }
            }
        }
        if pos == 0 {
            break;
        }
        search_end = pos;
    }

    // 2. Vendor-agnostic fallback: Strict regex matching known AI model patterns only
    if let Ok(re) = Regex::new(
        r"(?i)\b(gemini-(?:[0-9]|pro|flash|auto|default|ultra|embedding)[a-zA-Z0-9\.\-_]*|claude-(?:3|4|opus|sonnet|haiku)[a-zA-Z0-9\.\-_]*|gpt-(?:4|3|oss)[a-zA-Z0-9\.\-_]*|o3-mini(?:-[a-zA-Z0-9\.\-]+)?|o1(?:-preview|-mini)?|deepseek-(?:r1|v3|chat|reasoner|coder)[a-zA-Z0-9\.\-_]*)\b"
    ) {
        let text = String::from_utf8_lossy(data);
        for m in re.find_iter(&text) {
            let s = m.as_str();
            if is_valid_model_candidate(s) {
                return Some(s.to_string());
            }
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
            // Extract model from gen_metadata: check up to 10 latest entries for the first valid model
            if let Ok(mut stmt) = conn.prepare("SELECT data FROM gen_metadata ORDER BY idx DESC LIMIT 10") {
                if let Ok(rows) = stmt.query_map([], |r| r.get::<_, Vec<u8>>(0)) {
                    for row in rows.flatten() {
                        if let Some(m) = extract_model_from_blob(&row) {
                            model = m;
                            break;
                        }
                    }
                }
            }
        }
    }

    // Never allow non-model or platform names to leak as model
    if crate::modules::token_stats::is_non_model_identifier(&model) {
        model = "gemini-auto".to_string();
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
            // Accumulate tokens grouped by hourly timestamp bucket
            let mut bucket_map: std::collections::BTreeMap<i64, (u64, u64, u64)> = std::collections::BTreeMap::new();
            let mut conversation_start_time: Option<i64> = None;
            let mut last_message_time: Option<i64> = None;

            for line in reader.lines().flatten() {
                line_count += 1;
                if line_count <= last_offset {
                    continue;
                }
                lines_processed += 1;

                if let Ok(json) = serde_json::from_str::<Value>(&line) {
                    let stype = json.get("type").and_then(|v| v.as_str());
                    let source = json.get("source").and_then(|v| v.as_str());

                    // Extract actual created_at timestamp if present
                    let msg_ts = json.get("created_at")
                        .and_then(|v| v.as_str())
                        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                        .map(|dt| dt.timestamp());

                    if let Some(ts) = msg_ts {
                        if conversation_start_time.is_none() {
                            conversation_start_time = Some(ts);
                        }
                        last_message_time = Some(ts);
                    }
                    let current_ts = msg_ts.or(last_message_time).unwrap_or_else(|| Utc::now().timestamp());
                    // Group to hourly timestamp
                    let bucket_ts = (current_ts / 3600) * 3600;

                    let mut in_t = 0u64;
                    let mut out_t = 0u64;
                    let mut cached_t = 0u64;

                    if let Some(usage) = json.get("usage") {
                        in_t = usage.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                        out_t = usage.get("output_tokens").or(usage.get("total_tokens")).and_then(|v| v.as_u64()).unwrap_or(0);
                        cached_t = usage.get("cache_read_input_tokens")
                            .or_else(|| usage.get("cached_tokens"))
                            .or_else(|| usage.get("cachedContentTokenCount"))
                            .and_then(|v| v.as_u64()).unwrap_or(0);
                    }

                    if stype == Some("USER_INPUT") || stype == Some("USER_EXPLICIT") || source == Some("USER") {
                        if in_t == 0 {
                            let content_len = json.get("content").and_then(|v| v.as_str()).map(|s| s.len()).unwrap_or(0);
                            in_t = (content_len as f64 / 3.8).ceil() as u64;
                        }
                        let in_val = in_t.max(1);
                        new_in_tokens += in_val;
                        let entry = bucket_map.entry(bucket_ts).or_insert((0, 0, 0));
                        entry.0 += in_val;
                        entry.2 += cached_t;
                    } else if stype == Some("GENERIC") {
                        // Tool outputs are part of model input
                        let content_len = json.get("content").and_then(|v| v.as_str()).map(|s| s.len()).unwrap_or(0);
                        let tool_in = (content_len as f64 / 3.8).ceil() as u64;
                        let tool_val = tool_in.max(1);
                        new_in_tokens += tool_val;
                        let entry = bucket_map.entry(bucket_ts).or_insert((0, 0, 0));
                        entry.0 += tool_val;
                        entry.2 += cached_t;
                    } else if stype == Some("PLANNER_RESPONSE") || source == Some("MODEL") {
                        if out_t == 0 {
                            let content_len = json.get("content").and_then(|v| v.as_str()).map(|s| s.len()).unwrap_or(0);
                            let thinking_len = json.get("thinking").and_then(|v| v.as_str()).map(|s| s.len()).unwrap_or(0);
                            let tc_len = json.get("tool_calls").and_then(|v| v.as_array())
                                .map(|arr| arr.iter().map(|tc| serde_json::to_string(tc).unwrap_or_default().len()).sum::<usize>())
                                .unwrap_or(0);
                            out_t = ((content_len + thinking_len + tc_len) as f64 / 3.8).ceil() as u64;
                        }
                        let out_val = out_t.max(1);
                        new_out_tokens += out_val;
                        let entry = bucket_map.entry(bucket_ts).or_insert((0, 0, 0));
                        entry.1 += out_val;
                        entry.2 += cached_t;
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

                    // Estimate cached tokens for sessions with multiple turns if raw usage didn't report them
                    let total_cached_in_session: u64 = bucket_map.values().map(|v| v.2).sum();
                    let should_estimate_cache = total_cached_in_session == 0 && lines_processed > 3;

                    for (bucket_ts, (in_tok, out_tok, raw_cached)) in bucket_map {
                        let final_cached = if should_estimate_cache {
                            // In multi-turn assistant sessions, system instructions and context prefixes (~15-30% of input)
                            // are implicitly served from Gemini/Claude KV cache
                            ((in_tok as f64) * 0.25).round() as u32
                        } else {
                            raw_cached as u32
                        };

                        if let Err(e) = crate::modules::token_stats::record_usage_full(
                            &account_email,
                            &model,
                            in_tok as u32,
                            out_tok as u32,
                            final_cached,
                            &platform,
                            Some(bucket_ts),
                        ) {
                            result.errors.push(format!("Failed to record usage for {}: {}", name, e));
                        }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_varint() {
        // Single byte varint: 23
        let data1 = [0x17];
        let (val1, len1) = decode_varint(&data1, 0).unwrap();
        assert_eq!(val1, 23);
        assert_eq!(len1, 1);

        // Multi-byte varint: 300 = 0xAC 0x02
        let data2 = [0xAC, 0x02];
        let (val2, len2) = decode_varint(&data2, 0).unwrap();
        assert_eq!(val2, 300);
        assert_eq!(len2, 2);

        // Truncated varint
        let data3 = [0x80];
        assert!(decode_varint(&data3, 0).is_none());
    }

    #[test]
    fn test_is_valid_model_candidate() {
        // Legitimate AI models
        assert!(is_valid_model_candidate("gemini-3.7-flash-tiered"));
        assert!(is_valid_model_candidate("gemini-3.8-flash"));
        assert!(is_valid_model_candidate("claude-3-7-sonnet"));
        assert!(is_valid_model_candidate("claude-opus-4-6-thinking"));
        assert!(is_valid_model_candidate("o3-mini"));
        assert!(is_valid_model_candidate("gpt-4o"));
        assert!(is_valid_model_candidate("deepseek-r1"));

        // File names, tools, non-models MUST be rejected
        assert!(!is_valid_model_candidate("gemini-3-image-guide.md"));
        assert!(!is_valid_model_candidate("O3-S"));
        assert!(!is_valid_model_candidate("Antigravity IDE"));
        assert!(!is_valid_model_candidate("Claude-Code"));
        assert!(!is_valid_model_candidate("gemini-cli"));
        assert!(!is_valid_model_candidate("src/main.rs"));
        assert!(!is_valid_model_candidate("package.json"));
    }

    #[test]
    fn test_extract_model_from_blob_protobuf() {
        // Construct protobuf blob containing tag 19 wire type 2 (0x9a, 0x01)
        // followed by length 23 (0x17) and "gemini-3.7-flash-tiered"
        let model_str = b"gemini-3.7-flash-tiered";
        let mut blob = vec![0x12, 0x04, 0xaa, 0xbb, 0x9a, 0x01, model_str.len() as u8];
        blob.extend_from_slice(model_str);
        blob.extend_from_slice(&[0x00, 0x01, 0x02]);

        let extracted = extract_model_from_blob(&blob);
        assert_eq!(extracted, Some("gemini-3.7-flash-tiered".to_string()));
    }

    #[test]
    fn test_extract_model_from_blob_rejects_non_models() {
        // Even if tag 19 has "gemini-3-image-guide.md", it should be rejected
        let invalid_str = b"gemini-3-image-guide.md";
        let mut blob = vec![0x9a, 0x01, invalid_str.len() as u8];
        blob.extend_from_slice(invalid_str);

        let extracted = extract_model_from_blob(&blob);
        assert_eq!(extracted, None);
    }
}

