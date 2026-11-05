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
    const PALETTE = [
        {{"name": "Emerald", "color": "#10b981", "glow": "rgba(16, 185, 129, 0.55)", "bg": "rgba(16, 185, 129, 0.12)", "border": "rgba(16, 185, 129, 0.40)"}},
        {{"name": "Amber", "color": "#f59e0b", "glow": "rgba(245, 158, 11, 0.55)", "bg": "rgba(245, 158, 11, 0.12)", "border": "rgba(245, 158, 11, 0.40)"}},
        {{"name": "Purple", "color": "#a855f7", "glow": "rgba(168, 85, 247, 0.55)", "bg": "rgba(168, 85, 247, 0.12)", "border": "rgba(168, 85, 247, 0.40)"}},
        {{"name": "Pink", "color": "#ec4899", "glow": "rgba(236, 72, 153, 0.55)", "bg": "rgba(236, 72, 153, 0.12)", "border": "rgba(236, 72, 153, 0.40)"}},
        {{"name": "Sky", "color": "#0ea5e9", "glow": "rgba(14, 165, 233, 0.55)", "bg": "rgba(14, 165, 233, 0.12)", "border": "rgba(14, 165, 233, 0.40)"}},
        {{"name": "Lime", "color": "#84cc16", "glow": "rgba(132, 204, 22, 0.55)", "bg": "rgba(132, 204, 22, 0.12)", "border": "rgba(132, 204, 22, 0.40)"}},
        {{"name": "Red", "color": "#ef4444", "glow": "rgba(239, 68, 68, 0.55)", "bg": "rgba(239, 68, 68, 0.12)", "border": "rgba(239, 68, 68, 0.40)"}},
        {{"name": "Gold", "color": "#eab308", "glow": "rgba(234, 179, 8, 0.55)", "bg": "rgba(234, 179, 8, 0.12)", "border": "rgba(234, 179, 8, 0.40)"}},
        {{"name": "Indigo", "color": "#6366f1", "glow": "rgba(99, 102, 241, 0.55)", "bg": "rgba(99, 102, 241, 0.12)", "border": "rgba(99, 102, 241, 0.40)"}},
        {{"name": "Cyan", "color": "#06b6d4", "glow": "rgba(6, 182, 212, 0.55)", "bg": "rgba(6, 182, 212, 0.12)", "border": "rgba(6, 182, 212, 0.40)"}},
        {{"name": "Rose", "color": "#f43f5e", "glow": "rgba(244, 63, 94, 0.55)", "bg": "rgba(244, 63, 94, 0.12)", "border": "rgba(244, 63, 94, 0.40)"}},
        {{"name": "Teal", "color": "#14b8a6", "glow": "rgba(20, 184, 166, 0.55)", "bg": "rgba(20, 184, 166, 0.12)", "border": "rgba(20, 184, 166, 0.40)"}},
        {{"name": "Fuchsia", "color": "#d946ef", "glow": "rgba(217, 70, 239, 0.55)", "bg": "rgba(217, 70, 239, 0.12)", "border": "rgba(217, 70, 239, 0.40)"}},
        {{"name": "Orange", "color": "#f97316", "glow": "rgba(249, 115, 22, 0.55)", "bg": "rgba(249, 115, 22, 0.12)", "border": "rgba(249, 115, 22, 0.40)"}},
        {{"name": "Blue", "color": "#2563eb", "glow": "rgba(37, 99, 235, 0.55)", "bg": "rgba(37, 99, 235, 0.12)", "border": "rgba(37, 99, 235, 0.35)"}},
        {{"name": "Crimson", "color": "#e11d48", "glow": "rgba(225, 29, 72, 0.55)", "bg": "rgba(225, 29, 72, 0.12)", "border": "rgba(225, 29, 72, 0.40)"}}
    ];

    function getInitials(name) {{
        const clean = name.replace(/[^a-zA-Z0-9]/g, ' ').trim();
        const parts = clean.split(/\\s+/);
        if (parts.length >= 2) {{
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }}
        if (name.length <= 4) return name.toUpperCase();
        return name.slice(0, 3).toUpperCase();
    }}

    function hashProject(name) {{
        let h = 0;
        for (let i = 0; i < name.length; i++) {{
            h = (h * 37 + name.charCodeAt(i) * (i + 7)) & 0xFFFFFFFF;
        }}
        return Math.abs(h) % PALETTE.length;
    }}

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

        const isPersian = (text) => /[\\u0600-\\u06FF]/.test(text);

        // 0. Inline code with Persian text
        document.querySelectorAll(':not(pre) > code').forEach(code => {{
            const txt = (code.textContent || '').trim();
            if (isPersian(txt)) {{
                code.setAttribute('dir', 'rtl');
                code.style.direction = 'rtl';
                code.style.fontFamily = "'Vazirmatn', 'Cascadia Code', monospace";
            }}
        }});

        // 1. Input boxes & Textareas
        document.querySelectorAll('[contenteditable="true"], textarea, input[type="text"], input:not([type])').forEach(el => {{
            if (!el.getAttribute('dir')) {{
                el.setAttribute('dir', 'auto');
            }}
            const txt = (el.innerText || el.value || el.textContent || '').trim();
            if (txt) {{
                const hasRtl = isPersian(txt);
                el.setAttribute('dir', hasRtl ? 'rtl' : 'ltr');
                el.style.direction = hasRtl ? 'rtl' : 'ltr';
                el.style.textAlign = hasRtl ? 'right' : 'left';
            }}
        }});

        function getTop10Projects() {{
            const sidebar = document.querySelector('[data-testid="conversation-list-sidebar"]') || 
                            document.querySelector('nav') || 
                            document.querySelector('aside');
            if (!sidebar) return [];
            
            function findProjectsHook(fiber) {{
                if (!fiber) return null;
                let s = fiber.memoizedState;
                while (s) {{
                    const ms = s.memoizedState;
                    if (Array.isArray(ms) && ms.length > 0 && ms[0] && ms[0].kind === 'project' && ms[0].entries) {{
                        return ms;
                    }}
                    s = s.next;
                }}
                let found = findProjectsHook(fiber.child);
                if (found) return found;
                return findProjectsHook(fiber.sibling);
            }}

            const key = Object.keys(sidebar).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
            let root = sidebar[key];
            while (root && root.return) {{
                root = root.return;
                if (root.elementType?.name === 'kGc' || root.elementType?.name === 'mGc') break;
            }}
            
            const projects = findProjectsHook(root) || [];
            const realProjects = projects.filter(p => p.id !== 'outside-of-project' && p.kind === 'project');
            
            return realProjects.map(p => {{
                const maxTime = Math.max(0, ...(p.entries || []).map(e => e.timeKey || 0));
                return {{
                    id: p.id,
                    name: (p.label || p.id).trim(),
                    maxTime,
                    firstConvId: p.entries?.[0]?.cascadeId
                }};
            }}).sort((a, b) => b.maxTime - a.maxTime).slice(0, 10);
        }}

        // 1.5. Stable Top 10 Projects Pulse Bar (Sorted by last prompt timestamp)
        const top10 = getTop10Projects();
        const projectsHeader = document.querySelector('[data-testid="section-header"][data-title="Projects"]');
        if (projectsHeader && top10.length > 0) {{
            let pulseBar = document.getElementById('agy-project-pulse-bar');
            if (!pulseBar) {{
                pulseBar = document.createElement('div');
                pulseBar.id = 'agy-project-pulse-bar';
                pulseBar.style.cssText = 'display: flex !important; align-items: center !important; gap: 6px !important; padding: 14px 10px 12px 10px !important; overflow-x: auto !important; scrollbar-width: none !important; border-bottom: 1px solid rgba(255,255,255,0.07) !important; margin-bottom: 6px !important;';
                projectsHeader.insertAdjacentElement('afterend', pulseBar);
            }}

            const fingerprint = top10.map(p => p.id + ':' + p.maxTime).join('|');
            if (pulseBar.getAttribute('data-fingerprint') !== fingerprint) {{
                pulseBar.setAttribute('data-fingerprint', fingerprint);
                pulseBar.innerHTML = '';
                
                const usedColors = new Set();
                top10.forEach((p, rank) => {{
                    let idx = hashProject(p.name);
                    while (usedColors.has(idx) && usedColors.size < PALETTE.length) {{
                        idx = (idx + 3) % PALETTE.length;
                    }}
                    usedColors.add(idx);
                    const pal = PALETTE[idx];

                    const badge = document.createElement('button');
                    badge.className = 'agy-pulse-badge';
                    badge.title = `${{rank + 1}}. ${{p.name}}`;
                    badge.style.cssText = `
                        background: ${{pal.bg}} !important;
                        border: 1.5px solid ${{pal.color}} !important;
                        box-shadow: 0 0 8px ${{pal.glow}} !important;
                        color: ${{pal.color}} !important;
                        border-radius: 9999px !important;
                        padding: 3px 8px !important;
                        height: 24px !important;
                        display: inline-flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        font-family: inherit !important;
                        font-size: 0.68rem !important;
                        font-weight: 800 !important;
                        letter-spacing: 0.05em !important;
                        cursor: pointer !important;
                        flex-shrink: 0 !important;
                        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
                        user-select: none !important;
                    `;
                    badge.textContent = getInitials(p.name);

                    badge.onmouseenter = () => {{
                        badge.style.transform = 'scale(1.05)';
                        badge.style.filter = 'brightness(1.2)';
                        badge.style.boxShadow = `0 0 7px ${{pal.color}}`;
                    }};
                    badge.onmouseleave = () => {{
                        badge.style.transform = 'none';
                        badge.style.filter = 'none';
                        badge.style.boxShadow = `0 0 8px ${{pal.glow}}`;
                    }};

                    badge.onclick = (e) => {{
                        e.stopPropagation();
                        const header = Array.from(document.querySelectorAll('button[data-testid="project-header"]'))
                            .find(h => (h.getAttribute('data-project-label') || h.innerText || '').trim() === p.name);
                        if (header) {{
                            header.scrollIntoView({{ behavior: 'smooth', block: 'nearest' }});
                            if (header.getAttribute('aria-expanded') === 'false') {{
                                header.click();
                            }}
                            setTimeout(() => {{
                                const parent = header.closest('div.bg-sidebar.pt-1');
                                let next = parent ? parent.nextElementSibling : null;
                                if (next) {{
                                    const link = next.querySelector('.agy-sidebar-row[class*="pl-"] a');
                                    if (link) link.click();
                                }}
                            }}, 180);
                        }} else if (p.firstConvId) {{
                            const a = document.createElement('a');
                            a.href = `/c/${{p.firstConvId}}?project=${{p.id}}`;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                        }}
                    }};

                    pulseBar.appendChild(badge);
                }});
            }}
        }}

        // Color currently visible sidebar items
        const listContainer = document.querySelector('div.bg-sidebar.pt-1')?.parentElement;
        if (listContainer) {{
            let currPal = null;
            Array.from(listContainer.children).forEach(c => {{
                const header = c.querySelector('button[data-testid="project-header"]');
                if (header) {{
                    const name = (header.getAttribute('data-project-label') || header.innerText || '').trim();
                    const idx = hashProject(name);
                    const pal = PALETTE[idx];
                    currPal = pal;

                    if (c.style.getPropertyValue('--proj-color') !== pal.color) {{
                        c.style.setProperty('--proj-color', pal.color);
                        c.style.setProperty('--proj-glow', pal.glow);
                        c.style.setProperty('--proj-bg', pal.bg);
                    }}

                    if (header.style.getPropertyValue('--proj-color') !== pal.color) {{
                        header.style.setProperty('--proj-color', pal.color);
                        header.style.setProperty('--proj-glow', pal.glow);
                        header.style.setProperty('--proj-bg', pal.bg);
                        header.style.setProperty('border', `1px solid ${{pal.border}}`, 'important');
                        header.style.setProperty('background', pal.bg, 'important');
                    }}

                    const titleSpan = header.querySelector('span.truncate') || header.querySelector('span');
                    if (titleSpan && titleSpan.style.color !== pal.color) {{
                        titleSpan.style.setProperty('color', pal.color, 'important');
                        titleSpan.style.setProperty('font-weight', '700', 'important');
                    }}

                    const iconSvg = header.querySelector('svg');
                    if (iconSvg && iconSvg.style.color !== pal.color) {{
                        iconSvg.style.setProperty('color', pal.color, 'important');
                        iconSvg.style.setProperty('filter', `drop-shadow(0 0 5px ${{pal.glow}})`, 'important');
                    }}
                }} else if (currPal && (c.querySelector('.agy-sidebar-row[class*="pl-"]') || c.classList.contains('pb-[1px]'))) {{
                    if (c.style.getPropertyValue('--proj-color') !== currPal.color) {{
                        c.style.setProperty('--proj-color', currPal.color);
                        c.style.setProperty('--proj-glow', currPal.glow);
                        c.style.setProperty('--proj-bg', currPal.bg);
                    }}
                    const row = c.querySelector('.agy-sidebar-row[class*="pl-"]');
                    if (row && row.style.getPropertyValue('--proj-color') !== currPal.color) {{
                        row.style.setProperty('--proj-color', currPal.color);
                        row.style.setProperty('--proj-glow', currPal.glow);
                        row.style.setProperty('--proj-bg', currPal.bg);
                    }}
                }} else if (!c.querySelector('.agy-sidebar-row[class*="pl-"]')) {{
                    currPal = null;
                }}
            }});
        }}

        // 2. Sent user bubbles and assistant articles
        document.querySelectorAll('[role="article"]').forEach(art => {{
            const isUser = art.getAttribute('aria-label') === 'User message';
            if (isUser) {{
                art.removeAttribute('dir');
                art.style.direction = 'ltr';
                art.style.textAlign = 'right';
                const frame = art.querySelector('.agy-user-bubble-frame');
                if (frame) {{
                    frame.style.setProperty('border', 'none', 'important');
                    frame.style.setProperty('box-shadow', 'none', 'important');
                    frame.style.setProperty('background', 'transparent', 'important');
                    frame.style.setProperty('padding', '0', 'important');
                    frame.style.setProperty('width', 'fit-content', 'important');
                    frame.style.setProperty('max-width', '100%', 'important');
                    frame.style.setProperty('margin-left', 'auto', 'important');
                }}
                const bubble = art.querySelector('.agy-user-bubble');
                if (bubble) {{
                    bubble.style.setProperty('width', 'fit-content', 'important');
                    bubble.style.setProperty('max-width', '100%', 'important');
                }}
                const textEl = art.querySelector('.whitespace-pre-wrap') || art;
                if (isPersian(textEl.textContent || '')) {{
                    textEl.setAttribute('dir', 'rtl');
                    textEl.style.direction = 'rtl';
                }} else {{
                    textEl.setAttribute('dir', 'ltr');
                    textEl.style.direction = 'ltr';
                }}
                textEl.style.textAlign = 'justify';
                textEl.style.textJustify = 'inter-word';
                textEl.style.textAlignLast = 'start';
            }} else {{
                art.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, ol, ul, blockquote').forEach(el => {{
                    if (el.tagName === 'CODE' || el.tagName === 'PRE' || el.closest('pre')) return;
                    const txt = (el.textContent || '').trim();
                    if (isPersian(txt)) {{
                        el.setAttribute('dir', 'rtl');
                        el.style.direction = 'rtl';
                        if (el.tagName.startsWith('H')) {{
                            el.style.textAlign = 'right';
                            el.style.paddingLeft = '0px';
                            el.style.marginLeft = '0px';
                        }} else if (el.tagName === 'UL' || el.tagName === 'OL') {{
                            el.style.setProperty('padding-left', '0px', 'important');
                            el.style.setProperty('padding-inline-end', '0px', 'important');
                            el.style.setProperty('margin-left', '0px', 'important');
                            el.style.setProperty('padding-right', '1.75rem', 'important');
                            el.style.setProperty('padding-inline-start', '1.75rem', 'important');
                        }}
                    }} else if (txt.length > 0) {{
                        el.setAttribute('dir', 'ltr');
                        el.style.direction = 'ltr';
                    }}
                    if (el.tagName === 'P' || el.tagName === 'LI') {{
                        el.style.textAlign = 'justify';
                        el.style.textJustify = 'inter-word';
                        el.style.textAlignLast = 'start';
                        if (isPersian(txt)) {{
                            el.style.paddingLeft = '0px';
                            el.style.marginLeft = '0px';
                        }}
                    }}
                }});
            }}
        }});
    }}

    applyStyles();

    if (!window.__shield_input_listener_attached) {{
        window.__shield_input_listener_attached = true;
        document.addEventListener('input', (e) => {{
            const target = e.target;
            if (target && (target.isContentEditable || target.matches('textarea, input'))) {{
                const txt = (target.innerText || target.value || target.textContent || '').trim();
                if (txt) {{
                    const hasRtl = /[\\u0600-\\u06FF]/.test(txt);
                    target.setAttribute('dir', hasRtl ? 'rtl' : 'ltr');
                    target.style.direction = hasRtl ? 'rtl' : 'ltr';
                    target.style.textAlign = hasRtl ? 'right' : 'left';
                }} else {{
                    target.setAttribute('dir', 'auto');
                    target.style.direction = '';
                    target.style.textAlign = '';
                }}
            }}
        }}, true);
    }}

    if (window.__shield_platform_observer) {{
        window.__shield_platform_observer.disconnect();
    }}
    let __shield_debounce_timer = null;
    window.__shield_platform_observer = new MutationObserver((mutations) => {{
        let isSelf = mutations.every(m => {{
            const id = m.target?.id || '';
            const tag = m.target?.tagName || '';
            return id === 'antigravity-shield-platform-rtl' || id === 'agy-project-pulse-bar' || m.target?.classList?.contains('agy-pulse-badge') || tag === 'STYLE';
        }});
        if (isSelf) return;

        if (__shield_debounce_timer) clearTimeout(__shield_debounce_timer);
        __shield_debounce_timer = setTimeout(() => {{
            applyStyles();
        }}, 350);
    }});
    window.__shield_platform_observer.observe(document.body, {{ childList: true, subtree: true }});

    return 'PLATFORM_CDP_BRIDGE_ACTIVE';
}})()
"#,
        escaped_css, escaped_css
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
