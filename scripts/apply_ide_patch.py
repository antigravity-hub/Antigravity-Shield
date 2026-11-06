import os, sys, json, hashlib, base64, shutil, re
sys.stdout.reconfigure(encoding='utf-8')

app_dir = r"C:\Users\ersha\AppData\Local\Programs\Antigravity IDE\resources\app"
out_dir = os.path.join(app_dir, "out")
product_json_path = os.path.join(app_dir, "product.json")

print("=== STARTING SURGICAL IDE PATCHING ===")

# 1. Update Sentinel in jetskiAgent.js and workbench.js
sentinel_code = r'''
// [Antigravity-Shield-IDE-BiDi-Sentinel]
(()=>{
  const isPersian = (s) => /[\u0600-\u06FF]/.test(s);
  function patchBiDi(root = document) {
    if (!root || !root.querySelectorAll) return;
    const targets = root.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, th, td, [data-testid="user-message-bubble"], div[role="article"], .leading-relaxed');
    for (let i = 0; i < targets.length; i++) {
      const el = targets[i];
      if (el.tagName === 'CODE' || el.tagName === 'PRE' || el.closest('pre') || el.closest('.monaco-editor')) continue;
      const txt = el.textContent || '';
      if (isPersian(txt)) {
        if (el.getAttribute('dir') !== 'rtl') el.setAttribute('dir', 'rtl');
        if (el.style.direction !== 'rtl') el.style.setProperty('direction', 'rtl', 'important');
        if (el.style.fontFamily !== "'Vazirmatn'") el.style.setProperty('font-family', "'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif", 'important');
        if (el.style.unicodeBidi !== 'isolate') el.style.setProperty('unicode-bidi', 'isolate', 'important');
        if (el.style.textAlign !== 'right') el.style.setProperty('text-align', 'right', 'important');
        if (el.tagName === 'BLOCKQUOTE') {
          el.style.setProperty('border-left', 'none', 'important');
          el.style.setProperty('border-right', '4px solid var(--border, #93e9be)', 'important');
        }
      }
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => patchBiDi());
  } else {
    patchBiDi();
  }
  const obs = new MutationObserver((mutations) => {
    for (let i = 0; i < mutations.length; i++) {
      const m = mutations[i];
      if (m.type === 'childList') {
        for (let j = 0; j < m.addedNodes.length; j++) {
          const n = m.addedNodes[j];
          if (n.nodeType === 1) patchBiDi(n);
        }
      } else if (m.type === 'characterData') {
        const p = m.target.parentElement;
        if (p) patchBiDi(p);
      }
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el) return;
    if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const val = el.value || el.textContent || '';
      if (isPersian(val)) {
        el.setAttribute('dir', 'rtl');
        el.style.setProperty('direction', 'rtl', 'important');
        el.style.setProperty('text-align', 'right', 'important');
        el.style.setProperty('unicode-bidi', 'isolate', 'important');
      } else if (val.trim().length > 0) {
        el.setAttribute('dir', 'ltr');
        el.style.setProperty('direction', 'ltr');
        el.style.setProperty('text-align', 'left');
      }
    }
  }, true);
})();
'''

for js_rel in ["vs/code/electron-browser/workbench/jetskiAgent.js", "vs/code/electron-browser/workbench/workbench.js"]:
    p = os.path.join(out_dir, js_rel.replace('/', os.sep))
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8') as f:
            c = f.read()
        if "// [Antigravity-Shield-IDE-BiDi-Sentinel]" in c:
            idx = c.find("// [Antigravity-Shield-IDE-BiDi-Sentinel]")
            c = c[:idx].rstrip() + "\n" + sentinel_code
        else:
            c = c.rstrip() + "\n" + sentinel_code
        with open(p, 'w', encoding='utf-8') as f:
            f.write(c)
        print(f"Updated Sentinel in: {js_rel}")

