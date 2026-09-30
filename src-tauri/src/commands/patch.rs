use std::fs;
use std::path::Path;
use std::process::Command;

#[tauri::command]
pub async fn patch_agy_binary(file_path: String) -> Result<String, String> {
    let mut actual_path = file_path.clone();
    if actual_path.ends_with(".app") || actual_path.ends_with(".app/") {
        let app_path = Path::new(&actual_path);
        let inner = app_path.join("Contents/MacOS/agy");
        if inner.exists() {
            actual_path = inner.to_string_lossy().to_string();
        }
    }

    let path = Path::new(&actual_path);
    if !path.exists() {
        return Err("File not found".into());
    }

    let data = fs::read(path).map_err(|e| format!("Failed to read file: {}", e))?;
    let n = data.len();
    let mut patch_offset = None;
    let mut new_inst_bytes = None;
    let mut is_pe_x64 = false;

    // 1. Scan for x86_64 PE (Windows/Linux) pattern
    // Pattern: cmpb $0x0, (%r12) -> 41 80 3c 24 00
    //          jne offset32      -> 0f 85 XX XX XX XX
    //          leaq rip_off, rax -> 48 8d 05 XX XX XX XX
    //          mov $0x18, %ebx   -> bb 18 00 00 00
    let pe_pattern = [0x41, 0x80, 0x3c, 0x24, 0x00, 0x0f, 0x85];
    let mut i = 0;
    while i < n - 25 {
        if data[i..i + 7] == pe_pattern {
            // Validate the rest of the pattern
            // leaq opcode starts after jne (which is 6 bytes: 0f 85 XX XX XX XX)
            let leaq_idx = i + 5 + 6;
            if data[leaq_idx..leaq_idx + 3] == [0x48, 0x8d, 0x05] {
                // mov $0x18, %ebx starts after leaq (which is 7 bytes: 48 8d 05 XX XX XX XX)
                let mov_idx = leaq_idx + 7;
                if data[mov_idx..mov_idx + 2] == [0xbb, 0x18] {
                    // Found the gate!
                    patch_offset = Some(i + 5); // Points to the jne instruction: 0f 85 ...
                                                // Rewrite jne to 6 NOP bytes (0x90) so it falls through unconditionally
                    new_inst_bytes = Some(vec![0x90; 6]);
                    is_pe_x64 = true;
                    break;
                }
            }
        }
        i += 1;
    }

    // 2. Scan for ARM64 eligibility gate pattern if not PE x86_64
    if patch_offset.is_none() {
        for j in (0..n - 20).step_by(4) {
            let inst1 = u32::from_le_bytes(data[j..j + 4].try_into().unwrap());
            let inst2 = u32::from_le_bytes(data[j + 4..j + 8].try_into().unwrap());
            let inst4 = u32::from_le_bytes(data[j + 12..j + 16].try_into().unwrap());
            let inst5 = u32::from_le_bytes(data[j + 16..j + 20].try_into().unwrap());

            // 1. ldrb wA, [xB, #0x58]
            if (inst1 & 0xfffffc00) != 0x39416000 {
                continue;
            }
            let b_reg = (inst1 >> 5) & 0x1f;
            let a_reg = inst1 & 0x1f;

            // 2. tbnz wA, #0, label1
            if (inst2 & 0xffe0001f) != (0x37000000 | a_reg) {
                continue;
            }

            // 3. ldr xC, [xB, #0x38]
            if (inst4 & 0xfffffc00) != 0xf9401c00 || ((inst4 >> 5) & 0x1f) != b_reg {
                continue;
            }
            let c_reg = inst4 & 0x1f;

            // 4. cbz xC, label_send
            if (inst5 & 0xffe0001f) != (0xb4000000 | c_reg) {
                continue;
            }

            // Extract imm19 from cbz
            let imm19_raw = (inst5 >> 5) & 0x7ffff;
            let imm19 = if (imm19_raw & 0x40000) != 0 {
                (imm19_raw as i32) - 0x80000
            } else {
                imm19_raw as i32
            };

            patch_offset = Some(j + 16);
            // Encode unconditional branch: b label_send (0x14000000 | (imm19 & 0x3ffffff))
            let b_inst = 0x14000000 | ((imm19 as u32) & 0x3ffffff);
            new_inst_bytes = Some(b_inst.to_le_bytes().to_vec());
            break;
        }
    }

    if patch_offset.is_none() {
        // Check if already patched for x86_64 PE
        let mut check_idx = 0;
        while check_idx < n - 25 {
            if data[check_idx..check_idx + 7] == pe_pattern {
                let leaq_idx = check_idx + 5 + 6;
                if data[leaq_idx..leaq_idx + 3] == [0x48, 0x8d, 0x05] {
                    let mov_idx = leaq_idx + 7;
                    if data[mov_idx..mov_idx + 2] == [0xbb, 0x18] {
                        if data[check_idx + 5..check_idx + 11] == [0x90; 6] {
                            return Ok("Binary is already patched.".into());
                        }
                    }
                }
            }
            check_idx += 1;
        }

        // Check if already patched for ARM64
        for j in (0..n - 20).step_by(4) {
            let inst1 = u32::from_le_bytes(data[j..j + 4].try_into().unwrap());
            let inst2 = u32::from_le_bytes(data[j + 4..j + 8].try_into().unwrap());
            let inst4 = u32::from_le_bytes(data[j + 12..j + 16].try_into().unwrap());
            let inst5 = u32::from_le_bytes(data[j + 16..j + 20].try_into().unwrap());

            if (inst1 & 0xfffffc00) == 0x39416000 {
                let b_reg = (inst1 >> 5) & 0x1f;
                let a_reg = inst1 & 0x1f;
                if (inst2 & 0xffe0001f) == (0x37000000 | a_reg) {
                    if (inst4 & 0xfffffc00) == 0xf9401c00 && ((inst4 >> 5) & 0x1f) == b_reg {
                        if (inst5 & 0xfc000000) == 0x14000000 {
                            return Ok("Binary is already patched.".into());
                        }
                    }
                }
            }
        }

        return Err("Pattern not found. This version of the CLI might not have the eligibility gate, or the structure has changed.".into());
    }

    let offset = patch_offset.unwrap();
    let patch_bytes = new_inst_bytes.unwrap();

    // Create backup
    let backup_path = format!("{}.bak", actual_path);
    if !Path::new(&backup_path).exists() {
        fs::copy(path, &backup_path).map_err(|e| format!("Failed to create backup: {}", e))?;
    }

    // Apply patch
    use std::io::{Seek, SeekFrom, Write};
    let mut file = fs::OpenOptions::new()
        .write(true)
        .open(path)
        .map_err(|e| format!("Failed to open file for writing: {}", e))?;
    file.seek(SeekFrom::Start(offset as u64))
        .map_err(|e| format!("Seek failed: {}", e))?;
    file.write_all(&patch_bytes)
        .map_err(|e| format!("Write failed: {}", e))?;

    // Re-sign on macOS (only if we patched an ARM64 macOS executable)
    #[cfg(target_os = "macos")]
    {
        if !is_pe_x64 {
            let _ = Command::new("codesign")
                .args(&["--remove-signature", &actual_path])
                .output();
            let output = Command::new("codesign")
                .args(&["--sign", "-", &actual_path])
                .output();
            match output {
                Ok(out) if out.status.success() => {}
                Ok(out) => {
                    let err_msg = String::from_utf8_lossy(&out.stderr);
                    return Err(format!(
                        "Patch applied, but codesigning failed: {}",
                        err_msg
                    ));
                }
                Err(e) => {
                    return Err(format!(
                        "Patch applied, but codesigning execution failed: {}",
                        e
                    ))
                }
            }
        }
    }

    Ok("Patch applied successfully!".into())
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct AntigravityRtlStatus {
    pub desktop_asar_path: Option<String>,
    pub desktop_is_patched: bool,
    pub desktop_has_backup: bool,
    pub ide_css_path: Option<String>,
    pub ide_is_patched: bool,
    pub ide_has_backup: bool,
}

const VAZIRMATN_RTL_CSS: &str = r#"
/* [Antigravity-Shield-RTL-Vazirmatn] */
/* RTL-PATCH-START */

/* ── 1. Web Fonts (Vazirmatn) ─────────────────────────────────────── */
@font-face {
  font-family: 'Vazirmatn';
  font-style: normal;
  font-weight: 300;
  font-display: swap;
  src: local('Vazirmatn Light'), local('Vazirmatn-Light'),
       url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Light.woff2') format('woff2');
}

@font-face {
  font-family: 'Vazirmatn';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: local('Vazirmatn'), local('Vazirmatn-Regular'), local('Vazir'), local('IRANSans'), local('Tahoma'),
       url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Regular.woff2') format('woff2');
}

@font-face {
  font-family: 'Vazirmatn';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: local('Vazirmatn Medium'), local('Vazirmatn-Medium'),
       url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Medium.woff2') format('woff2');
}

@font-face {
  font-family: 'Vazirmatn';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: local('Vazirmatn Bold'), local('Vazirmatn-Bold'), local('Vazir-Bold'),
       url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Bold.woff2') format('woff2');
}

@font-face {
  font-family: 'Vazirmatn';
  font-style: normal;
  font-weight: 800;
  font-display: swap;
  src: local('Vazirmatn ExtraBold'), local('Vazirmatn-ExtraBold'),
       url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-ExtraBold.woff2') format('woff2');
}

/* ── 2. Base Typography & BiDi Direction ──────────────────────────── */
.monaco-workbench .chat-widget,
.monaco-workbench .interactive-session,
.monaco-workbench .chat-container,
.monaco-workbench .interactive-container,
.monaco-workbench .part.auxiliarybar,
.monaco-workbench .part.sidebar,
.monaco-workbench .part.panel,
.rendered-markdown,
.antigravity-agent-side-panel,
.antigravity-agent-manager,
.animate-markdown {
  font-family: 'Vazirmatn', 'Vazir', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
}

/* Paragraphs & Text: Justified & Smooth Leading */
.monaco-workbench .chat-widget p,
.monaco-workbench .interactive-session p,
.monaco-workbench .chat-container p,
.monaco-workbench .interactive-container p,
.monaco-workbench .part.auxiliarybar p,
.monaco-workbench .part.sidebar p,
.monaco-workbench .part.panel p,
.rendered-markdown p,
.antigravity-agent-side-panel p,
.antigravity-agent-manager p,
.animate-markdown p {
  font-family: 'Vazirmatn', 'Vazir', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  unicode-bidi: plaintext !important;
  text-align: justify !important;
  text-justify: inter-word !important;
  line-height: 1.85 !important;
  margin-bottom: 0.65em !important;
  letter-spacing: -0.01em !important;
}

.monaco-workbench .chat-widget li,
.monaco-workbench .interactive-session li,
.monaco-workbench .chat-container li,
.monaco-workbench .interactive-container li,
.monaco-workbench .part.auxiliarybar li,
.monaco-workbench .part.sidebar li,
.monaco-workbench .part.panel li,
.rendered-markdown li {
  font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  unicode-bidi: plaintext !important;
  text-align: justify !important;
  text-justify: inter-word !important;
  line-height: 1.8 !important;
}

textarea, input, [contenteditable="true"] {
  font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  unicode-bidi: plaintext !important;
  text-align: start !important;
}

/* ── 3. Headings: Cyan/Teal Accents & Frosted Pill Background ─────── */
.monaco-workbench .chat-widget h1,
.monaco-workbench .interactive-session h1,
.monaco-workbench .chat-container h1,
.monaco-workbench .interactive-container h1,
.monaco-workbench .part.auxiliarybar h1,
.monaco-workbench .part.sidebar h1,
.monaco-workbench .part.panel h1,
.rendered-markdown h1,
.antigravity-agent-side-panel h1,
.antigravity-agent-manager h1,
.animate-markdown h1 {
  font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  color: #22d3ee !important; /* Vibrant Cyan */
  font-size: 1.25rem !important;
  font-weight: 800 !important;
  unicode-bidi: plaintext !important;
  text-align: start !important;
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.18) 0%, rgba(14, 165, 233, 0.06) 100%) !important;
  border-inline-start: 4px solid #06b6d4 !important;
  border-radius: 8px !important;
  padding: 8px 14px !important;
  margin: 18px 0 10px 0 !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15) !important;
}

