// Antigravity Shield — AI Proxy & Fleet Management Engine
// Repository: https://github.com/antigravity-hub/Antigravity-Shield

use std::fs;
use std::time::Duration;
use tracing::{debug, info, warn};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

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

    let raw_css = crate::commands::patch::VAZIRMATN_RTL_CSS;
    let escaped_css = raw_css
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
        if (style.textContent !== `{}`) {{
            style.textContent = `{}`;
        }}

        const isPersian = (text) => /[\u0600-\u06FF]/.test(text);

        document.querySelectorAll('[role="article"]').forEach(art => {{
            const isUser = art.getAttribute('aria-label') === 'User message';
            if (isUser) {{
                if (isPersian(art.textContent || '')) {{
                    art.setAttribute('dir', 'rtl');
                    art.style.textAlign = 'right';
                }} else {{
                    art.setAttribute('dir', 'ltr');
                    art.style.textAlign = 'left';
                }}
            }} else {{
                art.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, ol, ul, blockquote').forEach(el => {{
                    if (el.tagName === 'CODE' || el.tagName === 'PRE' || el.closest('pre')) return;
                    const txt = (el.textContent || '').trim();
                    if (isPersian(txt)) {{
                        el.setAttribute('dir', 'rtl');
                    }} else if (txt.length > 0) {{
                        el.setAttribute('dir', 'ltr');
                    }}
                }});
            }}
        }});
    }}

    applyStyles();

    if (!window.__shield_platform_observer) {{
        window.__shield_platform_observer = new MutationObserver(() => {{
            applyStyles();
        }});
        window.__shield_platform_observer.observe(document.body, {{ childList: true, subtree: true }});
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

    let mask = [0x54, 0x61, 0x75, 0x72];
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
        tokio::time::sleep(Duration::from_secs(4)).await;

        let mut interval = tokio::time::interval(Duration::from_secs(10));
        loop {
            interval.tick().await;
            if is_platform_active() {
                let _ = inject_platform_rtl().await;
            }
        }
    });
}
