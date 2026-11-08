import urllib.request, json, asyncio, re, os

try:
    import websockets
except ImportError:
    os.system('pip install websockets')
    import websockets

async def inject():
    port_file = os.path.expandvars(r"%APPDATA%\Antigravity\DevToolsActivePort")
    if not os.path.exists(port_file):
        print("DevToolsActivePort not found")
        return
    with open(port_file, 'r') as f:
        port = int(f.readline().strip())
    print("Connecting to DevTools port:", port)

    url = f"http://127.0.0.1:{port}/json"
    with urllib.request.urlopen(url) as resp:
        targets = json.loads(resp.read().decode())
    
    with open('src-tauri/src/commands/patch.rs', 'r', encoding='utf-8') as f:
        patch_rs = f.read()
    m = re.search(r'pub const VAZIRMATN_RTL_CSS: &str = r#"(.*?)"#;', patch_rs, re.DOTALL)
    css = m.group(1).strip()
    escaped_css = css.replace('\\', '\\\\').replace('`', '\\`').replace('$', '\\$')

    # Read platform_cdp.rs for the full JS injection
    with open('src-tauri/src/modules/platform_cdp.rs', 'r', encoding='utf-8') as f:
        cdp_code = f.read()
    
    # Extract the JS block inside format!(r##" ... "##, escaped_css, escaped_css)
    js_start = cdp_code.find('r##"\n(() => {')
    js_end = cdp_code.find('"##,\n        escaped_css, escaped_css\n    );')
    if js_start != -1 and js_end != -1:
        raw_template = cdp_code[js_start+4:js_end]
        # Replace {{ with { and }} with }
        raw_template = raw_template.replace('{{', '{').replace('}}', '}')
        # Replace {} with escaped_css
        full_js = raw_template.replace('{}', escaped_css)
    else:
        full_js = f"""
        (() => {{
            let style = document.getElementById('antigravity-shield-platform-rtl');
            if (!style) {{
                style = document.createElement('style');
                style.id = 'antigravity-shield-platform-rtl';
                document.head.appendChild(style);
            }}
            style.textContent = `{escaped_css}`;
            console.log('[Antigravity-Shield] Injected!');
        }})();
        """

    injected = 0
    for t in targets:
        t_type = t.get('type')
        t_url = t.get('url', '')
        ws_url = t.get('webSocketDebuggerUrl')
        if ws_url and (t_type in ('page', 'webview') or '127.0.0.1' in t_url):
            try:
                async with websockets.connect(ws_url) as ws:
                    msg = {
                        'id': 1,
                        'method': 'Runtime.evaluate',
                        'params': { 'expression': full_js, 'userGesture': True, 'awaitPromise': True }
                    }
                    await ws.send(json.dumps(msg))
                    res = await ws.recv()
                    data = json.loads(res)
                    if 'error' in data:
                        print(f"Error on {t.get('title')}: {data['error']}")
                    else:
                        print(f"Successfully injected into: {t.get('title')} ({t.get('url')[:60]})")
                        injected += 1
            except Exception as e:
                print(f"Failed on {t.get('title')}: {e}")
    print(f"Total injected targets: {injected}")

if __name__ == '__main__':
    asyncio.run(inject())
