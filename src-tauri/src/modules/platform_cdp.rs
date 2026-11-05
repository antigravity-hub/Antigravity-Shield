// Antigravity Shield — AI Proxy & Fleet Management Engine
// Repository: https://github.com/antigravity-hub/Antigravity-Shield

use std::fs;
use std::time::Duration;
use tracing::{debug, info, warn};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

pub const COMPLETE_VAZIRMATN_RTL_CSS: &str = r#"
/* Antigravity Shield — Platform Native Vazirmatn & RTL Suite */
@font-face {
    font-family: 'Vazirmatn';
    src: local('Vazirmatn'), local('Vazirmatn-Regular');
    font-weight: 400;
    font-style: normal;
}
@font-face {
    font-family: 'Vazirmatn';
    src: local('Vazirmatn Medium'), local('Vazirmatn-Medium');
    font-weight: 500;
    font-style: normal;
}
@font-face {
    font-family: 'Vazirmatn';
    src: local('Vazirmatn SemiBold'), local('Vazirmatn-SemiBold');
    font-weight: 600;
    font-style: normal;
}
@font-face {
    font-family: 'Vazirmatn';
    src: local('Vazirmatn Bold'), local('Vazirmatn-Bold');
    font-weight: 700;
    font-style: normal;
}

[role="article"],
[data-message-author-role],
.chat-message,
.prose {
    font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    text-align: justify !important;
    text-justify: inter-word !important;
    text-align-last: start !important;
    line-height: 1.85 !important;
    letter-spacing: -0.01em !important;
}

[role="article"] h1, [role="article"] h2, [role="article"] h3,
[role="article"] h4, [role="article"] h5, [role="article"] h6 {
    font-family: 'Vazirmatn', sans-serif !important;
    color: #93e9be !important;
    font-weight: 700 !important;
    letter-spacing: -0.02em !important;
    margin-top: 1rem !important;
    margin-bottom: 0.5rem !important;
}

[role="article"] ol > li::marker,
[role="article"] ul > li::marker {
    color: #93e9be !important;
    font-weight: 700 !important;
}

[role="article"] ol > li > strong:first-child,
[role="article"] ul > li > strong:first-child {
    color: #93e9be !important;
    font-weight: 700 !important;
}

[role="article"] code,
[role="article"] pre,
[role="article"] kbd,
[role="article"] samp {
    font-family: "JetBrains Mono", "Cascadia Code", Consolas, monospace !important;
    direction: ltr !important;
    unicode-bidi: embed !important;
    text-align: left !important;
}

.markdown-alert,
blockquote:has([class*="markdown-alert"]) {
    border-radius: 12px !important;
    padding: 12px 16px !important;
    margin: 14px 0 !important;
    backdrop-filter: blur(8px) !important;
    border-inline-start-width: 4px !important;
    border-inline-start-style: solid !important;
}

.markdown-alert-tip {
    border-inline-start-color: #93e9be !important;
    background: rgba(147, 233, 190, 0.08) !important;
    color: inherit !important;
}
.markdown-alert-tip .markdown-alert-title {
    color: #93e9be !important;
    font-weight: 700 !important;
}

.markdown-alert-note {
    border-inline-start-color: #60a5fa !important;
    background: rgba(96, 165, 250, 0.08) !important;
}
.markdown-alert-note .markdown-alert-title {
    color: #60a5fa !important;
    font-weight: 700 !important;
}

.markdown-alert-important {
    border-inline-start-color: #a78bfa !important;
    background: rgba(167, 139, 250, 0.08) !important;
}
.markdown-alert-important .markdown-alert-title {
    color: #a78bfa !important;
}

.markdown-alert-warning {
    border-inline-start-color: #fbbf24 !important;
    background: rgba(251, 191, 36, 0.08) !important;
}
.markdown-alert-warning .markdown-alert-title {
    color: #fbbf24 !important;
}

.markdown-alert-caution {
    border-inline-start-color: #f87171 !important;
    background: rgba(248, 113, 113, 0.08) !important;
}
.markdown-alert-caution .markdown-alert-title {
    color: #f87171 !important;
}
"#;

pub fn get_devtools_port() -> Option<u16> {
    let port_path = dirs::config_dir()?.join("Antigravity").join("DevToolsActivePort");
    if !port_path.exists() {
        return None;
    }
    let content = fs::read_to_string(port_path).ok()?;
    let first_line = content.lines().next()?;
    first_line.trim().parse::<u16>().ok()
}

pub fn is_platform_active() -> bool {
    get_devtools_port().is_some()
}