.monaco-workbench .chat-widget h2,
.monaco-workbench .interactive-session h2,
.monaco-workbench .chat-container h2,
.monaco-workbench .interactive-container h2,
.monaco-workbench .part.auxiliarybar h2,
.monaco-workbench .part.sidebar h2,
.monaco-workbench .part.panel h2,
.rendered-markdown h2,
.antigravity-agent-side-panel h2,
.antigravity-agent-manager h2,
.animate-markdown h2 {
  font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  color: #38bdf8 !important; /* Sky/Cyan */
  font-size: 1.15rem !important;
  font-weight: 700 !important;
  unicode-bidi: plaintext !important;
  text-align: start !important;
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.14) 0%, rgba(56, 189, 248, 0.04) 100%) !important;
  border-inline-start: 4px solid #38bdf8 !important;
  border-radius: 7px !important;
  padding: 6px 12px !important;
  margin: 16px 0 10px 0 !important;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12) !important;
}

.monaco-workbench .chat-widget h3,
.monaco-workbench .interactive-session h3,
.monaco-workbench .chat-container h3,
.monaco-workbench .interactive-container h3,
.monaco-workbench .part.auxiliarybar h3,
.monaco-workbench .part.sidebar h3,
.monaco-workbench .part.panel h3,
.rendered-markdown h3,
.antigravity-agent-side-panel h3,
.antigravity-agent-manager h3,
.animate-markdown h3 {
  font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  color: #67e8f9 !important; /* Light Cyan */
  font-size: 1.05rem !important;
  font-weight: 600 !important;
  unicode-bidi: plaintext !important;
  text-align: start !important;
  background: rgba(6, 182, 212, 0.08) !important;
  border-inline-start: 3px solid #22d3ee !important;
  border-radius: 6px !important;
  padding: 5px 10px !important;
  margin: 14px 0 8px 0 !important;
}