# 2. Update HTML style block in workbench.html & workbench-jetski-agent.html
for html_rel in ["vs/code/electron-browser/workbench/workbench.html", "vs/code/electron-browser/workbench/workbench-jetski-agent.html"]:
    p = os.path.join(out_dir, html_rel.replace('/', os.sep))
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8') as f:
            c = f.read()
        
        # Extract existing base64 font
        m = re.search(r'data:font/woff2;base64,([A-Za-z0-9+/=]+)', c)
        if m:
            b64_font = m.group(1)
            new_style = f'''	<style id="antigravity-shield-ide-bidi">
		@font-face {{
			font-family: 'Vazirmatn';
			src: local('Vazirmatn'), local('Vazirmatn-Regular'), local('Vazir'),
			     url('data:font/woff2;base64,{b64_font}') format('woff2');
			font-weight: 100 900;
			font-style: normal;
			font-display: swap;
		}}

		body, html, #root, [dir="rtl"] {{
			font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif !important;
		}}

		[dir="rtl"] {{
			direction: rtl !important;
			text-align: right !important;
			unicode-bidi: isolate !important;
		}}

		li[dir="rtl"], ul[dir="rtl"] > li, ol[dir="rtl"] > li {{
			direction: rtl !important;
			text-align: right !important;
			text-align-last: right !important;
			unicode-bidi: isolate !important;
		}}

		p[dir="rtl"] {{
			direction: rtl !important;
			text-align: right !important;
			text-align-last: right !important;
			unicode-bidi: isolate !important;
			line-height: 1.85 !important;
		}}

		blockquote[dir="rtl"] {{
			direction: rtl !important;
			text-align: right !important;
			border-left: none !important;
			border-right: 4px solid var(--border, #93e9be) !important;
			unicode-bidi: isolate !important;
		}}

		th[dir="rtl"], td[dir="rtl"], table[dir="rtl"] th, table[dir="rtl"] td {{
			text-align: right !important;
			unicode-bidi: isolate !important;
		}}

		textarea[dir="rtl"], input[dir="rtl"], [contenteditable="true"][dir="rtl"] {{
			direction: rtl !important;
			text-align: right !important;
			unicode-bidi: isolate !important;
			font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif !important;
		}}

		code[dir="rtl"] {{
			direction: rtl !important;
			font-family: 'Vazirmatn', monospace !important;
			unicode-bidi: isolate !important;
		}}

		[dir="rtl"] :is(span, strong, em, b, i, a, code) {{
			unicode-bidi: isolate !important;
		}}

		pre, pre *, .monaco-editor, .monaco-editor *, .view-line, .view-lines {{
			font-family: var(--monaco-monospace-font, 'Cascadia Code', Consolas, 'Courier New', monospace) !important;
			direction: ltr !important;
			text-align: left !important;
		}}
	</style>'''
            s_pos = c.find('<style id="antigravity-shield-ide-bidi">')
            if s_pos != -1:
                e_pos = c.find('</style>', s_pos)
                c = c[:s_pos] + new_style.strip() + c[e_pos+8:]
            else:
                c = c.replace("</head>", new_style + "\n</head>")
            with open(p, 'w', encoding='utf-8') as f:
                f.write(c)
            print(f"Updated style in: {html_rel}")