/// Injects Vazirmatn and RTL style into all active Antigravity Platform windows via Chrome DevTools Protocol
pub async fn inject_platform_rtl() -> Result<usize, String> {
    let port = match get_devtools_port() {
        Some(p) => p,
        None => return Ok(0),
    };

    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(1500))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("http://127.0.0.1:{}/json", port);
    let targets: Vec<serde_json::Value> = match client.get(&url).send().await {
        Ok(res) => res.json().await.unwrap_or_default(),
        Err(e) => return Err(format!("DevTools unreachable: {}", e)),
    };

    let mut count = 0;
    for target in targets {
        let t_type = target.get("type").and_then(|v| v.as_str()).unwrap_or("");
        let t_url = target.get("url").and_then(|v| v.as_str()).unwrap_or("");

        if (t_type == "page" || t_type == "webview") && t_url.contains("127.0.0.1") {
            if let Some(ws_url) = target.get("webSocketDebuggerUrl").and_then(|v| v.as_str()) {
                if let Some(path_idx) = ws_url.find("/devtools/page/") {
                    let path = &ws_url[path_idx..];
                    if let Ok(()) = send_cdp_evaluate(port, path).await {
                        count += 1;
                    }
                }
            }
        }
    }

    Ok(count)
}

async fn send_cdp_evaluate(port: u16, path: &str) -> Result<(), String> {
    let mut stream = TcpStream::connect(("127.0.0.1", port))
        .await
        .map_err(|e| e.to_string())?;

    let host = format!("127.0.0.1:{}", port);
    let handshake = format!(
        "GET {} HTTP/1.1\r\n\
         Host: {}\r\n\
         Upgrade: websocket\r\n\
         Connection: Upgrade\r\n\
         Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\
         Sec-WebSocket-Version: 13\r\n\r\n",
        path, host
    );

    stream
        .write_all(handshake.as_bytes())
        .await
        .map_err(|e| e.to_string())?;

    let mut buf = [0u8; 1024];
    let n = stream.read(&mut buf).await.map_err(|e| e.to_string())?;
    let resp = String::from_utf8_lossy(&buf[..n]);

    if !resp.contains("101") {
        return Err("WebSocket handshake failed".into());
    }

    let escaped_css = COMPLETE_VAZIRMATN_RTL_CSS
        .replace('\\', "\\\\")
        .replace('`', "\\`")
        .replace('$', "\\$");

    let js = format!(
        r#"
(() => {{
    function applyStyles() {{
        let style = document.getElementById('antigravity-shield-platform-rtl');
        if (!style) {{
            style = document.createElement('style');
            style.id = 'antigravity-shield-platform-rtl';
            document.head.appendChild(style);
        }}
        style.textContent = `{}`;

        document.querySelectorAll('[role="article"]').forEach(a => {{
            if (a.getAttribute('dir') !== 'auto') {{
                a.setAttribute('dir', 'auto');
            }}
        }});
    }}

    applyStyles();

    if (!window.__shield_rtl_observer) {{
        window.__shield_rtl_observer = new MutationObserver((mutations) => {{
            for (const m of mutations) {{
                if (m.addedNodes.length > 0) {{
                    document.querySelectorAll('[role="article"]').forEach(a => {{
                        if (a.getAttribute('dir') !== 'auto') {{
                            a.setAttribute('dir', 'auto');
                        }}
                    }});
                }}
            }}
        }});
        window.__shield_rtl_observer.observe(document.body, {{ childList: true, subtree: true }});
    }}

    return 'PLATFORM_CDP_BRIDGE_ACTIVE';
}})()
"#,
        escaped_css
    );

    let payload = serde_json::to_vec(&serde_json::json!({
        "id": 1,
        "method": "Runtime.evaluate",
        "params": {
            "expression": js,
            "returnByValue": true
        }
    }))
    .map_err(|e| e.to_string())?;

    // Build RFC 6455 masked text frame
    let mut frame = Vec::new();
    frame.push(0x81); // FIN + Text opcode

    let len = payload.len();
    if len <= 125 {
        frame.push(0x80 | (len as u8));
    } else if len <= 65535 {
        frame.push(0x80 | 126);
        frame.extend_from_slice(&(len as u16).to_be_bytes());
    } else {
        frame.push(0x80 | 127);
        frame.extend_from_slice(&(len as u64).to_be_bytes());
    }

    let mask = [0x54, 0x61, 0x75, 0x72]; // Masking key
    frame.extend_from_slice(&mask);

    for (i, b) in payload.iter().enumerate() {
        frame.push(b ^ mask[i % 4]);
    }

    stream.write_all(&frame).await.map_err(|e| e.to_string())?;
    stream.flush().await.map_err(|e| e.to_string())?;

    Ok(())
}

/// Continuous low-overhead watcher that ensures Antigravity Platform stays patched
pub fn start_platform_cdp_watcher() {
    tauri::async_runtime::spawn(async move {
        // Initial warmup delay
        tokio::time::sleep(Duration::from_secs(4)).await;

        let mut interval = tokio::time::interval(Duration::from_secs(12));
        loop {
            interval.tick().await;
            if is_platform_active() {
                if let Ok(count) = inject_platform_rtl().await {
                    if count > 0 {
                        debug!("[CDP Bridge] Injected live RTL & Vazirmatn into {} platform target(s)", count);
                    }
                }
            }
        }
    });
}
