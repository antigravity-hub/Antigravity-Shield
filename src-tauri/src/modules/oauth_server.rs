use crate::modules::oauth;
use std::sync::{Mutex, OnceLock};
use tauri::Url;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::mpsc;
use tokio::sync::watch;

struct OAuthFlowState {
    auth_url: String,
    #[allow(dead_code)]
    redirect_uri: String,
    state: String,
    client_key: String,
    cancel_tx: watch::Sender<bool>,
    code_tx: mpsc::Sender<Result<String, String>>,
    code_rx: Option<mpsc::Receiver<Result<String, String>>>,
}

static OAUTH_FLOW_STATE: OnceLock<Mutex<Option<OAuthFlowState>>> = OnceLock::new();

fn get_oauth_flow_state() -> &'static Mutex<Option<OAuthFlowState>> {
    OAUTH_FLOW_STATE.get_or_init(|| Mutex::new(None))
}

fn oauth_success_html() -> &'static str {
    concat!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n",
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Authorization Successful • Antigravity Shield</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        :root {
            --bg-color: #090D16;
            --card-bg: rgba(17, 24, 39, 0.82);
            --card-border: rgba(255, 255, 255, 0.08);
            --primary: #3B82F6;
            --primary-glow: rgba(59, 130, 246, 0.28);
            --success: #10B981;
            --success-glow: rgba(16, 185, 129, 0.35);
            --text-main: #F8FAFC;
            --text-muted: #94A3B8;
        }
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg-color);
            background-image: 
                radial-gradient(circle at 50% 15%, rgba(59, 130, 246, 0.16), transparent 50%),
                radial-gradient(circle at 85% 80%, rgba(16, 185, 129, 0.12), transparent 45%),
                radial-gradient(circle at 15% 85%, rgba(99, 102, 241, 0.12), transparent 45%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-main);
            padding: 24px;
            overflow: hidden;
            position: relative;
        }
        body::before {
            content: '';
            position: absolute;
            inset: 0;
            background-size: 32px 32px;
            background-image: 
                linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
            mask-image: radial-gradient(circle at 50% 50%, black 40%, transparent 80%);
            -webkit-mask-image: radial-gradient(circle at 50% 50%, black 40%, transparent 80%);
            pointer-events: none;
        }
        .container {
            width: 100%;
            max-width: 460px;
            position: relative;
            z-index: 1;
            animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border-radius: 24px;
            padding: 40px 32px;
            text-align: center;
            box-shadow: 
                0 25px 50px -12px rgba(0, 0, 0, 0.65),
                0 0 0 1px rgba(255, 255, 255, 0.05),
                0 0 40px -10px var(--primary-glow);
            position: relative;
            overflow: hidden;
        }
        .card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, transparent, #38BDF8, #10B981, transparent);
            opacity: 0.9;
        }
        .icon-wrapper {
            width: 80px;
            height: 80px;
            margin: 0 auto 24px;
            border-radius: 50%;
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            box-shadow: 0 0 32px var(--success-glow);
        }
        .icon-wrapper::after {
            content: '';
            position: absolute;
            inset: -6px;
            border-radius: 50%;
            border: 1px solid rgba(16, 185, 129, 0.2);
            animation: pulseRing 2.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        }
        .checkmark-svg {
            width: 44px;
            height: 44px;
        }
        .checkmark-circle {
            stroke: #10B981;
            stroke-width: 2.5;
            stroke-dasharray: 166;
            stroke-dashoffset: 166;
            animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
        }
        .checkmark-check {
            stroke: #34D399;
            stroke-width: 3.2;
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke-dasharray: 48;
            stroke-dashoffset: 48;
            animation: stroke 0.4s cubic-bezier(0.65, 0, 0.45, 1) 0.5s forwards;
        }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(16, 185, 129, 0.12);
            border: 1px solid rgba(16, 185, 129, 0.25);
            padding: 6px 14px;
            border-radius: 9999px;
            font-size: 13px;
            font-weight: 500;
            color: #34D399;
            margin-bottom: 16px;
        }
        .badge-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background-color: #10B981;
            box-shadow: 0 0 8px #10B981;
        }
        h1 {
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.02em;
            color: #FFFFFF;
            margin-bottom: 10px;
        }
        p {
            font-size: 14px;
            line-height: 1.6;
            color: var(--text-muted);
            margin-bottom: 24px;
        }
        .progress-container {
            width: 100%;
            height: 4px;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 9999px;
            overflow: hidden;
            margin-bottom: 24px;
        }
        .progress-bar {
            height: 100%;
            width: 100%;
            background: linear-gradient(90deg, #3B82F6, #10B981);
            transform-origin: left;
            animation: shrinkProgress 3.5s linear forwards;
        }
        .btn {
            width: 100%;
            padding: 14px 20px;
            background: linear-gradient(135deg, #2563EB, #1D4ED8);
            color: #FFFFFF;
            font-family: inherit;
            font-size: 15px;
            font-weight: 600;
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 12px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
        }
        .btn:hover {
            background: linear-gradient(135deg, #3B82F6, #2563EB);
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(37, 99, 235, 0.45);
        }
        .btn:active {
            transform: translateY(0);
        }
        .btn svg {
            width: 18px;
            height: 18px;
            transition: transform 0.2s;
        }
        .btn:hover svg {
            transform: translateX(3px);
        }
        .footer-note {
            font-size: 12px;
            color: #64748B;
            margin-top: 18px;
            transition: color 0.3s ease;
        }
        @keyframes stroke {
            100% { stroke-dashoffset: 0; }
        }
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(24px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pulseRing {
            0% { transform: scale(0.95); opacity: 0.8; }
            50% { transform: scale(1.15); opacity: 0.15; }
            100% { transform: scale(0.95); opacity: 0.8; }
        }
        @keyframes shrinkProgress {
            from { transform: scaleX(1); }
            to { transform: scaleX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="icon-wrapper">
                <svg class="checkmark-svg" viewBox="0 0 52 52" fill="none">
                    <circle class="checkmark-circle" cx="26" cy="26" r="23" />
                    <path class="checkmark-check" d="M14.5 27.5L22 35L37.5 19" />
                </svg>
            </div>
            
            <div class="badge">
                <span class="badge-dot"></span>
                <span>Authorized & Synchronized</span>
            </div>

            <h1>Authorization Successful</h1>
            <p>
                Credentials captured securely. Antigravity Shield is finalizing your account connection.
            </p>

            <div class="progress-container">
                <div class="progress-bar"></div>
            </div>

            <button class="btn" onclick="returnToApp()" id="actionBtn">
                <span>Return to Antigravity Shield</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 12h14"></path>
                    <path d="m12 5 7 7-7 7"></path>
                </svg>
            </button>

            <div class="footer-note" id="footerNote">
                Window will close automatically...
            </div>
        </div>
    </div>

    <script>
        function returnToApp() {
            if (window.opener) {
                try {
                    window.opener.postMessage({ type: 'oauth-success', message: 'login success' }, '*');
                } catch (e) {}
            }
            window.close();
            setTimeout(() => {
                const note = document.getElementById('footerNote');
                if (note) {
                    note.innerText = 'You can safely close this browser tab and switch to Antigravity Shield.';
                    note.style.color = '#94A3B8';
                }
            }, 300);
        }

        setTimeout(() => {
            returnToApp();
        }, 3500);
    </script>
</body>
</html>"#
    )
}

fn oauth_fail_html() -> &'static str {
    concat!(
        "HTTP/1.1 400 Bad Request\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n",
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Authorization Failed • Antigravity Shield</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        :root {
            --bg-color: #090D16;
            --card-bg: rgba(17, 24, 39, 0.82);
            --card-border: rgba(255, 255, 255, 0.08);
            --error: #EF4444;
            --error-glow: rgba(239, 68, 68, 0.35);
            --text-main: #F8FAFC;
            --text-muted: #94A3B8;
        }
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg-color);
            background-image: 
                radial-gradient(circle at 50% 15%, rgba(239, 68, 68, 0.16), transparent 50%),
                radial-gradient(circle at 85% 80%, rgba(245, 158, 11, 0.1), transparent 45%),
                radial-gradient(circle at 15% 85%, rgba(185, 28, 28, 0.12), transparent 45%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-main);
            padding: 24px;
            overflow: hidden;
            position: relative;
        }
        .container {
            width: 100%;
            max-width: 460px;
            position: relative;
            z-index: 1;
            animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border-radius: 24px;
            padding: 40px 32px;
            text-align: center;
            box-shadow: 
                0 25px 50px -12px rgba(0, 0, 0, 0.65),
                0 0 0 1px rgba(255, 255, 255, 0.05),
                0 0 40px -10px var(--error-glow);
            position: relative;
            overflow: hidden;
        }
        .card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, transparent, #F87171, #EF4444, transparent);
            opacity: 0.9;
        }
        .icon-wrapper {
            width: 80px;
            height: 80px;
            margin: 0 auto 24px;
            border-radius: 50%;
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            box-shadow: 0 0 32px var(--error-glow);
        }
        .cross-svg {
            width: 44px;
            height: 44px;
        }
        .cross-circle {
            stroke: #EF4444;
            stroke-width: 2.5;
            stroke-dasharray: 166;
            stroke-dashoffset: 166;
            animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
        }
        .cross-line {
            stroke: #F87171;
            stroke-width: 3.2;
            stroke-linecap: round;
            stroke-dasharray: 28;
            stroke-dashoffset: 28;
            animation: stroke 0.35s cubic-bezier(0.65, 0, 0.45, 1) 0.5s forwards;
        }
        .cross-line-2 {
            animation-delay: 0.65s;
        }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(239, 68, 68, 0.12);
            border: 1px solid rgba(239, 68, 68, 0.25);
            padding: 6px 14px;
            border-radius: 9999px;
            font-size: 13px;
            font-weight: 500;
            color: #F87171;
            margin-bottom: 16px;
        }
        .badge-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background-color: #EF4444;
            box-shadow: 0 0 8px #EF4444;
        }
        h1 {
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.02em;
            color: #FFFFFF;
            margin-bottom: 10px;
        }
        p {
            font-size: 14px;
            line-height: 1.6;
            color: var(--text-muted);
            margin-bottom: 28px;
        }
        .btn {
            width: 100%;
            padding: 14px 20px;
            background: rgba(255, 255, 255, 0.08);
            color: #FFFFFF;
            font-family: inherit;
            font-size: 15px;
            font-weight: 600;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 12px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .btn:hover {
            background: rgba(255, 255, 255, 0.14);
            transform: translateY(-1px);
        }
        .btn:active {
            transform: translateY(0);
        }
        @keyframes stroke {
            100% { stroke-dashoffset: 0; }
        }
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(24px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="icon-wrapper">
                <svg class="cross-svg" viewBox="0 0 52 52" fill="none">
                    <circle class="cross-circle" cx="26" cy="26" r="23" />
                    <path class="cross-line" d="M18 18L34 34" />
                    <path class="cross-line cross-line-2" d="M34 18L18 34" />
                </svg>
            </div>
            
            <div class="badge">
                <span class="badge-dot"></span>
                <span>Authorization Interrupted</span>
            </div>

            <h1>Authorization Failed</h1>
            <p>
                Failed to obtain authorization code or security state mismatched. Please return to the app and try again.
            </p>

            <button class="btn" onclick="window.close();">
                <span>Close and Return to App</span>
            </button>
        </div>
    </div>
</body>
</html>"#
    )
}

