use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MobileSessionSummary {
    pub id: String,
    pub title: String,
    pub project_name: String,
    pub updated_at: i64,
    pub step_count: usize,
    pub token_estimate: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MobileTurn {
    pub role: String, // "user" | "model"
    pub content: String,
    pub thought: Option<String>,
    pub tool_calls: Vec<String>,
    pub timestamp: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MobileSessionDetail {
    pub session_id: String,
    pub title: String,
    pub project_name: String,
    pub turns: Vec<MobileTurn>,
}

#[derive(Deserialize, Clone, Debug)]
pub struct MobileChatInput {
    pub session_id: String,
    pub message: String,
    pub audio_base64: Option<String>,
    pub image_base64: Option<String>,
}

/// Discovers brain directories across user profile
pub fn get_brain_roots() -> Vec<PathBuf> {
    let home = dirs::home_dir().or_else(|| {
        std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .ok()
            .map(PathBuf::from)
    });
    let Some(home_path) = home else {
        return Vec::new();
    };

    let gemini_dir = home_path.join(".gemini");
    if !gemini_dir.exists() {
        return Vec::new();
    }

    let mut roots = Vec::new();
    let direct_brain = gemini_dir.join("antigravity").join("brain");
    if direct_brain.exists() {
        roots.push(direct_brain);
    }
    let ide_brain = gemini_dir.join("antigravity-ide").join("brain");
    if ide_brain.exists() {
        roots.push(ide_brain);
    }

    if let Ok(entries) = fs::read_dir(&gemini_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("antigravity") && entry.path().is_dir() {
                let candidate = entry.path().join("brain");
                if candidate.exists() && !roots.contains(&candidate) {
                    roots.push(candidate);
                }
            }
        }
    }

    roots
}

/// Scans the latest active conversation sessions
pub fn scan_mobile_sessions(limit: usize) -> Vec<MobileSessionSummary> {
    let roots = get_brain_roots();
    let mut sessions = Vec::new();

    for root in roots {
        let Ok(entries) = fs::read_dir(&root) else {
            continue;
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let session_id = entry.file_name().to_string_lossy().to_string();
            if session_id.starts_with('.') {
                continue;
            }

            // Check transcript path
            let transcript_path = path
                .join(".system_generated")
                .join("logs")
                .join("transcript.jsonl");

            let transcript_file = if transcript_path.exists() {
                transcript_path
            } else {
                let fallback = path
                    .join(".system_generated")
                    .join("logs")
                    .join("transcript_full.jsonl");
                if fallback.exists() {
                    fallback
                } else {
                    continue;
                }
            };

            let Ok(meta) = fs::metadata(&transcript_file) else {
                continue;
            };
            let updated_at = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0);

            // Fast peek at first few lines to get project name and user prompt preview
            let mut title = String::new();
            let mut project_name = "Workspace".to_string();
            let mut step_count = 0;
            let mut token_estimate = meta.len() / 4;

            if let Ok(file) = File::open(&transcript_file) {
                let reader = BufReader::new(file);
                for line in reader.lines().flatten() {
                    step_count += 1;
                    if title.is_empty() {
                        if let Ok(v) = serde_json::from_str::<Value>(&line) {
                            if let Some(content) = v.get("content").and_then(|c| c.as_str()) {
                                if content.contains("<USER_REQUEST>") {
                                    if let Some(start) = content.find("<USER_REQUEST>") {
                                        let sub = &content[start + 14..];
                                        if let Some(end) = sub.find("</USER_REQUEST>") {
                                            title = sub[..end].trim().to_string();
                                        }
                                    }
                                } else if v.get("type").and_then(|t| t.as_str()) == Some("USER_INPUT") {
                                    title = content.trim().chars().take(80).collect();
                                }
                            }
                            if let Some(info) = v.get("user_information").and_then(|u| u.as_str()) {
                                if let Some(idx) = info.find("->") {
                                    let sub = &info[idx + 2..];
                                    let p_name = sub.trim().lines().next().unwrap_or("").trim();
                                    if !p_name.is_empty() {
                                        project_name = p_name.to_string();
                                    }
                                }
                            }
                        }
                    }
                    if step_count > 200 {
                        break;
                    }
                }
            }

            if title.is_empty() {
                title = format!("Session {}", &session_id[..session_id.len().min(8)]);
            }

            sessions.push(MobileSessionSummary {
                id: session_id,
                title,
                project_name,
                updated_at,
                step_count,
                token_estimate,
            });
        }
    }

    sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    sessions.truncate(limit);
    sessions
}

