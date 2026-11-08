import os
import sys
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')

IDE_APP_DIR = r"C:\Users\ersha\AppData\Local\Programs\Antigravity IDE\resources\app"
WORKBENCH_CSS_PATH = os.path.join(IDE_APP_DIR, "out", "vs", "workbench", "workbench.desktop.main.css")
SENTINEL_JS_PATH = os.path.join(IDE_APP_DIR, "out", "vs", "code", "electron-browser", "workbench", "workbench.js")

with open(WORKBENCH_CSS_PATH, 'r', encoding='utf-8') as f:
    css_content = f.read()

with open(SENTINEL_JS_PATH, 'r', encoding='utf-8') as f:
    js_content = f.read()

idx = js_content.find("// [Antigravity-Shield-IDE-BiDi-Sentinel]")
sentinel_code = js_content[idx:]

HTML_TEMPLATE = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    :root {{
      --vscode-sideBar-background: #181818;
      --vscode-auxiliaryBar-background: #1e1e1e;
      --monaco-monospace-font: 'Cascadia Code', Consolas, monospace;
    }}
    body {{
      margin: 0; padding: 0; background: #1e1e1e; color: #ccc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }}
  </style>
  <style id="workbench-css">{css_content}</style>
</head>
<body>
  <div class="monaco-workbench windows">
    <!-- Explorer Sidebar -->
    <div class="part sidebar" id="sidebar">
      <div class="monaco-list-row" id="row-en"><span class="label-name">index.ts</span></div>
    </div>
    <!-- Editor Part -->
    <div class="part editor" id="editor">
      <div class="monaco-editor" id="monaco">
        <div class="view-lines"><div class="view-line" id="line-en"><span>const a = 1;</span></div></div>
      </div>
    </div>
    <!-- Chat Pane -->
    <div class="part auxiliarybar" data-aux-pane-open="true">
      <div data-testid="autoscroll-viewport" id="viewport">
        <div data-testid="conversation-view" id="chat" dir="auto">
          <div data-testid="chat-message" class="chat-message" id="msg1">
            <div role="article" dir="auto">
              <div class="leading-relaxed rendered-markdown prose" dir="auto">
                <p dir="auto" id="p1">Initial English Text</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <script>{sentinel_code}</script>
</body>
</html>"""

def run_adversarial_mutations():
    print("=================================================================")
    print("   ADVERSARIAL DYNAMIC MUTATION & BOUNDARY RESILIENCE HARNESS   ")
    print("=================================================================")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1200, "height": 800})
        page.set_content(HTML_TEMPLATE, wait_until="networkidle")
        page.wait_for_timeout(500)

        # 1. Baseline Body Check
        body_dir = page.evaluate("() => window.getComputedStyle(document.body).direction")
        body_attr = page.evaluate("() => document.body.getAttribute('dir')")
        print(f"[TEST 1] Baseline Body: direction={body_dir}, dirAttr={body_attr}")
        assert body_dir == 'ltr' and body_attr != 'rtl', "Baseline body corrupted!"

        # 2. Dynamic injection of Persian row in Explorer Sidebar
        page.evaluate("""() => {
            const sidebar = document.getElementById('sidebar');
            const newRow = document.createElement('div');
            newRow.className = 'monaco-list-row';
            newRow.id = 'row-fa';
            newRow.innerHTML = '<span class="label-name">پروژه-جدید.rs</span>';
            sidebar.appendChild(newRow);
        }""")
        page.wait_for_timeout(400)
        row_fa_dir = page.evaluate("() => window.getComputedStyle(document.getElementById('row-fa')).direction")
        sidebar_dir = page.evaluate("() => window.getComputedStyle(document.getElementById('sidebar')).direction")
        body_dir = page.evaluate("() => window.getComputedStyle(document.body).direction")
        print(f"[TEST 2] Sidebar Persian item: dir={row_fa_dir}, sidebar_dir={sidebar_dir}, body_dir={body_dir}")
        assert sidebar_dir == 'ltr', "Sidebar direction leaked to RTL!"
        assert body_dir == 'ltr', "Body corrupted after sidebar insertion!"

        # 3. Dynamic injection of Persian line in Monaco Editor
        page.evaluate("""() => {
            const lines = document.querySelector('#monaco .view-lines');
            const newLine = document.createElement('div');
            newLine.className = 'view-line';
            newLine.id = 'line-fa';
            newLine.innerHTML = '<span>// این یک کامنت تستی به زبان فارسی است</span>';
            lines.appendChild(newLine);
        }""")
        page.wait_for_timeout(400)
        line_fa_dir = page.evaluate("() => window.getComputedStyle(document.getElementById('line-fa')).direction")
        editor_dir = page.evaluate("() => window.getComputedStyle(document.getElementById('editor')).direction")
        body_dir = page.evaluate("() => window.getComputedStyle(document.body).direction")
        print(f"[TEST 3] Editor Persian line: dir={line_fa_dir}, editor_dir={editor_dir}, body_dir={body_dir}")
        assert line_fa_dir == 'ltr', "Monaco editor line corrupted to RTL!"
        assert editor_dir == 'ltr', "Editor part corrupted to RTL!"
        assert body_dir == 'ltr', "Body corrupted after editor insertion!"

        # 4. Dynamic injection of Persian Message in Chat Pane
        page.evaluate("""() => {
            const chat = document.getElementById('chat');
            const newMsg = document.createElement('div');
            newMsg.setAttribute('data-testid', 'chat-message');
            newMsg.className = 'chat-message';
            newMsg.id = 'msg-dyn-fa';
            newMsg.innerHTML = '<div role="article" dir="auto"><div class="leading-relaxed rendered-markdown prose" dir="auto"><p dir="auto" id="p-dyn-fa">پاسخ هوش مصنوعی به زبان شیرین فارسی برای تست مرزها.</p></div></div>';
            chat.appendChild(newMsg);
        }""")
        page.wait_for_timeout(600)
        p_dyn_fa_dir = page.evaluate("() => window.getComputedStyle(document.getElementById('p-dyn-fa')).direction")
        chat_dir = page.evaluate("() => window.getComputedStyle(document.getElementById('chat')).direction")
        body_dir = page.evaluate("() => window.getComputedStyle(document.body).direction")
        body_attr = page.evaluate("() => document.body.getAttribute('dir')")
        print(f"[TEST 4] Dynamic Chat Persian msg: dir={p_dyn_fa_dir}, chat_container_dir={chat_dir}, body_dir={body_dir}, body_attr={body_attr}")
        assert p_dyn_fa_dir == 'rtl', f"Chat Persian text should be RTL, got {p_dyn_fa_dir}"
        assert body_dir == 'ltr', "Body corrupted after chat Persian message!"
        assert body_attr != 'rtl', "Body dir attribute corrupted!"

        # 5. Dynamic injection of Pure English Message in Chat Pane after Persian
        page.evaluate("""() => {
            const chat = document.getElementById('chat');
            const newMsg = document.createElement('div');
            newMsg.setAttribute('data-testid', 'chat-message');
            newMsg.className = 'chat-message';
            newMsg.id = 'msg-dyn-en';
            newMsg.innerHTML = '<div role="article" dir="auto"><div class="leading-relaxed rendered-markdown prose" dir="auto"><p dir="auto" id="p-dyn-en">Subsequent English message: system status healthy.</p></div></div>';
            chat.appendChild(newMsg);
        }""")
        page.wait_for_timeout(600)
        p_dyn_en_dir = page.evaluate("() => window.getComputedStyle(document.getElementById('p-dyn-en')).direction")
        p_dyn_en_align = page.evaluate("() => window.getComputedStyle(document.getElementById('p-dyn-en')).textAlign")
        print(f"[TEST 5] Dynamic Chat English msg: dir={p_dyn_en_dir}, align={p_dyn_en_align}")
        assert p_dyn_en_dir == 'ltr', f"English message should be LTR, got {p_dyn_en_dir}"
        assert p_dyn_en_align in ['start', 'left'], f"English message should align start/left, got {p_dyn_en_align}"

        # 6. Dynamic User Input Step (English Bubble)
        page.evaluate("""() => {
            const chat = document.getElementById('chat');
            const userStep = document.createElement('div');
            userStep.setAttribute('data-testid', 'user-input-step');
            userStep.id = 'user-step-dyn-en';
            userStep.innerHTML = '<div data-testid="user-message-bubble" id="bubble-dyn-en" dir="auto"><div class="whitespace-pre-wrap text-sm">Please analyze the codebase git commit history.</div></div>';
            chat.appendChild(userStep);
        }""")
        page.wait_for_timeout(600)
        bubble_en_dir = page.evaluate("() => window.getComputedStyle(document.getElementById('bubble-dyn-en')).direction")
        bubble_en_align = page.evaluate("() => window.getComputedStyle(document.getElementById('bubble-dyn-en')).textAlign")
        print(f"[TEST 6] Dynamic English User Bubble: dir={bubble_en_dir}, align={bubble_en_align}")
        assert bubble_en_dir == 'ltr', f"English bubble should be LTR, got {bubble_en_dir}"
        assert bubble_en_align in ['start', 'left'], f"English bubble should align start/left, got {bubble_en_align}"

        # 7. Dynamic User Input Step (Persian Bubble)
        page.evaluate("""() => {
            const chat = document.getElementById('chat');
            const userStep = document.createElement('div');
            userStep.setAttribute('data-testid', 'user-input-step');
            userStep.id = 'user-step-dyn-fa';
            userStep.innerHTML = '<div data-testid="user-message-bubble" id="bubble-dyn-fa" dir="auto"><div class="whitespace-pre-wrap text-sm">لطفاً آخرین تغییرات را بررسی و تایید کن.</div></div>';
            chat.appendChild(userStep);
        }""")
        page.wait_for_timeout(600)
        bubble_fa_dir = page.evaluate("() => window.getComputedStyle(document.getElementById('bubble-dyn-fa')).direction")
        bubble_fa_align = page.evaluate("() => window.getComputedStyle(document.getElementById('bubble-dyn-fa')).textAlign")
        print(f"[TEST 7] Dynamic Persian User Bubble: dir={bubble_fa_dir}, align={bubble_fa_align}")
        assert bubble_fa_dir == 'rtl', f"Persian bubble should be RTL, got {bubble_fa_dir}"
        assert bubble_fa_align in ['right', 'start'], f"Persian bubble should align right, got {bubble_fa_align}"

        # 8. Container Scope Inversion Immunity Check
        containers = ['chat', 'viewport', 'msg-dyn-fa', 'msg-dyn-en']
        for cid in containers:
            c_dir = page.evaluate(f"() => window.getComputedStyle(document.getElementById('{cid}')).direction")
            c_style = page.evaluate(f"() => document.getElementById('{cid}').getAttribute('style') || ''")
            assert 'direction: rtl' not in c_style, f"Container {cid} acquired inline direction: rtl!"
            print(f"[TEST 8] Container {cid}: computed dir={c_dir}, style='{c_style}'")

        # 9. Final Document Body & Shell Check
        final_body_dir = page.evaluate("() => window.getComputedStyle(document.body).direction")
        final_body_attr = page.evaluate("() => document.body.getAttribute('dir')")
        final_sidebar_dir = page.evaluate("() => window.getComputedStyle(document.getElementById('sidebar')).direction")
        final_editor_dir = page.evaluate("() => window.getComputedStyle(document.getElementById('editor')).direction")
        print(f"[TEST 9] Final Shell Isolation: Body dir={final_body_dir}, Body attr={final_body_attr}, Sidebar dir={final_sidebar_dir}, Editor dir={final_editor_dir}")
        assert final_body_dir == 'ltr' and final_body_attr != 'rtl', "Body corrupted at end of test!"
        assert final_sidebar_dir == 'ltr', "Sidebar corrupted at end of test!"
        assert final_editor_dir == 'ltr', "Editor corrupted at end of test!"

        browser.close()

    print("=================================================================")
    print("   ALL 9 ADVERSARIAL DYNAMIC MUTATION STRESS CHECKS PASSED!      ")
    print("=================================================================")

if __name__ == '__main__':
    run_adversarial_mutations()
