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

    let js_template = r##"
(() => {
    const PALETTE = [
        {"name": "Emerald", "color": "#10b981", "glow": "rgba(16, 185, 129, 0.55)", "bg": "rgba(16, 185, 129, 0.12)", "border": "rgba(16, 185, 129, 0.40)"},
        {"name": "Amber", "color": "#f59e0b", "glow": "rgba(245, 158, 11, 0.55)", "bg": "rgba(245, 158, 11, 0.12)", "border": "rgba(245, 158, 11, 0.40)"},
        {"name": "Purple", "color": "#a855f7", "glow": "rgba(168, 85, 247, 0.55)", "bg": "rgba(168, 85, 247, 0.12)", "border": "rgba(168, 85, 247, 0.40)"},
        {"name": "Pink", "color": "#ec4899", "glow": "rgba(236, 72, 153, 0.55)", "bg": "rgba(236, 72, 153, 0.12)", "border": "rgba(236, 72, 153, 0.40)"},
        {"name": "Sky", "color": "#0ea5e9", "glow": "rgba(14, 165, 233, 0.55)", "bg": "rgba(14, 165, 233, 0.12)", "border": "rgba(14, 165, 233, 0.40)"},
        {"name": "Lime", "color": "#84cc16", "glow": "rgba(132, 204, 22, 0.55)", "bg": "rgba(132, 204, 22, 0.12)", "border": "rgba(132, 204, 22, 0.40)"},
        {"name": "Red", "color": "#ef4444", "glow": "rgba(239, 68, 68, 0.55)", "bg": "rgba(239, 68, 68, 0.12)", "border": "rgba(239, 68, 68, 0.40)"},
        {"name": "Gold", "color": "#eab308", "glow": "rgba(234, 179, 8, 0.55)", "bg": "rgba(234, 179, 8, 0.12)", "border": "rgba(234, 179, 8, 0.40)"},
        {"name": "Indigo", "color": "#6366f1", "glow": "rgba(99, 102, 241, 0.55)", "bg": "rgba(99, 102, 241, 0.12)", "border": "rgba(99, 102, 241, 0.40)"},
        {"name": "Cyan", "color": "#06b6d4", "glow": "rgba(6, 182, 212, 0.55)", "bg": "rgba(6, 182, 212, 0.12)", "border": "rgba(6, 182, 212, 0.40)"},
        {"name": "Rose", "color": "#f43f5e", "glow": "rgba(244, 63, 94, 0.55)", "bg": "rgba(244, 63, 94, 0.12)", "border": "rgba(244, 63, 94, 0.40)"},
        {"name": "Teal", "color": "#14b8a6", "glow": "rgba(20, 184, 166, 0.55)", "bg": "rgba(20, 184, 166, 0.12)", "border": "rgba(20, 184, 166, 0.40)"},
        {"name": "Fuchsia", "color": "#d946ef", "glow": "rgba(217, 70, 239, 0.55)", "bg": "rgba(217, 70, 239, 0.12)", "border": "rgba(217, 70, 239, 0.40)"},
        {"name": "Orange", "color": "#f97316", "glow": "rgba(249, 115, 22, 0.55)", "bg": "rgba(249, 115, 22, 0.12)", "border": "rgba(249, 115, 22, 0.40)"},
        {"name": "Blue", "color": "#2563eb", "glow": "rgba(37, 99, 235, 0.55)", "bg": "rgba(37, 99, 235, 0.12)", "border": "rgba(37, 99, 235, 0.35)"},
        {"name": "Crimson", "color": "#e11d48", "glow": "rgba(225, 29, 72, 0.55)", "bg": "rgba(225, 29, 72, 0.12)", "border": "rgba(225, 29, 72, 0.40)"}
    ];

    function getInitials(name) {
        const clean = name.replace(/[^a-zA-Z0-9]/g, ' ').trim();
        const parts = clean.split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        if (name.length <= 4) return name.toUpperCase();
        return name.slice(0, 3).toUpperCase();
    }

    if (!window.__shield_project_cache) {
        window.__shield_project_cache = {};
        try {
            const raw = localStorage.getItem('antigravity_dynamic_project_palette');
            if (raw) window.__shield_project_cache = JSON.parse(raw);
        } catch(e) {}
    }

    if (!window.__shield_used_indices) {
        window.__shield_used_indices = new Set(
            Object.values(window.__shield_project_cache)
                .map(p => PALETTE.findIndex(x => x.name === p.name))
                .filter(i => i >= 0)
        );
    }

    function getProjectPalette(name) {
        if (!name) return PALETTE[0];
        const key = name.trim();
        if (window.__shield_project_cache[key]) {
            return window.__shield_project_cache[key];
        }
        let h = 2166136261;
        for (let i = 0; i < key.length; i++) {
            h ^= key.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        let idx = Math.abs(h) % PALETTE.length;
        let attempts = 0;
        while (window.__shield_used_indices.has(idx) && window.__shield_used_indices.size < PALETTE.length && attempts < PALETTE.length) {
            idx = (idx + 5) % PALETTE.length;
            attempts++;
        }
        window.__shield_used_indices.add(idx);
        const pal = PALETTE[idx];
        window.__shield_project_cache[key] = pal;
        try {
            localStorage.setItem('antigravity_dynamic_project_palette', JSON.stringify(window.__shield_project_cache));
        } catch(e) {}
        return pal;
    }

    function getProjectsData() {
        const sidebar = document.querySelector('[data-testid="conversation-list-sidebar"]') || 
                        document.querySelector('nav') || 
                        document.querySelector('aside');
        if (!sidebar) return { convMap: {}, projectMap: {}, top10: [] };
        
        function findProjectsHook(fiber) {
            if (!fiber) return null;
            let s = fiber.memoizedState;
            while (s) {
                const ms = s.memoizedState;
                if (Array.isArray(ms) && ms.length > 0 && ms[0] && ms[0].kind === 'project' && ms[0].entries) {
                    return ms;
                }
                s = s.next;
            }
            let found = findProjectsHook(fiber.child);
            if (found) return found;
            return findProjectsHook(fiber.sibling);
        }

        const key = Object.keys(sidebar).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
        let root = sidebar[key];
        while (root && root.return) {
            root = root.return;
            if (root.elementType?.name === 'kGc' || root.elementType?.name === 'mGc') break;
        }
        
        const projects = (findProjectsHook(root) || []).filter(p => p.id !== 'outside-of-project' && p.kind === 'project');
        const convMap = {};
        const projectMap = {};

        const mappedProjects = projects.map(p => {
            const name = (p.label || p.id).trim();
            const pal = getProjectPalette(name);
            projectMap[name] = pal;
            (p.entries || []).forEach(e => {
                if (e.cascadeId) {
                    convMap[e.cascadeId] = pal;
                }
            });
            const maxTime = Math.max(0, ...(p.entries || []).map(e => e.timeKey || 0));
            return {
                id: p.id,
                name,
                maxTime,
                firstConvId: p.entries?.[0]?.cascadeId
            };
        });

        const top10 = mappedProjects.sort((a, b) => b.maxTime - a.maxTime).slice(0, 10);
        return { convMap, projectMap, top10 };
    }

    function applyStyles() {
        try {
            let style = document.getElementById('antigravity-shield-platform-rtl');
            if (!style) {
                style = document.createElement('style');
                style.id = 'antigravity-shield-platform-rtl';
                document.head.appendChild(style);
            }
            const customCss = `
                /* Native pure CSS bidirectional text - zero JS DOM mutation */
                :not(pre) > code {
                    unicode-bidi: plaintext !important;
                }
                textarea, input[type="text"], input:not([type]), [contenteditable="true"] {
                    unicode-bidi: plaintext !important;
                    text-align: start !important;
                }

                /* Non-bold Project headers & badges */
                button[data-testid="project-header"],
                button[data-testid="project-header"] *,
                .agy-pulse-badge,
                [data-testid="project-header"] span,
                [data-project-container] span,
                [style*="--proj-color"] span {
                    font-weight: 400 !important;
                }

                /* Project conversation hover - NO GREEN */
                [data-project-container]:hover,
                [data-project-container]:hover a,
                [data-project-container] a:hover,
                [data-project-container] button:hover,
                [data-project-container] div[role="button"]:hover,
                [style*="--proj-color"]:hover,
                [style*="--proj-color"]:hover a,
                [style*="--proj-color"] a:hover,
                [style*="--proj-color"] button:hover,
                [style*="--proj-color"] div[role="button"]:hover {
                    background: var(--proj-bg, rgba(255,255,255,0.08)) !important;
                    color: var(--proj-color) !important;
                }
                [data-project-container]:hover *,
                [data-project-container] a:hover *,
                [style*="--proj-color"]:hover *,
                [style*="--proj-color"] a:hover * {
                    color: var(--proj-color) !important;
                }
                [data-project-container]:hover svg,
                [data-project-container] a:hover svg,
                [style*="--proj-color"]:hover svg,
                [style*="--proj-color"] a:hover svg {
                    color: var(--proj-color) !important;
                    stroke: var(--proj-color) !important;
                }

                /* Project conversation active / selected - NO GREEN */
                [data-project-container] a[aria-current="page"],
                [data-project-container] [aria-selected="true"],
                [data-project-container] .active,
                [data-project-container] [class*="bg-sidebar-accent"],
                [data-project-container] [class*="bg-accent"],
                [style*="--proj-color"] a[aria-current="page"],
                [style*="--proj-color"] [aria-selected="true"],
                [style*="--proj-color"] .active,
                [style*="--proj-color"] [class*="bg-accent"],
                [style*="--proj-color"] [class*="bg-primary"],
                [style*="--proj-color"] [class*="bg-sidebar-accent"] {
                    background: var(--proj-bg, rgba(255,255,255,0.14)) !important;
                    color: var(--proj-color) !important;
                    box-shadow: inset 3px 0 0 var(--proj-color) !important;
                }
                [data-project-container] a[aria-current="page"] *,
                [data-project-container] [aria-selected="true"] *,
                [data-project-container] [class*="bg-sidebar-accent"] *,
                [data-project-container] [class*="bg-accent"] *,
                [style*="--proj-color"] a[aria-current="page"] *,
                [style*="--proj-color"] [aria-selected="true"] *,
                [style*="--proj-color"] [class*="bg-sidebar-accent"] *,
                [style*="--proj-color"] [class*="bg-accent"] * {
                    color: var(--proj-color) !important;
                }
                [data-project-container] a[aria-current="page"] svg,
                [data-project-container] [aria-selected="true"] svg,
                [style*="--proj-color"] a[aria-current="page"] svg,
                [style*="--proj-color"] [aria-selected="true"] svg {
                    color: var(--proj-color) !important;
                    stroke: var(--proj-color) !important;
                }
            `;
            const fullCss = `__VAZIRMATN_CSS_PLACEHOLDER__` + customCss;
            if (style.textContent !== fullCss) {
                style.textContent = fullCss;
            }

            const { convMap, projectMap, top10 } = getProjectsData();

            // Style Top 10 Projects Pulse Bar safely inside projectsHeader
            const projectsHeader = document.querySelector('[data-testid="section-header"][data-title="Projects"]');
            if (projectsHeader && top10.length > 0) {
                let pulseBar = document.getElementById('agy-project-pulse-bar');
                if (!pulseBar) {
                    pulseBar = document.createElement('div');
                    pulseBar.id = 'agy-project-pulse-bar';
                    pulseBar.style.cssText = 'display: flex !important; align-items: center !important; gap: 6px !important; padding: 6px 2px 4px 2px !important; overflow-x: auto !important; scrollbar-width: none !important; width: 100% !important; margin-top: 4px !important;';
                    projectsHeader.style.display = 'flex';
                    projectsHeader.style.flexDirection = 'column';
                    projectsHeader.style.alignItems = 'stretch';
                    projectsHeader.appendChild(pulseBar);
                }

                const fingerprint = top10.map(p => p.id + ':' + p.maxTime).join('|');
                if (pulseBar.getAttribute('data-fingerprint') !== fingerprint) {
                    pulseBar.setAttribute('data-fingerprint', fingerprint);
                    pulseBar.innerHTML = '';
                    
                    top10.forEach((p, rank) => {
                        const pal = getProjectPalette(p.name);
                        const badge = document.createElement('button');
                        badge.className = 'agy-pulse-badge';
                        badge.title = `${rank + 1}. ${p.name}`;
                        badge.style.cssText = `
                            background: ${pal.bg} !important;
                            border: 1.5px solid ${pal.color} !important;
                            box-shadow: 0 0 8px ${pal.glow} !important;
                            color: ${pal.color} !important;
                            border-radius: 9999px !important;
                            padding: 2px 7px !important;
                            height: 20px !important;
                            display: inline-flex !important;
                            align-items: center !important;
                            justify-content: center !important;
                            font-family: inherit !important;
                            font-size: 0.65rem !important;
                            font-weight: 400 !important;
                            letter-spacing: 0.05em !important;
                            cursor: pointer !important;
                            flex-shrink: 0 !important;
                            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
                            user-select: none !important;
                        `;
                        badge.textContent = getInitials(p.name);

                        badge.onmouseenter = () => {
                            badge.style.transform = 'scale(1.05)';
                            badge.style.filter = 'brightness(1.2)';
                            badge.style.boxShadow = `0 0 7px ${pal.color}`;
                        };
                        badge.onmouseleave = () => {
                            badge.style.transform = 'none';
                            badge.style.filter = 'none';
                            badge.style.boxShadow = `0 0 8px ${pal.glow}`;
                        };

                        badge.onclick = (e) => {
                            e.stopPropagation();
                            const header = Array.from(document.querySelectorAll('button[data-testid="project-header"]'))
                                .find(h => (h.getAttribute('data-project-label') || h.innerText || '').trim() === p.name);
                            if (header) {
                                header.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                if (header.getAttribute('aria-expanded') === 'false') {
                                    header.click();
                                }
                                setTimeout(() => {
                                    const parent = header.closest('div.bg-sidebar.pt-1');
                                    let next = parent ? parent.nextElementSibling : null;
                                    if (next) {
                                        const link = next.querySelector('.agy-sidebar-row[class*="pl-"] a');
                                        if (link) link.click();
                                    }
                                }, 180);
                            } else if (p.firstConvId) {
                                const a = document.createElement('a');
                                a.href = `/c/${p.firstConvId}?project=${p.id}`;
                                document.body.appendChild(a);
                                a.click();
                                a.remove();
                            }
                        };

                        pulseBar.appendChild(badge);
                    });
                }
            }

            // Style project headers
            document.querySelectorAll('button[data-testid="project-header"]').forEach(header => {
                const name = (header.getAttribute('data-project-label') || header.innerText || '').trim();
                const pal = projectMap[name] || getProjectPalette(name);
                if (!pal) return;

                if (header.style.getPropertyValue('--proj-color') !== pal.color) {
                    header.style.setProperty('--proj-color', pal.color);
                    header.style.setProperty('--proj-glow', pal.glow);
                    header.style.setProperty('--proj-bg', pal.bg);
                    header.style.setProperty('border', `1px solid ${pal.border}`, 'important');
                    header.style.setProperty('background', pal.bg, 'important');
                }

                const titleSpan = header.querySelector('span.truncate') || header.querySelector('span');
                if (titleSpan && titleSpan.style.color !== pal.color) {
                    titleSpan.style.setProperty('color', pal.color, 'important');
                    titleSpan.style.setProperty('font-weight', '400', 'important');
                }

                const iconSvg = header.querySelector('svg');
                if (iconSvg && iconSvg.style.color !== pal.color) {
                    iconSvg.style.setProperty('color', pal.color, 'important');
                    iconSvg.style.setProperty('filter', `drop-shadow(0 0 5px ${pal.glow})`, 'important');
                }
            });

            // Style conversation rows based on convMap
            document.querySelectorAll('a[href*="/c/"]').forEach(a => {
                const href = a.getAttribute('href') || '';
                const match = href.match(/\/c\/([a-zA-Z0-9_-]+)/);
                if (!match) return;
                const convId = match[1];
                const pal = convMap[convId];
                if (pal) {
                    a.setAttribute('data-project-container', 'true');
                    if (a.style.getPropertyValue('--proj-color') !== pal.color) {
                        a.style.setProperty('--proj-color', pal.color);
                        a.style.setProperty('--proj-bg', pal.bg);
                        a.style.setProperty('--proj-glow', pal.glow);
                    }
                    const row = a.closest('.agy-sidebar-row') || a.closest('li') || a.parentElement;
                    if (row) {
                        row.setAttribute('data-project-container', 'true');
                        if (row.style.getPropertyValue('--proj-color') !== pal.color) {
                            row.style.setProperty('--proj-color', pal.color);
                            row.style.setProperty('--proj-bg', pal.bg);
                            row.style.setProperty('--proj-glow', pal.glow);
                        }
                    }
                }
            });

        } catch (err) {
            // Suppress error so React never crashes
        }
    }

    applyStyles();

    if (window.__shield_platform_observer) {
        window.__shield_platform_observer.disconnect();
    }
    let __shield_debounce_timer = null;
    window.__shield_platform_observer = new MutationObserver(() => {
        if (__shield_debounce_timer) clearTimeout(__shield_debounce_timer);
        __shield_debounce_timer = setTimeout(() => {
            applyStyles();
        }, 400);
    });

    const targetSidebar = document.querySelector('[data-testid="conversation-list-sidebar"]') || 
                          document.querySelector('aside') || 
                          document.querySelector('nav');
    if (targetSidebar) {
        window.__shield_platform_observer.observe(targetSidebar, { childList: true, subtree: true });
    }

    return 'PLATFORM_CDP_BRIDGE_ACTIVE';
})()
"##;

    let js = js_template.replace("__VAZIRMATN_CSS_PLACEHOLDER__", &escaped_css);

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