/// Reads the conversation turns for a given session
pub fn get_session_detail(session_id: &str) -> Option<MobileSessionDetail> {
    let roots = get_brain_roots();

    for root in roots {
        let dir = root.join(session_id);
        if !dir.is_dir() {
            continue;
        }

        let transcript_path = dir
            .join(".system_generated")
            .join("logs")
            .join("transcript.jsonl");

        let transcript_file = if transcript_path.exists() {
            transcript_path
        } else {
            let fallback = dir
                .join(".system_generated")
                .join("logs")
                .join("transcript_full.jsonl");
            if fallback.exists() {
                fallback
            } else {
                continue;
            }
        };

        let Ok(file) = File::open(&transcript_file) else {
            continue;
        };
        let reader = BufReader::new(file);

        let mut title = String::new();
        let mut project_name = "Workspace".to_string();
        let mut turns = Vec::new();

        for line in reader.lines().flatten() {
            let Ok(v) = serde_json::from_str::<Value>(&line) else {
                continue;
            };

            let stype = v.get("type").and_then(|t| t.as_str()).unwrap_or("");
            let source = v.get("source").and_then(|s| s.as_str()).unwrap_or("");
            let timestamp = v.get("created_at").and_then(|c| c.as_str()).map(|s| s.to_string());

            let is_user = stype == "USER_INPUT" || source == "USER_EXPLICIT";
            let is_assistant = stype == "PLANNER_RESPONSE" || source == "MODEL";

            if is_user {
                let mut raw = v.get("content").and_then(|c| c.as_str()).unwrap_or("").to_string();
                if let Some(start) = raw.find("<USER_REQUEST>") {
                    let sub = &raw[start + 14..];
                    if let Some(end) = sub.find("</USER_REQUEST>") {
                        raw = sub[..end].trim().to_string();
                    }
                }
                if title.is_empty() {
                    title = raw.chars().take(80).collect();
                }

                turns.push(MobileTurn {
                    role: "user".to_string(),
                    content: raw,
                    thought: None,
                    tool_calls: Vec::new(),
                    timestamp,
                });
            } else if is_assistant {
                let mut content = v.get("content").and_then(|c| c.as_str()).unwrap_or("").to_string();
                let mut thought = v.get("thinking").and_then(|t| t.as_str()).map(|s| s.to_string());

                if thought.is_none() && content.contains("<thought>") {
                    if let Some(s_idx) = content.find("<thought>") {
                        if let Some(e_idx) = content.find("</thought>") {
                            thought = Some(content[s_idx + 9..e_idx].trim().to_string());
                            content = format!("{}{}", &content[..s_idx], &content[e_idx + 10..]).trim().to_string();
                        }
                    }
                }

                let mut tool_calls = Vec::new();
                if let Some(calls) = v.get("tool_calls").and_then(|tc| tc.as_array()) {
                    for tc in calls {
                        if let Some(name) = tc.get("toolAction").or_else(|| tc.get("name")).and_then(|n| n.as_str()) {
                            tool_calls.push(name.to_string());
                        }
                    }
                }

                turns.push(MobileTurn {
                    role: "model".to_string(),
                    content,
                    thought,
                    tool_calls,
                    timestamp,
                });
            }
        }

        if title.is_empty() {
            title = format!("Session {}", &session_id[..session_id.len().min(8)]);
        }

        return Some(MobileSessionDetail {
            session_id: session_id.to_string(),
            title,
            project_name,
            turns,
        });
    }

    None
}

/// Appends a new prompt into the session's pending inbox queue
pub fn append_mobile_message(input: &MobileChatInput) -> Result<(), String> {
    let home = dirs::home_dir().or_else(|| {
        std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .ok()
            .map(PathBuf::from)
    });
    let Some(home_path) = home else {
        return Err("Home directory not found".to_string());
    };

    let queue_dir = home_path.join(".gemini").join("remote_inbox");
    let _ = fs::create_dir_all(&queue_dir);

    let filename = format!("msg_{}_{}.json", input.session_id, chrono::Utc::now().timestamp_millis());
    let filepath = queue_dir.join(filename);

    let payload = serde_json::json!({
        "sessionId": input.session_id,
        "message": input.message,
        "audioBase64": input.audio_base64,
        "imageBase64": input.image_base64,
        "receivedAt": chrono::Utc::now().to_rfc3339(),
    });

    fs::write(filepath, serde_json::to_string_pretty(&payload).unwrap_or_default())
        .map_err(|e| format!("Failed to queue message: {}", e))?;

    Ok(())
}