.monaco-workbench .chat-widget h4,
.monaco-workbench .chat-widget h5,
.monaco-workbench .chat-widget h6,
.rendered-markdown h4,
.rendered-markdown h5,
.rendered-markdown h6 {
  font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  color: #a5f3fc !important;
  font-weight: 600 !important;
  unicode-bidi: plaintext !important;
  text-align: start !important;
  margin: 12px 0 6px 0 !important;
}

/* ── 4. Elegant Separators (Dividers) ─────────────────────────────── */
.monaco-workbench .chat-widget hr,
.monaco-workbench .interactive-session hr,
.monaco-workbench .chat-container hr,
.monaco-workbench .interactive-container hr,
.monaco-workbench .part.auxiliarybar hr,
.monaco-workbench .part.sidebar hr,
.monaco-workbench .part.panel hr,
.rendered-markdown hr,
.antigravity-agent-side-panel hr,
.antigravity-agent-manager hr,
.animate-markdown hr {
  border: none !important;
  height: 1px !important;
  background: linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.45), rgba(56, 189, 248, 0.25), transparent) !important;
  margin: 18px 0 !important;
}

/* ── 5. Lists & Counters ─────────────────────────────────────────── */
.monaco-workbench .chat-widget ul, .monaco-workbench .chat-widget ol,
.monaco-workbench .interactive-session ul, .monaco-workbench .interactive-session ol,
.monaco-workbench .chat-container ul, .monaco-workbench .chat-container ol,
.monaco-workbench .interactive-container ul, .monaco-workbench .interactive-container ol,
.monaco-workbench .part.auxiliarybar ul, .monaco-workbench .part.auxiliarybar ol,
.monaco-workbench .part.sidebar ul, .monaco-workbench .part.sidebar ol,
.monaco-workbench .part.panel ul, .monaco-workbench .part.panel ol,
.rendered-markdown ul, .rendered-markdown ol {
  padding-inline-start: 1.6em !important;
  padding-inline-end: 0.5em !important;
  margin-inline-start: 0 !important;
  margin-inline-end: 0 !important;
  list-style: none !important;
}