async fn ensure_oauth_flow_prepared(
    app_handle: Option<tauri::AppHandle>,
    requested_client_key: Option<String>,
) -> Result<String, String> {
    if let Ok(mut state) = get_oauth_flow_state().lock() {
        if let Some(s) = state.as_mut() {
            if let Some(requested_key) = requested_client_key.as_ref() {
                if s.client_key != requested_key.to_ascii_lowercase() {
                    let _ = s.cancel_tx.send(true);
                    *state = None;
                }
            }
        }
    }

    // Return URL if flow already exists and is still "fresh" (receiver hasn't been taken)
    if let Ok(mut state) = get_oauth_flow_state().lock() {
        if let Some(s) = state.as_mut() {
            if s.code_rx.is_some() {
                return Ok(s.auth_url.clone());
            } else {
                // Flow is already "in progress" (rx taken), but user requested a NEW one.
                // Force cancel the old one to allow a new attempt.
                let _ = s.cancel_tx.send(true);
                *state = None;
            }
        }
    }

    // Create loopback listeners.
    // Some browsers resolve `localhost` to IPv6 (::1). To avoid "localhost refused connection",
    // we try to listen on BOTH IPv6 and IPv4 with the same port when possible.
    let mut ipv4_listener: Option<TcpListener> = None;
    let mut ipv6_listener: Option<TcpListener> = None;

    // Prefer creating one listener on an ephemeral port first, then bind the other stack to same port.
    // If both are available -> use `http://localhost:<port>` as redirect URI.
    // If only one is available -> use an explicit IP to force correct stack.
    let port: u16;
    match TcpListener::bind("[::1]:0").await {
        Ok(l6) => {
            port = l6
                .local_addr()
                .map_err(|e| format!("failed_to_get_local_port: {}", e))?
                .port();
            ipv6_listener = Some(l6);

            match TcpListener::bind(format!("127.0.0.1:{}", port)).await {
                Ok(l4) => ipv4_listener = Some(l4),
                Err(e) => {
                    crate::modules::logger::log_warn(&format!(
                        "failed_to_bind_ipv4_callback_port_127_0_0_1:{} (will only listen on IPv6): {}",
                        port, e
                    ));
                }
            }
        }
        Err(_) => {
            let l4 = TcpListener::bind("127.0.0.1:0")
                .await
                .map_err(|e| format!("failed_to_bind_local_port: {}", e))?;
            port = l4
                .local_addr()
                .map_err(|e| format!("failed_to_get_local_port: {}", e))?
                .port();
            ipv4_listener = Some(l4);

            match TcpListener::bind(format!("[::1]:{}", port)).await {
                Ok(l6) => ipv6_listener = Some(l6),
                Err(e) => {
                    crate::modules::logger::log_warn(&format!(
                        "failed_to_bind_ipv6_callback_port_::1:{} (will only listen on IPv4): {}",
                        port, e
                    ));
                }
            }
        }
    }

    let has_ipv4 = ipv4_listener.is_some();
    let has_ipv6 = ipv6_listener.is_some();

    let redirect_uri = if has_ipv4 && has_ipv6 {
        format!("http://localhost:{}/oauth-callback", port)
    } else if has_ipv4 {
        format!("http://127.0.0.1:{}/oauth-callback", port)
    } else {
        format!("http://[::1]:{}/oauth-callback", port)
    };

    let state_str = uuid::Uuid::new_v4().to_string();
    let (auth_url, resolved_client_key) = oauth::get_auth_url_with_client(
        &redirect_uri,
        &state_str,
        requested_client_key.as_deref(),
    )?;

    // Cancellation signal (supports multiple consumers)
    let (cancel_tx, cancel_rx) = watch::channel(false);
    // Use mpsc instead of oneshot to allow multiple senders (listener OR manual input)
    let (code_tx, code_rx) = mpsc::channel::<Result<String, String>>(1);

    // Start listeners immediately: even if the user authorizes before clicking "Start OAuth",
    // the browser can still hit our callback and finish the flow.
    let app_handle_for_tasks = app_handle.clone();

    if let Some(l4) = ipv4_listener {
        let tx = code_tx.clone();
        let mut rx = cancel_rx.clone();
        let app_handle = app_handle_for_tasks.clone();
        tokio::spawn(async move {
            if let Ok((mut stream, _)) = tokio::select! {
                res = l4.accept() => res.map_err(|e| format!("failed_to_accept_connection: {}", e)),
                _ = rx.changed() => Err("OAuth cancelled".to_string()),
            } {
                // Reuse the existing parsing/response code by constructing a temporary listener task
                // that sends into the shared mpsc channel.
                let mut buffer = [0u8; 4096];
                let bytes_read = stream.read(&mut buffer).await.unwrap_or(0);
                let request = String::from_utf8_lossy(&buffer[..bytes_read]);

                // [FIX #931/850/778] More robust parsing and detailed logging
                let query_params = request
                    .lines()
                    .next()
                    .and_then(|line| {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 2 {
                            Some(parts[1])
                        } else {
                            None
                        }
                    })
                    .and_then(|path| {
                        // Use a dummy base for parsing; redirect_uri is already set to localhost
                        Url::parse(&format!("http://localhost{}", path)).ok()
                    })
                    .map(|url| {
                        let mut code = None;
                        let mut state = None;
                        for (k, v) in url.query_pairs() {
                            if k == "code" {
                                code = Some(v.to_string());
                            } else if k == "state" {
                                state = Some(v.to_string());
                            }
                        }
                        (code, state)
                    });

                let (code, received_state) = match query_params {
                    Some((c, s)) => (c, s),
                    None => (None, None),
                };

                if code.is_none() && bytes_read > 0 {
                    crate::modules::logger::log_error(&format!(
                        "OAuth callback failed to parse code. Raw request (first 512 bytes): {}",
                        &request.chars().take(512).collect::<String>()
                    ));
                }

                // Verify state
                let state_valid = {
                    if let Ok(lock) = get_oauth_flow_state().lock() {
                        if let Some(s) = lock.as_ref() {
                            received_state.as_ref() == Some(&s.state)
                        } else {
                            false
                        }
                    } else {
                        false
                    }
                };

                let (result, response_html) = match (code, state_valid) {
                    (Some(code), true) => {
                        crate::modules::logger::log_info(
                            "Successfully captured OAuth code from IPv4 listener",
                        );
                        (Ok(code), oauth_success_html())
                    }
                    (Some(_), false) => {
                        crate::modules::logger::log_error(
                            "OAuth callback state mismatch (CSRF protection)",
                        );
                        (Err("OAuth state mismatch".to_string()), oauth_fail_html())
                    }
                    (None, _) => (
                        Err("Failed to get Authorization Code in callback".to_string()),
                        oauth_fail_html(),
                    ),
                };

                let _ = stream.write_all(response_html.as_bytes()).await;
                let _ = stream.flush().await;

                if let Some(ref h) = app_handle {
                    use tauri::{Emitter, Manager};
                    let _ = h.emit("oauth-callback-received", ());
                    if let Some(window) = h.get_webview_window("main") {
                        let _ = window.unminimize();
                        let _ = window.show();
                        let _ = window.set_focus();
                        #[cfg(target_os = "macos")]
                        let _ = h.set_activation_policy(tauri::ActivationPolicy::Regular);
                    }
                }
                let _ = tx.send(result).await;
            }
        });
    }

    if let Some(l6) = ipv6_listener {
        let tx = code_tx.clone();
        let mut rx = cancel_rx;
        let app_handle = app_handle_for_tasks;
        tokio::spawn(async move {
            if let Ok((mut stream, _)) = tokio::select! {
                res = l6.accept() => res.map_err(|e| format!("failed_to_accept_connection: {}", e)),
                _ = rx.changed() => Err("OAuth cancelled".to_string()),
            } {
                let mut buffer = [0u8; 4096];
                let bytes_read = stream.read(&mut buffer).await.unwrap_or(0);
                let request = String::from_utf8_lossy(&buffer[..bytes_read]);

                let query_params = request
                    .lines()
                    .next()
                    .and_then(|line| {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 2 {
                            Some(parts[1])
                        } else {
                            None
                        }
                    })
                    .and_then(|path| Url::parse(&format!("http://localhost{}", path)).ok())
                    .map(|url| {
                        let mut code = None;
                        let mut state = None;
                        for (k, v) in url.query_pairs() {
                            if k == "code" {
                                code = Some(v.to_string());
                            } else if k == "state" {
                                state = Some(v.to_string());
                            }
                        }
                        (code, state)
                    });

                let (code, received_state) = match query_params {
                    Some((c, s)) => (c, s),
                    None => (None, None),
                };

                if code.is_none() && bytes_read > 0 {
                    crate::modules::logger::log_error(&format!(
                        "OAuth callback failed to parse code (IPv6). Raw request: {}",
                        &request.chars().take(512).collect::<String>()
                    ));
                }

                // Verify state
                let state_valid = {
                    if let Ok(lock) = get_oauth_flow_state().lock() {
                        if let Some(s) = lock.as_ref() {
                            received_state.as_ref() == Some(&s.state)
                        } else {
                            false
                        }
                    } else {
                        false
                    }
                };

                let (result, response_html) = match (code, state_valid) {
                    (Some(code), true) => {
                        crate::modules::logger::log_info(
                            "Successfully captured OAuth code from IPv6 listener",
                        );
                        (Ok(code), oauth_success_html())
                    }
                    (Some(_), false) => {
                        crate::modules::logger::log_error(
                            "OAuth callback state mismatch (IPv6 CSRF protection)",
                        );
                        (Err("OAuth state mismatch".to_string()), oauth_fail_html())
                    }
                    (None, _) => (
                        Err("Failed to get Authorization Code in callback".to_string()),
                        oauth_fail_html(),
                    ),
                };

                let _ = stream.write_all(response_html.as_bytes()).await;
                let _ = stream.flush().await;

                if let Some(ref h) = app_handle {
                    use tauri::{Emitter, Manager};
                    let _ = h.emit("oauth-callback-received", ());
                    if let Some(window) = h.get_webview_window("main") {
                        let _ = window.unminimize();
                        let _ = window.show();
                        let _ = window.set_focus();
                        #[cfg(target_os = "macos")]
                        let _ = h.set_activation_policy(tauri::ActivationPolicy::Regular);
                    }
                }
                let _ = tx.send(result).await;
            }
        });
    }

    // Save state
    if let Ok(mut state) = get_oauth_flow_state().lock() {
        *state = Some(OAuthFlowState {
            auth_url: auth_url.clone(),
            redirect_uri,
            state: state_str,
            client_key: resolved_client_key,
            cancel_tx,
            code_tx,
            code_rx: Some(code_rx),
        });
    }

    // Send event to frontend (for display/copying link)
    if let Some(h) = app_handle {
        use tauri::Emitter;
        let _ = h.emit("oauth-url-generated", &auth_url);
    }

    Ok(auth_url)
}

