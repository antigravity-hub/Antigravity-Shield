import os
import sys
import json
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
IDE_APP_DIR = r"C:\Users\ersha\AppData\Local\Programs\Antigravity IDE\resources\app"
WORKBENCH_CSS_PATH = os.path.join(IDE_APP_DIR, "out", "vs", "workbench", "workbench.desktop.main.css")
SENTINEL_JS_PATH = os.path.join(IDE_APP_DIR, "out", "vs", "code", "electron-browser", "workbench", "workbench.js")

if not os.path.exists(WORKBENCH_CSS_PATH):
    print(f"ERROR: Cannot find {WORKBENCH_CSS_PATH}")
    sys.exit(1)

with open(WORKBENCH_CSS_PATH, 'r', encoding='utf-8') as f:
    css_content = f.read()

sentinel_code = ""
if os.path.exists(SENTINEL_JS_PATH):
    with open(SENTINEL_JS_PATH, 'r', encoding='utf-8') as f:
        js_content = f.read()
    if "// [Antigravity-Shield-IDE-BiDi-Sentinel]" in js_content:
        idx = js_content.find("// [Antigravity-Shield-IDE-BiDi-Sentinel]")
        sentinel_code = js_content[idx:]

HTML_TEMPLATE = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>BiDi & Layout Boundary Stress Test</title>
  <style>
    :root {{
      --vscode-sideBar-background: #181818;
      --vscode-auxiliaryBar-background: #1e1e1e;
      --monaco-monospace-font: 'Cascadia Code', Consolas, monospace;
      --border: #93e9be;
    }}
    body {{
      margin: 0;
      padding: 0;
      background: #1e1e1e;
      color: #cccccc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }}
  </style>
  <style id="patched-workbench-css">
    {css_content}
  </style>
</head>
<body>
  <div class="monaco-workbench windows">
    <!-- 1. Left Explorer Sidebar (Must be preserved in LTR) -->
    <div class="part sidebar" id="explorer-sidebar">
      <div class="monaco-list-row" id="explorer-row-1">
        <span class="codicon codicon-file"></span>
        <span class="label-name" id="explorer-label-1">src/main.rs</span>
      </div>
      <div class="monaco-list-row" id="explorer-row-2">
        <span class="codicon codicon-folder"></span>
        <span class="label-name" id="explorer-label-2">assets/documents</span>
      </div>
    </div>

    <!-- 2. Center Editor (Tabs & Monaco Editor - Must be preserved in LTR) -->
    <div class="part editor" id="editor-part">
      <div class="tabs-container">
        <div class="tab active" id="editor-tab-1">
          <span class="tab-label" id="tab-label-1">integration.rs</span>
        </div>
      </div>
      <div class="monaco-editor" id="center-monaco-editor">
        <div class="view-lines">
          <div class="view-line" id="center-editor-line">
            <span>pub fn calculate_metrics(count: u64) -> f64 {{</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. Right Auxiliary Bar: Chat Pane Conversation View -->
    <div class="part auxiliarybar" data-aux-pane-open="true" data-aux-pane-focus-scope="true">
      <div data-testid="autoscroll-viewport" id="chat-autoscroll-viewport" style="height: 600px; width: 450px;">
        <div data-testid="conversation-view" id="conversation-view" dir="auto">
          
          <!-- Case 1: Pure English Agent Response -->
          <div data-testid="chat-message" class="chat-message" id="msg-pure-en">
            <div role="article" aria-label="Agent response" dir="auto" id="article-pure-en">
              <div class="leading-relaxed rendered-markdown prose" dir="auto" id="markdown-pure-en">
                <p dir="auto" id="p-pure-en">This is a pure English response paragraph analyzing system logs.</p>
              </div>
            </div>
          </div>

          <!-- Case 2: Pure Persian Agent Response -->
          <div data-testid="chat-message" class="chat-message" id="msg-pure-fa">
            <div role="article" aria-label="Agent response" dir="auto" id="article-pure-fa">
              <div class="leading-relaxed rendered-markdown prose" dir="auto" id="markdown-pure-fa">
                <p dir="auto" id="p-pure-fa">این یک پیام کاملاً فارسی برای تحلیل وضعیت سیستم است.</p>
              </div>
            </div>
          </div>

          <!-- Case 3: Mixed Text (Starts with English, contains Persian) -->
          <div data-testid="chat-message" class="chat-message" id="msg-mixed-en-first">
            <div role="article" aria-label="Agent response" dir="auto" id="article-mixed-en-first">
              <div class="leading-relaxed rendered-markdown prose" dir="auto">
                <p dir="auto" id="p-mixed-en-first">Status: فایل پیکربندی با موفقیت به‌روزرسانی شد.</p>
              </div>
            </div>
          </div>

          <!-- Case 4: Mixed Text (Starts with Persian, contains English) -->
          <div data-testid="chat-message" class="chat-message" id="msg-mixed-fa-first">
            <div role="article" aria-label="Agent response" dir="auto" id="article-mixed-fa-first">
              <div class="leading-relaxed rendered-markdown prose" dir="auto">
                <p dir="auto" id="p-mixed-fa-first">نتیجه اجرای دستور git status کاملاً صحیح بود.</p>
              </div>
            </div>
          </div>

          <!-- Case 5: Inline Code inside Persian Text -->
          <div data-testid="chat-message" class="chat-message" id="msg-inline-code">
            <div role="article" aria-label="Agent response" dir="auto">
              <div class="leading-relaxed rendered-markdown prose" dir="auto">
                <p dir="auto" id="p-inline-code">برای اجرای برنامه دستور <code id="inline-code-target">npm run build:prod --flag</code> را بزنید.</p>
              </div>
            </div>
          </div>

          <!-- Case 6: Multi-line Code Block inside Chat Pane -->
          <div data-testid="chat-message" class="chat-message" id="msg-code-block">
            <div role="article" aria-label="Agent response" dir="auto">
              <div class="leading-relaxed rendered-markdown prose" dir="auto">
                <pre id="pre-block"><code id="code-block">function calculateScore(items) {{
  return items.map(x => x * 2).filter(x => x > 0);
}}</code></pre>
              </div>
            </div>
          </div>

          <!-- Case 7: Embedded Monaco Editor inside Chat Pane -->
          <div data-testid="chat-message" class="chat-message" id="msg-chat-monaco">
            <div role="article" aria-label="Agent response" dir="auto">
              <div class="monaco-editor" id="chat-monaco-editor">
                <div class="view-lines">
                  <div class="view-line" id="chat-monaco-line">
                    <span>const config = {{ port: 8080, host: '127.0.0.1' }};</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Case 8: Thinking / Reasoning Trace Block -->
          <div data-testid="chat-message" class="chat-message" id="msg-thinking">
            <div class="cursor-edit text-secondary-foreground" id="thinking-block">
              Thinking Process:
              1. Inspecting file system...
              2. Applying patches...
            </div>
          </div>

          <!-- Case 9: Persian Lists with Nested English Sub-lists -->
          <div data-testid="chat-message" class="chat-message" id="msg-lists">
            <div role="article" aria-label="Agent response" dir="auto">
              <ul dir="auto" id="persian-ul">
                <li dir="auto" id="persian-li-1">مرحله اول: بارگذاری فایل‌ها
                  <ul dir="auto" id="nested-en-ul">
                    <li dir="auto" id="nested-en-li-1">Sub-step A: Verify checksums</li>
                    <li dir="auto" id="nested-en-li-2">Sub-step B: Purge V8 cache</li>
                  </ul>
                </li>
                <li dir="auto" id="persian-li-2">مرحله دوم: راه‌اندازی سرور</li>
              </ul>
              <ol dir="auto" id="persian-ol">
                <li dir="auto" id="persian-ol-li-1">قدم اول</li>
                <li dir="auto" id="persian-ol-li-2">قدم دوم</li>
              </ol>
            </div>
          </div>

          <!-- Case 10: Blockquotes (Persian vs English) -->
          <div data-testid="chat-message" class="chat-message" id="msg-blockquotes">
            <div role="article" aria-label="Agent response" dir="auto">
              <blockquote dir="auto" id="blockquote-fa">این یک نقل‌قول معتبر به زبان فارسی است.</blockquote>
              <blockquote dir="auto" id="blockquote-en">This is a standard English quote blockquote.</blockquote>
            </div>
          </div>

          <!-- Case 11: Icon Glyphs Protection inside Chat Pane -->
          <div data-testid="chat-message" class="chat-message" id="msg-icons">
            <div role="article" aria-label="Agent response" dir="auto">
              <p dir="auto">
                وضعیت:
                <span class="codicon codicon-check" id="chat-codicon"></span>
                <span class="google-symbols" id="chat-google-symbol">settings</span>
              </p>
            </div>
          </div>

          <!-- Case 12: User Message Bubble (English vs Persian) -->
          <div data-testid="user-input-step" id="user-step-en">
            <div data-testid="user-message-bubble" id="user-bubble-en" dir="auto">
              <div data-testid="user-message-content" id="user-content-en">
                <div class="whitespace-pre-wrap text-sm" id="user-text-en">Can you check the git status and show diffs?</div>
              </div>
            </div>
          </div>
          <div data-testid="user-input-step" id="user-step-fa">
            <div data-testid="user-message-bubble" id="user-bubble-fa" dir="auto">
              <div data-testid="user-message-content" id="user-content-fa">
                <div class="whitespace-pre-wrap text-sm" id="user-text-fa">سلام، لطفا تغییرات اخیر را بازبینی کن.</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>

  <script id="sentinel-script">
    {sentinel_code}
  </script>
</body>
</html>
"""

def run_tests():
    print("=================================================================")
    print("   ADVERSARIAL BIDI & BOUNDARY HARNESS (EMPIRICAL VERIFICATION)   ")
    print("=================================================================")
    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        
        page.set_content(HTML_TEMPLATE, wait_until="networkidle")
        page.wait_for_timeout(1000)

        def get_styles(selector):
            return page.evaluate(f"""() => {{
                const el = document.querySelector('{selector}');
                if (!el) return null;
                const cs = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                return {{
                    direction: cs.direction,
                    textAlign: cs.textAlign,
                    unicodeBidi: cs.unicodeBidi,
                    fontFamily: cs.fontFamily,
                    overflowY: cs.overflowY,
                    overflowX: cs.overflowX,
                    borderLeftWidth: cs.borderLeftWidth,
                    borderRightWidth: cs.borderRightWidth,
                    paddingLeft: cs.paddingLeft,
                    paddingRight: cs.paddingRight,
                    dirAttr: el.getAttribute('dir'),
                    tagName: el.tagName
                }};
            }}""")

        # TEST 1: Pure English Text in Chat
        s_p_en = get_styles("#p-pure-en")
        is_p_en_ltr = (s_p_en['direction'] == 'ltr' and s_p_en['textAlign'] in ['start', 'left'])
        results.append(("Pure English <p> in Chat must be LTR & Left-aligned", is_p_en_ltr, f"Actual: dir={s_p_en['direction']}, align={s_p_en['textAlign']}"))

        # TEST 2: Pure English User Message Bubble
        s_user_en = get_styles("#user-bubble-en")
        is_user_en_ltr = (s_user_en['direction'] == 'ltr' and s_user_en['textAlign'] in ['start', 'left'])
        results.append(("Pure English User Bubble must be LTR & Left-aligned", is_user_en_ltr, f"Actual: dir={s_user_en['direction']}, align={s_user_en['textAlign']}"))

        # TEST 3: Pure Persian Text in Chat
        s_p_fa = get_styles("#p-pure-fa")
        is_p_fa_rtl = (s_p_fa['direction'] == 'rtl')
        results.append(("Pure Persian <p> in Chat must be RTL", is_p_fa_rtl, f"Actual: dir={s_p_fa['direction']}"))

        # TEST 4: Inline Code inside Persian Text (Direction & Font Isolation)
        s_code = get_styles("#inline-code-target")
        is_code_ltr = (s_code['direction'] == 'ltr' and 'isolate' in s_code['unicodeBidi'])
        is_code_mono = ('Cascadia' in s_code['fontFamily'] or 'monospace' in s_code['fontFamily'] or 'Consolas' in s_code['fontFamily'])
        results.append(("Inline <code> inside Persian text must be LTR & isolated", is_code_ltr, f"Actual: dir={s_code['direction']}, bidi={s_code['unicodeBidi']}"))
        results.append(("Inline <code> must retain Monospace font (not Vazirmatn)", is_code_mono, f"Actual: font={s_code['fontFamily']}"))

        # TEST 5: Multi-line Code Block in Prose (Font Isolation)
        s_cblock = get_styles("#code-block")
        is_cblock_mono = ('Cascadia' in s_cblock['fontFamily'] or 'monospace' in s_cblock['fontFamily'] or 'Consolas' in s_cblock['fontFamily'])
        results.append(("Multi-line <pre><code> must retain Monospace font in Prose", is_cblock_mono, f"Actual: font={s_cblock['fontFamily']}"))

        # TEST 6: Thinking Block (.cursor-edit.text-secondary-foreground)
        s_thinking = get_styles("#thinking-block")
        is_thinking_ltr = (s_thinking['direction'] == 'ltr' and s_thinking['textAlign'] in ['start', 'left'])
        results.append(("Thinking block (.cursor-edit) must be LTR & left-aligned", is_thinking_ltr, f"Actual: dir={s_thinking['direction']}, align={s_thinking['textAlign']}"))

        # TEST 7: Icon Font Protection
        s_codicon = get_styles("#chat-codicon")
        s_gsymbol = get_styles("#chat-google-symbol")
        is_codicon_protected = ('codicon' in s_codicon['fontFamily'])
        is_gsymbol_protected = ('Google Symbols' in s_gsymbol['fontFamily'])
        results.append((".codicon font immune from Vazirmatn override", is_codicon_protected, f"Actual: font={s_codicon['fontFamily']}"))
        results.append((".google-symbols font immune from Vazirmatn override", is_gsymbol_protected, f"Actual: font={s_gsymbol['fontFamily']}"))

        # TEST 8: Double Scrollbar Elimination
        s_msg_wrapper = get_styles("#msg-pure-en")
        s_viewport = get_styles("#chat-autoscroll-viewport")
        is_scrollbar_ok = (s_msg_wrapper['overflowY'] == 'visible' and s_viewport['overflowY'] == 'auto')
        results.append(("Double scrollbar eliminated (message visible, viewport auto)", is_scrollbar_ok, f"Actual: msg={s_msg_wrapper['overflowY']}, viewport={s_viewport['overflowY']}"))

        # TEST 9: Explorer Tree Preservation
        s_exp_row = get_styles("#explorer-row-1")
        is_explorer_ltr = (s_exp_row['direction'] == 'ltr')
        results.append(("Explorer tree preserved in LTR (no leakage)", is_explorer_ltr, f"Actual: dir={s_exp_row['direction']}"))

        # TEST 10: Center Editor Tabs Preservation
        s_editor_tab = get_styles("#editor-tab-1")
        is_editor_tab_ltr = (s_editor_tab['direction'] == 'ltr')
        results.append(("Editor tabs preserved in LTR (no leakage)", is_editor_tab_ltr, f"Actual: dir={s_editor_tab['direction']}"))

        # TEST 11: Document Body Protection from Global RTL
        s_body = get_styles("body")
        is_body_ltr = (s_body['direction'] == 'ltr' and s_body['dirAttr'] != 'rtl')
        results.append(("Document body not corrupted with global dir=rtl", is_body_ltr, f"Actual: dir={s_body['direction']}, dirAttr={s_body['dirAttr']}"))

        browser.close()

    print("\n------------------ DETAILED TEST RESULTS ------------------")
    failures = 0
    for name, passed, detail in results:
        status = "PASS" if passed else "FAIL"
        if not passed:
            failures += 1
        print(f"[{status}] {name}")
        if not passed:
            print(f"       -> {detail}")

    print("=================================================================")
    print(f"TOTAL TESTS: {len(results)} | PASSED: {len(results) - failures} | FAILED: {failures}")
    print("=================================================================")
    
    return failures == 0

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