.monaco-workbench .chat-widget ol,
.monaco-workbench .interactive-session ol,
.monaco-workbench .chat-container ol,
.monaco-workbench .interactive-container ol,
.monaco-workbench .part.auxiliarybar ol,
.monaco-workbench .part.sidebar ol,
.monaco-workbench .part.panel ol,
.rendered-markdown ol {
  counter-reset: chat-list-counter;
}

.monaco-workbench .chat-widget ol > li,
.monaco-workbench .interactive-session ol > li,
.monaco-workbench .chat-container ol > li,
.monaco-workbench .interactive-container ol > li,
.monaco-workbench .part.auxiliarybar ol > li,
.monaco-workbench .part.sidebar ol > li,
.monaco-workbench .part.panel ol > li,
.rendered-markdown ol > li {
  counter-increment: chat-list-counter;
  position: relative !important;
}

.monaco-workbench .chat-widget li,
.monaco-workbench .interactive-session li,
.monaco-workbench .chat-container li,
.monaco-workbench .interactive-container li,
.monaco-workbench .part.auxiliarybar li,
.monaco-workbench .part.sidebar li,
.monaco-workbench .part.panel li,
.rendered-markdown li {
  list-style: none !important;
  margin-bottom: 0.4em !important;
}

/* Bullet styling: Cyan dot */
.monaco-workbench .chat-widget ul > li::before,
.monaco-workbench .interactive-session ul > li::before,
.monaco-workbench .chat-container ul > li::before,
.monaco-workbench .interactive-container ul > li::before,
.monaco-workbench .part.auxiliarybar ul > li::before,
.monaco-workbench .part.sidebar ul > li::before,
.monaco-workbench .part.panel ul > li::before,
.rendered-markdown ul > li::before {
  content: "• " !important;
  color: #06b6d4 !important;
  font-weight: bold !important;
  margin-inline-end: 0.45em !important;
  display: inline-block !important;
}