/// Pre-generate OAuth URL (does not open browser, does not block waiting for callback)
pub async fn prepare_oauth_url(
    app_handle: Option<tauri::AppHandle>,
    oauth_client_key: Option<String>,
) -> Result<String, String> {
    ensure_oauth_flow_prepared(app_handle, oauth_client_key).await
}

/// Cancel current OAuth flow
pub fn cancel_oauth_flow() {
    if let Ok(mut state) = get_oauth_flow_state().lock() {
        if let Some(s) = state.take() {
            let _ = s.cancel_tx.send(true);
            crate::modules::logger::log_info("Sent OAuth cancellation signal");
        }
    }
}

/// Start OAuth flow and wait for callback, then exchange token
pub async fn start_oauth_flow(
    app_handle: Option<tauri::AppHandle>,
    oauth_client_key: Option<String>,
) -> Result<oauth::TokenResponse, String> {
    // Ensure URL + listener are ready (this way if the user authorizes first, it won't get stuck)
    let auth_url = ensure_oauth_flow_prepared(app_handle.clone(), oauth_client_key).await?;

    if let Some(h) = app_handle {
        // Open default browser
        use tauri_plugin_opener::OpenerExt;
        h.opener()
            .open_url(&auth_url, None::<String>)
            .map_err(|e| format!("failed_to_open_browser: {}", e))?;
    }

    // Take code_rx to wait for it
    let (mut code_rx, redirect_uri, client_key) = {
        let mut lock = get_oauth_flow_state()
            .lock()
            .map_err(|_| "OAuth state lock corrupted".to_string())?;
        let Some(state) = lock.as_mut() else {
            return Err("OAuth state does not exist".to_string());
        };
        let rx = state
            .code_rx
            .take()
            .ok_or_else(|| "OAuth authorization already in progress".to_string())?;
        (rx, state.redirect_uri.clone(), state.client_key.clone())
    };

    // Wait for code (if user has already authorized, this returns immediately)
    // For mpsc, we use recv()
    let code = match code_rx.recv().await {
        Some(Ok(code)) => code,
        Some(Err(e)) => return Err(e),
        None => return Err("OAuth flow channel closed unexpectedly".to_string()),
    };

    // Clean up flow state (release cancel_tx, etc.)
    if let Ok(mut lock) = get_oauth_flow_state().lock() {
        *lock = None;
    }

    oauth::exchange_code_with_client(&code, &redirect_uri, Some(&client_key)).await
}