/// Renders the complete, responsive Cyber-Glass Mobile SPA HTML
pub fn render_mobile_view_html(auth_token: &str) -> String {
    format!(r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Antigravity Shield • Live Mobile</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
    :root {{
      --bg: #070b14;
      --card-bg: rgba(15, 23, 42, 0.75);
      --card-border: rgba(255, 255, 255, 0.08);
      --seafoam: #2dd4bf;
      --seafoam-light: #5eead4;
      --seafoam-glow: rgba(45, 212, 191, 0.25);
      --accent-cyan: #38bdf8;
      --accent-orange: #f97316;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }}
    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
    }}
    body {{
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      flex-direction: column;
      height: 100dvh;
      overflow: hidden;
    }}
    /* Cyber-Glass Header */
    .header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: rgba(11, 18, 33, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--card-border);
      flex-shrink: 0;
      z-index: 10;
    }}
    .header-brand {{
      display: flex;
      align-items: center;
      gap: 8px;
    }}
    .brand-icon {{
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: linear-gradient(135deg, rgba(45, 212, 191, 0.2), rgba(56, 189, 248, 0.2));
      border: 1px solid var(--seafoam);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }}
    .brand-title {{
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.01em;
    }}
    .brand-sub {{
      font-size: 9.5px;
      color: var(--seafoam-light);
      font-weight: 600;
    }}
    .status-badge {{
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 10px;
      color: #34d399;
      font-weight: 600;
    }}
    .status-dot {{
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 6px #10b981;
    }}

    /* Session Picker Bar */
    .session-bar {{
      padding: 8px 14px;
      background: rgba(15, 23, 42, 0.5);
      border-bottom: 1px solid var(--card-border);
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }}
    .session-select {{
      flex: 1;
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid var(--card-border);
      color: #fff;
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 11px;
      outline: none;
    }}

    /* Timeline Container */
    .timeline {{
      flex: 1;
      overflow-y: auto;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      -webkit-overflow-scrolling: touch;
    }}
    .turn {{
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-width: 90%;
      animation: fadeIn 0.2s ease-out;
    }}
    @keyframes fadeIn {{
      from {{ opacity: 0; transform: translateY(4px); }}
      to {{ opacity: 1; transform: translateY(0); }}
    }}
    .turn-user {{
      align-self: flex-end;
    }}
    .turn-model {{
      align-self: flex-start;
      max-width: 94%;
    }}
    .turn-bubble {{
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.5;
      word-break: break-word;
      unicode-bidi: plaintext;
    }}
    .turn-user .turn-bubble {{
      background: linear-gradient(135deg, rgba(45, 212, 191, 0.25) 0%, rgba(15, 118, 110, 0.35) 100%);
      border: 1px solid rgba(45, 212, 191, 0.4);
      color: #f1f5f9;
      border-bottom-right-radius: 3px;
    }}
    .turn-model .turn-bubble {{
      background: rgba(20, 28, 44, 0.8);
      border: 1px solid var(--card-border);
      color: #e2e8f0;
      border-bottom-left-radius: 3px;
    }}
    .turn-meta {{
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 9.5px;
      color: var(--text-muted);
      margin-bottom: 2px;
    }}
    .turn-user .turn-meta {{
      justify-content: flex-end;
    }}

    /* Expandable Thinking Process */
    .thought-card {{
      background: rgba(30, 41, 59, 0.5);
      border: 1px dashed rgba(45, 212, 191, 0.3);
      border-radius: 8px;
      margin-bottom: 6px;
      overflow: hidden;
    }}
    .thought-header {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 10px;
      font-size: 10.5px;
      color: var(--seafoam-light);
      cursor: pointer;
      user-select: none;
    }}
    .thought-body {{
      display: none;
      padding: 8px 10px;
      font-size: 11px;
      color: #cbd5e1;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      background: rgba(15, 23, 42, 0.6);
      line-height: 1.45;
      white-space: pre-wrap;
    }}

    /* Tool pills */
    .tools-wrap {{
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 4px;
    }}
    .tool-tag {{
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.25);
      color: #38bdf8;
      font-size: 9.5px;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
    }}

    /* Prompt Input Dock */
    .dock {{
      padding: 10px 14px;
      background: rgba(11, 18, 33, 0.95);
      backdrop-filter: blur(12px);
      border-top: 1px solid var(--card-border);
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex-shrink: 0;
    }}
    .dock-row {{
      display: flex;
      align-items: flex-end;
      gap: 8px;
    }}
    .dock-textarea {{
      flex: 1;
      background: rgba(30, 41, 59, 0.85);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      color: #fff;
      padding: 10px 12px;
      font-size: 13px;
      font-family: inherit;
      resize: none;
      max-height: 120px;
      min-height: 42px;
      outline: none;
    }}
    .dock-textarea:focus {{
      border-color: var(--seafoam);
    }}
    .dock-btn {{
      width: 42px;
      height: 42px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      font-size: 16px;
      cursor: pointer;
      flex-shrink: 0;
      transition: all 0.15s ease;
    }}
    .btn-send {{
      background: linear-gradient(135deg, #2dd4bf, #0f766e);
      color: #042f2e;
    }}
    .btn-mic {{
      background: rgba(249, 115, 22, 0.15);
      border: 1px solid rgba(249, 115, 22, 0.3);
      color: #f97316;
    }}
    .btn-mic.recording {{
      background: #ef4444;
      color: #fff;
      animation: pulse 1s infinite;
    }}
    @keyframes pulse {{
      0% {{ transform: scale(1); }}
      50% {{ transform: scale(1.08); }}
      100% {{ transform: scale(1); }}
    }}
  </style>
</head>
<body>
  <!-- Header -->
  <header class="header">
    <div class="header-brand">
      <div class="brand-icon">🛡️</div>
      <div>
        <div class="brand-title">Antigravity Shield</div>
        <div class="brand-sub">Live Mobile View</div>
      </div>
    </div>
    <div class="status-badge">
      <span class="status-dot"></span>
      <span id="conn-status">Live</span>
    </div>
  </header>

  <!-- Session Selector -->
  <div class="session-bar">
    <select id="session-select" class="session-select" onchange="onSessionChange(this.value)">
      <option value="">Loading sessions...</option>
    </select>
  </div>

  <!-- Chat Timeline -->
  <main class="timeline" id="timeline">
    <div style="text-align: center; padding: 40px 10px; color: var(--text-muted); font-size: 12px;">
      Connecting to Antigravity Shield daemon...
    </div>
  </main>

  <!-- Input Dock -->
  <footer class="dock">
    <div class="dock-row">
      <button type="button" class="dock-btn btn-mic" id="btn-mic" onclick="toggleVoiceRecording()" title="Record Voice">
        🎙️
      </button>
      <textarea
        id="prompt-input"
        class="dock-textarea"
        rows="1"
        placeholder="Type a message or instruction..."
        dir="auto"
        onkeydown="handleKey(event)"
      ></textarea>
      <button type="button" class="dock-btn btn-send" onclick="sendPrompt()" title="Send">
        ➤
      </button>
    </div>
  </footer>

  <script>
    var AUTH_TOKEN = "{auth_token}";
    var activeSessionId = "";
    var isRecording = false;
    var mediaRecorder = null;
    var audioChunks = [];

    // Store token in localStorage
    if (AUTH_TOKEN) {{
      localStorage.setItem('ag_mobile_token', AUTH_TOKEN);
    }} else {{
      AUTH_TOKEN = localStorage.getItem('ag_mobile_token') || '';
    }}

    function apiFetch(url, options) {{
      options = options || {{}};
      options.headers = options.headers || {{}};
      options.headers['Authorization'] = 'Bearer ' + AUTH_TOKEN;
      return fetch(url, options);
    }}

    function loadSessions() {{
      apiFetch('/api/mobile-sessions')
        .then(function(res) {{ return res.json(); }})
        .then(function(sessions) {{
          var sel = document.getElementById('session-select');
          if (!sessions || sessions.length === 0) {{
            sel.innerHTML = '<option value="">No Active Sessions</option>';
            return;
          }}
          var html = '';
          for (var i = 0; i < sessions.length; i++) {{
            var s = sessions[i];
            html += '<option value="' + s.id + '"' + (i === 0 && !activeSessionId ? ' selected' : '') + '>' +
              '📁 ' + (s.project_name || 'Project') + ': ' + (s.title || s.id.slice(0, 8)) +
              '</option>';
          }}
          sel.innerHTML = html;
          if (!activeSessionId && sessions[0]) {{
            activeSessionId = sessions[0].id;
            loadTimeline(activeSessionId);
          }}
        }})
        .catch(function(err) {{
          console.error('Failed to load sessions:', err);
        }});
    }}

    function onSessionChange(val) {{
      if (val && val !== activeSessionId) {{
        activeSessionId = val;
        loadTimeline(val);
      }}
    }}

    function loadTimeline(sessionId) {{
      if (!sessionId) return;
      apiFetch('/api/mobile-sessions/' + sessionId)
        .then(function(res) {{ return res.json(); }})
        .then(function(detail) {{
          renderTurns(detail.turns || []);
        }})
        .catch(function(err) {{
          console.error('Failed to load timeline:', err);
        }});
    }}

    function renderTurns(turns) {{
      var container = document.getElementById('timeline');
      if (!turns || turns.length === 0) {{
        container.innerHTML = '<div style="text-align: center; padding: 40px 10px; color: var(--text-muted); font-size: 12px;">No messages in this session yet.</div>';
        return;
      }}
      var html = '';
      for (var i = 0; i < turns.length; i++) {{
        var t = turns[i];
        var isUser = t.role === 'user';
        html += '<div class="turn ' + (isUser ? 'turn-user' : 'turn-model') + '">';
        html += '<div class="turn-meta">';
        html += '<span>' + (isUser ? '👤 User' : '🤖 Assistant') + '</span>';
        if (t.timestamp) {{
          var timeStr = t.timestamp.split('T')[1] ? t.timestamp.split('T')[1].slice(0, 5) : '';
          if (timeStr) html += '<span>• ' + timeStr + '</span>';
        }}
        html += '</div>';

        // Thoughts
        if (t.thought) {{
          html += '<div class="thought-card">';
          html += '<div class="thought-header" onclick="toggleThought(this)">';
          html += '<span>🧠 Thought Process</span><span>›</span>';
          html += '</div>';
          html += '<div class="thought-body">' + escapeHtml(t.thought) + '</div>';
          html += '</div>';
        }}

        // Tool calls
        if (t.tool_calls && t.tool_calls.length > 0) {{
          html += '<div class="tools-wrap">';
          for (var j = 0; j < t.tool_calls.length; j++) {{
            html += '<span class="tool-tag">⚙ ' + escapeHtml(t.tool_calls[j]) + '</span>';
          }}
          html += '</div>';
        }}

        html += '<div class="turn-bubble">' + escapeHtml(t.content) + '</div>';
        html += '</div>';
      }}
      container.innerHTML = html;
      container.scrollTop = container.scrollHeight;
    }}

    function toggleThought(headerEl) {{
      var body = headerEl.nextElementSibling;
      var chevron = headerEl.children[1];
      if (body.style.display === 'block') {{
        body.style.display = 'none';
        if (chevron) chevron.innerText = '›';
      }} else {{
        body.style.display = 'block';
        if (chevron) chevron.innerText = '⌄';
      }}
    }}

    function escapeHtml(text) {{
      return (text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }}

    function handleKey(e) {{
      if (e.key === 'Enter' && !e.shiftKey) {{
        e.preventDefault();
        sendPrompt();
      }}
    }}

    function sendPrompt() {{
      var input = document.getElementById('prompt-input');
      var text = input ? input.value.trim() : '';
      if (!text || !activeSessionId) return;

      input.value = '';
      apiFetch('/api/mobile-chat', {{
        method: 'POST',
        headers: {{ 'Content-Type': 'application/json' }},
        body: JSON.stringify({{
          session_id: activeSessionId,
          message: text
        }})
      }}).then(function() {{
        setTimeout(function() {{ loadTimeline(activeSessionId); }}, 1000);
      }});
    }}

    function toggleVoiceRecording() {{
      var btn = document.getElementById('btn-mic');
      if (!isRecording) {{
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {{
          alert('Microphone access is not supported in this browser.');
          return;
        }}
        navigator.mediaDevices.getUserMedia({{ audio: true }})
          .then(function(stream) {{
            isRecording = true;
            btn.classList.add('recording');
            audioChunks = [];
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = function(e) {{
              if (e.data.size > 0) audioChunks.push(e.data);
            }};
            mediaRecorder.onstop = function() {{
              var audioBlob = new Blob(audioChunks, {{ type: 'audio/ogg' }});
              var reader = new FileReader();
              reader.readAsDataURL(audioBlob);
              reader.onloadend = function() {{
                var base64data = reader.result.split(',')[1];
                apiFetch('/api/mobile-chat', {{
                  method: 'POST',
                  headers: {{ 'Content-Type': 'application/json' }},
                  body: JSON.stringify({{
                    session_id: activeSessionId,
                    message: '[Voice Note]',
                    audio_base64: base64data
                  }})
                }}).then(function() {{
                  setTimeout(function() {{ loadTimeline(activeSessionId); }}, 1000);
                }});
              }};
            }};
            mediaRecorder.start();
          }})
          .catch(function(err) {{
            alert('Could not access microphone: ' + err.message);
          }});
      }} else {{
        isRecording = false;
        btn.classList.remove('recording');
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {{
          mediaRecorder.stop();
        }}
      }}
    }}

    // Auto-refresh poll every 2.5s
    setInterval(function() {{
      if (activeSessionId) {{
        loadTimeline(activeSessionId);
      }}
    }}, 2500);

    // Initial load
    loadSessions();
  </script>
</body>
</html>"#, auth_token = auth_token)
}