.monaco-workbench .chat-widget ul > li:has(> p:first-child)::before,
.rendered-markdown ul > li:has(> p:first-child)::before {
  content: none !important;
  margin: 0 !important;
}

.monaco-workbench .chat-widget ul > li > p:first-child::before,
.rendered-markdown ul > li > p:first-child::before {
  content: "• " !important;
  color: #06b6d4 !important;
  font-weight: bold !important;
  margin-inline-end: 0.45em !important;
  display: inline-block !important;
}

/* Numbered lists: Badge-like numbers */
.monaco-workbench .chat-widget ol > li::before,
.rendered-markdown ol > li::before {
  content: counter(chat-list-counter) ". " !important;
  color: #38bdf8 !important;
  font-weight: bold !important;
  margin-inline-end: 0.45em !important;
  display: inline-block !important;
  unicode-bidi: isolate !important;
}

.monaco-workbench .chat-widget ol > li:has(> p:first-child)::before,
.rendered-markdown ol > li:has(> p:first-child)::before {
  content: none !important;
  margin: 0 !important;
}

.monaco-workbench .chat-widget ol > li > p:first-child::before,
.rendered-markdown ol > li > p:first-child::before {
  content: counter(chat-list-counter) ". " !important;
  color: #38bdf8 !important;
  font-weight: bold !important;
  margin-inline-end: 0.45em !important;
  display: inline-block !important;
  unicode-bidi: isolate !important;
}

/* ── 6. Blockquotes: Glowing Cyan Border ──────────────────────────── */
.monaco-workbench .chat-widget blockquote,
.monaco-workbench .interactive-session blockquote,
.monaco-workbench .chat-container blockquote,
.monaco-workbench .interactive-container blockquote,
.monaco-workbench .part.auxiliarybar blockquote,
.monaco-workbench .part.sidebar blockquote,
.monaco-workbench .part.panel blockquote,
.rendered-markdown blockquote {
  border-left: none !important;
  border-inline-start: 4px solid #06b6d4 !important;
  background: rgba(6, 182, 212, 0.07) !important;
  padding: 8px 14px !important;
  border-radius: 4px !important;
  margin-inline-start: 0 !important;
  margin-inline-end: 0 !important;
  margin-top: 10px !important;
  margin-bottom: 10px !important;
}

/* ── 7. Inline Code & Monospace Blocks ─────────────────────────────── */
:not(pre) > code {
  font-family: Menlo, Monaco, Consolas, "Fira Code", monospace !important;
  direction: ltr !important;
  unicode-bidi: isolate !important;
  display: inline-block !important;
  background: rgba(15, 23, 42, 0.55) !important;
  border: 1px solid rgba(56, 189, 248, 0.25) !important;
  color: #38bdf8 !important;
  padding: 1px 6px !important;
  border-radius: 4px !important;
  font-size: 0.9em !important;
  vertical-align: baseline !important;
}

pre, code, pre *, code *, .monaco-editor, .monaco-editor *, .monaco-editor .view-line, .monaco-editor .view-line *, .view-lines {
  font-family: Menlo, Monaco, Consolas, "Fira Code", monospace !important;
  direction: ltr !important;
  unicode-bidi: embed !important;
  text-align: left !important;
}

/* ── 8. Tables ───────────────────────────────────────────────────── */
.monaco-workbench .chat-widget table,
.rendered-markdown table {
  border-collapse: separate !important;
  border-spacing: 0 !important;
  border-radius: 8px !important;
  overflow: hidden !important;
  border: 1px solid rgba(56, 189, 248, 0.2) !important;
  margin: 12px 0 !important;
  width: 100% !important;
}