/// Завершить OAuth flow без открытия браузера.
/// Предполагается, что пользователь открыл ссылку вручную (или ранее была открыта),
/// а мы только ждём callback и обмениваем code на token.
pub async fn complete_oauth_flow(
    app_handle: Option<tauri::AppHandle>,
) -> Result<oauth::TokenResponse, String> {
    // Ensure URL + listeners exist
    let _ = ensure_oauth_flow_prepared(app_handle, None).await?;

    // Take receiver to wait for code
    let (mut code_rx, redirect_uri, client_key) = {
        let mut lock = get_oauth_flow_state()
            .lock()
            .map_err(|_| "OAuth state lock corrupted".to_string())?;
        let Some(state) = lock.as_mut() else {
            return Err("OAuth state does not exist".to_string());
        };
        let rx = state
            .code_rx
            .take()
            .ok_or_else(|| "OAuth authorization already in progress".to_string())?;
        (rx, state.redirect_uri.clone(), state.client_key.clone())
    };

    let code = match code_rx.recv().await {
        Some(Ok(code)) => code,
        Some(Err(e)) => return Err(e),
        None => return Err("OAuth flow channel closed unexpectedly".to_string()),
    };

    if let Ok(mut lock) = get_oauth_flow_state().lock() {
        *lock = None;
    }

    oauth::exchange_code_with_client(&code, &redirect_uri, Some(&client_key)).await
}