# 3. Patch jetskiAgent/main.js
jetski_main_path = os.path.join(out_dir, "jetskiAgent", "main.js")
if os.path.exists(jetski_main_path):
    with open(jetski_main_path, 'r', encoding='utf-8') as f:
        jc = f.read()
    
    jc_replacements = [
        # th text-left
        ('WBa=({node:e,...t})=>d("th",{...t,className:ke("bg-secondary px-3 py-2 text-left font-medium leading-snug border",t.className),children:d(Pdn,{children:t.children})})',
         'WBa=({node:e,...t})=>d("th",{...t,dir:/[\u0600-\u06FF]/.test(typeof t.children==="string"?t.children:"")?"rtl":"auto",className:ke("bg-secondary px-3 py-2 font-medium leading-snug border",t.className),children:d(Pdn,{children:t.children})})'),
        # blockquote
        ('QBa=e=>{let t=pVe();return e.className?.includes("markdown-alert")?d("blockquote",{dir:"auto",...e,style:{...e.style,...t}}):d("blockquote",{...e,style:{borderLeft:"4px solid var(--border)",backgroundColor:"var(--muted)",padding:"0.5rem 1rem",margin:"0.5rem 0",...t}})}',
         'QBa=e=>{let t=pVe(),isR=Boolean(e?.children&&/[\u0600-\u06FF]/.test(typeof e.children==="string"?e.children:""));return e.className?.includes("markdown-alert")?d("blockquote",{...e,dir:isR?"rtl":"auto",style:{...e.style,...t}}):d("blockquote",{...e,dir:isR?"rtl":"auto",style:{borderLeft:isR?"none":"4px solid var(--border)",borderRight:isR?"4px solid var(--border)":"none",backgroundColor:"var(--muted)",padding:"0.5rem 1rem",margin:"0.5rem 0",...t}})}'),
        # task list items
        ('if(a)return d("li",{dir:"auto",...n,style:{...n.style,...s},className:ke(n.className,"task-list-item"),children:[d(Adn,{status:"in-progress",className:ke("align-text-bottom",bdn)})," ",u(i)]});',
         'if(a)return d("li",{...n,dir:/[\u0600-\u06FF]/.test(typeof i==="string"?i:"")?"rtl":"auto",style:{...n.style,...s},className:ke(n.className,"task-list-item"),children:[d(Adn,{status:"in-progress",className:ke("align-text-bottom",bdn)})," ",u(i)]});'),
        ('if(o){let{checkbox:h,inlineContent:f,sublists:E}=vdn(i);return d("li",{dir:"auto",...n,style:{...n.style,...s},className:ke(n.className,"task-checked"),children:[h,d("span",{className:"task-checked-content",children:Rdn(f)?f:l(f)}),E]})}',
         'if(o){let{checkbox:h,inlineContent:f,sublists:E}=vdn(i);return d("li",{...n,dir:/[\u0600-\u06FF]/.test(typeof i==="string"?i:"")?"rtl":"auto",style:{...n.style,...s},className:ke(n.className,"task-checked"),children:[h,d("span",{className:"task-checked-content",children:Rdn(f)?f:l(f)}),E]})}'),
    ]
    for target, rep in jc_replacements:
        if target in jc:
            jc = jc.replace(target, rep)
            print("Applied replacement in jetskiAgent/main.js")
        else:
            print(f"Target not found or already replaced in jetskiAgent/main.js: {target[:60]}...")
    with open(jetski_main_path, 'w', encoding='utf-8') as f:
        f.write(jc)

# 4. Patch vs/workbench/workbench.desktop.main.js
wb_main_path = os.path.join(out_dir, "vs", "workbench", "workbench.desktop.main.js")
if os.path.exists(wb_main_path):
    with open(wb_main_path, 'r', encoding='utf-8') as f:
        wc = f.read()
    
    wc_replacements = [
        # th text-left
        ('rDd=({node:t,...e})=>v("th",{...e,className:ht("bg-secondary px-3 py-2 text-left font-medium leading-snug border",e.className),children:v(PMo,{children:e.children})})',
         'rDd=({node:t,...e})=>v("th",{...e,dir:/[\u0600-\u06FF]/.test(typeof e.children==="string"?e.children:"")?"rtl":"auto",className:ht("bg-secondary px-3 py-2 font-medium leading-snug border",e.className),children:v(PMo,{children:e.children})})'),
        # blockquote
        ('dDd=t=>{let e=m8t();return t.className?.includes("markdown-alert")?v("blockquote",{...t,style:{...t.style,...e}}):v("blockquote",{...t,style:{borderLeft:"4px solid var(--border)",backgroundColor:"var(--muted)",padding:"0.5rem 1rem",margin:"0.5rem 0",...e}})}',
         'dDd=t=>{let e=m8t(),isR=Boolean(t?.children&&/[\u0600-\u06FF]/.test(typeof t.children==="string"?t.children:""));return t.className?.includes("markdown-alert")?v("blockquote",{...t,dir:isR?"rtl":"auto",style:{...t.style,...e}}):v("blockquote",{...t,dir:isR?"rtl":"auto",style:{borderLeft:isR?"none":"4px solid var(--border)",borderRight:isR?"4px solid var(--border)":"none",backgroundColor:"var(--muted)",padding:"0.5rem 1rem",margin:"0.5rem 0",...e}})}'),
        # task list items
        ('if(s)return v("li",{...n,style:{...n.style,...a},className:ht(n.className,"task-list-item"),children:[v(hMo,{status:"in-progress",className:ht("align-text-bottom",fMo)})," ",d(r)]});',
         'if(s)return v("li",{...n,dir:/[\u0600-\u06FF]/.test(typeof r==="string"?r:"")?"rtl":"auto",style:{...n.style,...a},className:ht(n.className,"task-list-item"),children:[v(hMo,{status:"in-progress",className:ht("align-text-bottom",fMo)})," ",d(r)]});'),
        ('if(o){let{checkbox:u,inlineContent:h,sublists:f}=pMo(r);return v("li",{...n,style:{...n.style,...a},className:ht(n.className,"task-checked"),children:[u,v("span",{className:"task-checked-content",children:gMo(h)?h:l(h)}),f]})}',
         'if(o){let{checkbox:u,inlineContent:h,sublists:f}=pMo(r);return v("li",{...n,dir:/[\u0600-\u06FF]/.test(typeof r==="string"?r:"")?"rtl":"auto",style:{...n.style,...a},className:ht(n.className,"task-checked"),children:[u,v("span",{className:"task-checked-content",children:gMo(h)?h:l(h)}),f]})}'),
    ]
    for target, rep in wc_replacements:
        if target in wc:
            wc = wc.replace(target, rep)
            print("Applied replacement in workbench.desktop.main.js")
        else:
            print(f"Target not found or already replaced in workbench.desktop.main.js: {target[:60]}...")
    with open(wb_main_path, 'w', encoding='utf-8') as f:
        f.write(wc)