.monaco-workbench .chat-widget th,
.rendered-markdown th {
  background: rgba(6, 182, 212, 0.12) !important;
  color: #38bdf8 !important;
  font-weight: 700 !important;
  padding: 8px 12px !important;
  border-bottom: 1px solid rgba(56, 189, 248, 0.2) !important;
  text-align: start !important;
}

.monaco-workbench .chat-widget td,
.rendered-markdown td {
  padding: 8px 12px !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
  text-align: start !important;
  unicode-bidi: plaintext !important;
}

/* RTL-PATCH-END */
/* [/Antigravity-Shield-RTL-Vazirmatn] */
"#;

#[tauri::command]
pub async fn get_antigravity_rtl_status() -> Result<AntigravityRtlStatus, String> {
    let mut desktop_asar = None;
    let mut desktop_patched = false;
    let mut desktop_backup = false;

    // 1. Detect Desktop 2.0 app.asar
    let possible_desktop_paths = vec![
        dirs::data_local_dir().map(|d| d.join("Programs").join("antigravity").join("resources").join("app.asar")),
        dirs::data_local_dir().map(|d| d.join("Programs").join("Antigravity").join("resources").join("app.asar")),
    ];

    for p in possible_desktop_paths.into_iter().flatten() {
        if p.exists() {
            desktop_asar = Some(p.to_string_lossy().to_string());
            let bak = format!("{}.bak", p.to_string_lossy());
            desktop_backup = Path::new(&bak).exists();

            if let Ok(content) = fs::read(&p) {
                // Check if patched signature exists in binary/archive
                let signature = b"Antigravity-Shield-RTL-Vazirmatn";
                desktop_patched = content.windows(signature.len()).any(|w| w == signature);
            }
            if !desktop_patched {
                if let Some(parent) = p.parent() {
                    let preload_p = parent.join("app").join("dist").join("preload.js");
                    if preload_p.exists() {
                        if let Ok(c) = fs::read_to_string(&preload_p) {
                            desktop_patched = c.contains("Antigravity-Shield-RTL-Vazirmatn");
                        }
                    }
                }
            }
            break;
        }
    }

    // 2. Detect IDE CSS path
    let mut ide_css = None;
    let mut ide_patched = false;
    let mut ide_backup = false;

    let possible_ide_paths = vec![
        dirs::data_local_dir().map(|d| d.join("Programs").join("Antigravity IDE").join("resources").join("app").join("out").join("vs").join("workbench").join("workbench.desktop.main.css")),
        dirs::data_local_dir().map(|d| d.join("Programs").join("antigravity-ide").join("resources").join("app").join("out").join("vs").join("workbench").join("workbench.desktop.main.css")),
    ];

    for p in possible_ide_paths.into_iter().flatten() {
        if p.exists() {
            ide_css = Some(p.to_string_lossy().to_string());
            let bak = format!("{}.bak", p.to_string_lossy());
            ide_backup = Path::new(&bak).exists();

            if let Ok(content) = fs::read_to_string(&p) {
                ide_patched = content.contains("Antigravity-Shield-RTL-Vazirmatn");
            }
            break;
        }
    }

    Ok(AntigravityRtlStatus {
        desktop_asar_path: desktop_asar,
        desktop_is_patched: desktop_patched,
        desktop_has_backup: desktop_backup,
        ide_css_path: ide_css,
        ide_is_patched: ide_patched,
        ide_has_backup: ide_backup,
    })
}