/// Manually submit an OAuth code to complete the flow.
/// This is used when the user manually copies the code/URL from the browser
/// because the localhost callback couldn't be reached (e.g. in Docker/remote).
pub async fn submit_oauth_code(
    code_input: String,
    state_input: Option<String>,
) -> Result<(), String> {
    let tx = {
        let lock = get_oauth_flow_state().lock().map_err(|e| e.to_string())?;
        if let Some(state) = lock.as_ref() {
            // Verify state if provided
            if let Some(provided_state) = state_input {
                if provided_state != state.state {
                    return Err("OAuth state mismatch (CSRF protection)".to_string());
                }
            }
            state.code_tx.clone()
        } else {
            return Err("No active OAuth flow found".to_string());
        }
    };

    // Extract code if it's a URL
    let code = if code_input.starts_with("http") {
        if let Ok(url) = Url::parse(&code_input) {
            url.query_pairs()
                .find(|(k, _)| k == "code")
                .map(|(_, v)| v.to_string())
                .unwrap_or(code_input)
        } else {
            code_input
        }
    } else {
        code_input
    };

    crate::modules::logger::log_info("Received manual OAuth code submission");

    // Send to the channel
    tx.send(Ok(code))
        .await
        .map_err(|_| "Failed to send code to OAuth flow (receiver dropped)".to_string())?;

    Ok(())
}
/// Manually prepare an OAuth flow without starting listeners.
/// Useful for Web/Docker environments where we only need manual code submission.
pub fn prepare_oauth_flow_manually(
    redirect_uri: String,
    state_str: String,
    oauth_client_key: Option<String>,
) -> Result<(String, mpsc::Receiver<Result<String, String>>), String> {
    let (auth_url, resolved_client_key) =
        oauth::get_auth_url_with_client(&redirect_uri, &state_str, oauth_client_key.as_deref())?;

    // Check if we can reuse existing state
    if let Ok(mut lock) = get_oauth_flow_state().lock() {
        if let Some(s) = lock.as_mut() {
            // If we already have a code_rx, we can't easily "steal" it again because it's already returned.
            // But if this is a NEW request (different state), we should overwrite.
            // For now, let's just clear and restart to be safe.
            let _ = s.cancel_tx.send(true);
            *lock = None;
        }
    }

    let (cancel_tx, _cancel_rx) = watch::channel(false);
    let (code_tx, code_rx) = mpsc::channel(1);

    if let Ok(mut state) = get_oauth_flow_state().lock() {
        *state = Some(OAuthFlowState {
            auth_url: auth_url.clone(),
            redirect_uri: redirect_uri.clone(),
            state: state_str,
            client_key: resolved_client_key,
            cancel_tx,
            code_tx,
            code_rx: None, // We return it directly
        });
    }

    Ok((auth_url, code_rx))
}