# 5. Recompute and update product.json checksums
with open(product_json_path, 'r', encoding='utf-8') as f:
    pj = json.load(f)

all_patched_files = [
    ("vs/workbench/workbench.desktop.main.css", "out/vs/workbench/workbench.desktop.main.css"),
    ("jetskiMain.tailwind.css", "out/jetskiMain.tailwind.css"),
    ("tw-base.tailwind.css", "out/tw-base.tailwind.css"),
    ("jetskiAgent/main.css", "out/jetskiAgent/main.css"),
    ("jetskiAgent/main.js", "out/jetskiAgent/main.js"),
    ("vs/code/electron-browser/workbench/jetskiAgent.js", "out/vs/code/electron-browser/workbench/jetskiAgent.js"),
    ("vs/workbench/workbench.desktop.main.js", "out/vs/workbench/workbench.desktop.main.js"),
    ("vs/code/electron-browser/workbench/workbench.js", "out/vs/code/electron-browser/workbench/workbench.js"),
    ("vs/code/electron-browser/workbench/workbench.html", "out/vs/code/electron-browser/workbench/workbench.html"),
    ("vs/code/electron-browser/workbench/workbench-jetski-agent.html", "out/vs/code/electron-browser/workbench/workbench-jetski-agent.html"),
]

for key, rel_path in all_patched_files:
    fp = os.path.join(app_dir, rel_path.replace('/', os.sep))
    if os.path.exists(fp):
        with open(fp, 'rb') as f:
            h = hashlib.sha256(f.read()).digest()
            b64_hash = base64.b64encode(h).decode('ascii').rstrip('=')
            pj["checksums"][key] = b64_hash
            print(f"Updated product.json checksum: {key} -> {b64_hash}")

with open(product_json_path, 'w', encoding='utf-8') as f:
    json.dump(pj, f, indent=4)

# 6. Clear Electron V8 cache
roaming_ide = os.path.expandvars(r"%APPDATA%\Antigravity IDE")
for sub in ["Cache", os.path.join("Code Cache", "js"), "CachedData"]:
    cdir = os.path.join(roaming_ide, sub)
    if os.path.exists(cdir):
        try:
            shutil.rmtree(cdir)
            print(f"Cleared cache dir: {cdir}")
        except Exception as e:
            print(f"Could not clear {cdir}: {e}")

print("=== SURGICAL IDE PATCHING COMPLETED ===")