#[tauri::command]
pub async fn patch_antigravity_rtl() -> Result<String, String> {
    let status = get_antigravity_rtl_status().await?;
    let mut applied_count = 0;

    // Patch IDE CSS if found
    if let Some(css_path_str) = status.ide_css_path {
        let css_path = Path::new(&css_path_str);
        if css_path.exists() {
            let backup_path = format!("{}.bak", css_path_str);
            if !Path::new(&backup_path).exists() {
                let _ = fs::copy(css_path, &backup_path);
            }

            let mut content = fs::read_to_string(css_path).map_err(|e| e.to_string())?;
            if !content.contains("Antigravity-Shield-RTL-Vazirmatn") {
                content.push_str("\n");
                content.push_str(VAZIRMATN_RTL_CSS);
                fs::write(css_path, content).map_err(|e| e.to_string())?;
                applied_count += 1;
            }

            // Also patch Jetski Agent Chat CSS (jetskiMain.tailwind.css)
            if let Some(out_dir) = css_path.parent().and_then(|p| p.parent()).and_then(|p| p.parent()) {
                let jetski_css = out_dir.join("jetskiMain.tailwind.css");
                if jetski_css.exists() {
                    let jetski_bak = out_dir.join("jetskiMain.tailwind.css.bak");
                    if !jetski_bak.exists() {
                        let _ = fs::copy(&jetski_css, &jetski_bak);
                    }
                    if let Ok(mut jc) = fs::read_to_string(&jetski_css) {
                        if !jc.contains("Antigravity-Shield-RTL-Vazirmatn") {
                            jc.push_str("\n\n");
                            jc.push_str(VAZIRMATN_RTL_CSS);
                            let _ = fs::write(&jetski_css, &jc);
                            applied_count += 1;
                        }
                    }
                    if let Some(app_dir) = out_dir.parent() {
                        update_product_checksum(app_dir, "jetskiMain.tailwind.css", &jetski_css);
                    }
                }
                if let Some(app_dir) = out_dir.parent() {
                    update_product_checksum(app_dir, "vs/workbench/workbench.desktop.main.css", css_path);
                }
            }
        }
    }

    // Patch Desktop app.asar if node/npx or direct injection is possible
    if let Some(asar_path_str) = status.desktop_asar_path {
        let asar_path = Path::new(&asar_path_str);
        if asar_path.exists() && !status.desktop_is_patched {
            let backup_path = format!("{}.bak", asar_path_str);
            if !Path::new(&backup_path).exists() {
                let _ = fs::copy(asar_path, &backup_path);
            }

            // Extract, inject CSS, repack using npx asar
            let temp_dir = std::env::temp_dir().join("shield_antigravity_extract");
            let _ = fs::remove_dir_all(&temp_dir);

            let extract_res = Command::new("npx.cmd")
                .args(&["asar", "extract", &asar_path_str, &temp_dir.to_string_lossy()])
                .output();

            let success = match extract_res {
                Ok(out) if out.status.success() => true,
                _ => {
                    // Fallback to npx or powershell
                    let alt_res = Command::new("powershell")
                        .args(&[
                            "-NoProfile",
                            "-Command",
                            &format!("npx asar extract \"{}\" \"{}\"", asar_path_str, temp_dir.to_string_lossy())
                        ])
                        .output();
                    matches!(alt_res, Ok(o) if o.status.success())
                }
            };

            if success {
                // Find preload.js or index.html to inject style
                let mut patched_script = false;
                if let Ok(entries) = walk_dir_find(&temp_dir, "preload.js") {
                    for entry in entries {
                        if let Ok(content) = fs::read_to_string(&entry) {
                            if !content.contains("Antigravity-Shield-RTL-Vazirmatn") {
                                let inject_code = format!(
                                    r#"
/* [Antigravity-Shield-RTL-Vazirmatn] */
window.addEventListener('DOMContentLoaded', () => {{
    try {{
        const style = document.createElement('style');
        style.id = 'shield-rtl-vazirmatn-style';
        style.innerHTML = `{}`;
        document.head.appendChild(style);
    }} catch(e) {{}}
}});
/* [/Antigravity-Shield-RTL-Vazirmatn] */
"#,
                                    VAZIRMATN_RTL_CSS.replace('`', "\\`")
                                );
                                let _ = fs::write(&entry, format!("{}\n{}", content, inject_code));
                                patched_script = true;
                                break;
                            }
                        }
                    }
                }

                if patched_script {
                    // Pack back to app.asar
                    let _ = Command::new("npx.cmd")
                        .args(&["asar", "pack", &temp_dir.to_string_lossy(), &asar_path_str])
                        .output();
                    let _ = fs::remove_dir_all(&temp_dir);
                    applied_count += 1;
                }
            }
        }
    }

    if applied_count > 0 {
        Ok(format!("پچ راست‌چین و فونت وزیرمتن با موفقیت بر روی {} ماژول اعمال شد.", applied_count))
    } else {
        Ok("پچ پیش از این اعمال شده بود یا موردی برای تغییر یافت نشد.".into())
    }
}

#[tauri::command]
pub async fn restore_antigravity_rtl() -> Result<String, String> {
    let status = get_antigravity_rtl_status().await?;
    let mut restored_count = 0;

    // 1. Restore IDE CSS
    if let Some(css_path_str) = status.ide_css_path {
        let css_path = Path::new(&css_path_str);
        let backup_path = format!("{}.bak", css_path_str);
        if Path::new(&backup_path).exists() {
            fs::copy(&backup_path, css_path).map_err(|e| e.to_string())?;
            restored_count += 1;
        } else if css_path.exists() {
            // Clean up appended CSS block if backup doesn't exist
            if let Ok(content) = fs::read_to_string(css_path) {
                if let Some(pos) = content.find("/* [Antigravity-Shield-RTL-Vazirmatn] */") {
                    let cleaned = &content[..pos];
                    let _ = fs::write(css_path, cleaned.trim_end());
                    restored_count += 1;
                } else if let Some(pos) = content.find("/* RTL-PATCH-START */") {
                    let cleaned = &content[..pos];
                    let _ = fs::write(css_path, cleaned.trim_end());
                    restored_count += 1;
            }
        }

        // Also restore Jetski Agent CSS
        if let Some(out_dir) = css_path.parent().and_then(|p| p.parent()).and_then(|p| p.parent()) {
            let jetski_css = out_dir.join("jetskiMain.tailwind.css");
            let jetski_bak = out_dir.join("jetskiMain.tailwind.css.bak");
            if jetski_bak.exists() {
                let _ = fs::copy(&jetski_bak, &jetski_css);
                restored_count += 1;
            } else if jetski_css.exists() {
                if let Ok(content) = fs::read_to_string(&jetski_css) {
                    if let Some(pos) = content.find("/* [Antigravity-Shield-RTL-Vazirmatn] */") {
                        let cleaned = &content[..pos];
                        let _ = fs::write(&jetski_css, cleaned.trim_end());
                        restored_count += 1;
                    }
                }
            }
            if let Some(app_dir) = out_dir.parent() {
                update_product_checksum(app_dir, "vs/workbench/workbench.desktop.main.css", css_path);
                update_product_checksum(app_dir, "jetskiMain.tailwind.css", &jetski_css);
            }
        }
    }

    // 2. Restore Desktop app.asar and unpacked app directory
    if let Some(asar_path_str) = status.desktop_asar_path {
        let asar_path = Path::new(&asar_path_str);
        if let Some(parent) = asar_path.parent() {
            let app_dir = parent.join("app");
            if app_dir.exists() {
                let _ = fs::remove_dir_all(&app_dir);
                restored_count += 1;
            }
        }
        let backup_path = format!("{}.bak", asar_path_str);
        if Path::new(&backup_path).exists() {
            let _ = fs::copy(&backup_path, asar_path);
            restored_count += 1;
        }
    }

    if restored_count > 0 {
        Ok(format!("بازگردانی با موفقیت انجام شد. {} ماژول به حالت پیش‌فرض (LTR) بازگشتند.", restored_count))
    } else {
        Ok("فایل پشتیبانی برای بازگردانی یافت نشد.".into())
    }
}

fn update_product_checksum(app_dir: &Path, rel_key: &str, file_path: &Path) {
    use sha2::{Digest, Sha256};
    use base64::{Engine as _, engine::general_purpose::STANDARD};

    let product_path = app_dir.join("product.json");
    if !product_path.exists() || !file_path.exists() {
        return;
    }
    let file_bytes = match fs::read(file_path) {
        Ok(b) => b,
        Err(_) => return,
    };
    let mut hasher = Sha256::new();
    hasher.update(&file_bytes);
    let hash_result = hasher.finalize();
    let hash_b64 = STANDARD.encode(hash_result);
    let trimmed_hash = hash_b64.trim_end_matches('=');

    if let Ok(content) = fs::read_to_string(&product_path) {
        if let Ok(mut json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(checksums) = json.get_mut("checksums").and_then(|c| c.as_object_mut()) {
                checksums.insert(rel_key.to_string(), serde_json::Value::String(trimmed_hash.to_string()));
                if let Ok(serialized) = serde_json::to_string_pretty(&json) {
                    let _ = fs::write(&product_path, serialized);
                }
            }
        }
    }
}

fn walk_dir_find(dir: &Path, target_filename: &str) -> std::io::Result<Vec<std::path::PathBuf>> {
    let mut results = Vec::new();
    if dir.is_dir() {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                if let Ok(mut sub) = walk_dir_find(&path, target_filename) {
                    results.append(&mut sub);
                }
            } else if path.file_name().and_then(|n| n.to_str()) == Some(target_filename) {
                results.push(path);
            }
        }
    }
    Ok(results)
}

