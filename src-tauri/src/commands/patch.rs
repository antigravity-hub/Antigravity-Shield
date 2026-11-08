// Antigravity Shield — AI Proxy & Fleet Management Engine
// Repository: https://github.com/antigravity-hub/Antigravity-Shield

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

pub const VAZIRMATN_RTL_CSS: &str = r#"
@font-face {
  font-family: 'Vazirmatn';
  src: local('Vazirmatn'), local('Vazirmatn-Regular'), local('Vazir'),
       url('/__agy_rtl/vazirmatn.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200F;
}

/* [Antigravity-Emerald-Raindrop-Cascade-And-Bidi-List-Shield] - Live Neon Pulse & Ergonomic Tree */

@keyframes agyRaindropFlow {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 0 36px;
  }
}

@keyframes agyEmeraldPulseGlow {
  0%, 100% {
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.7), 0 0 12px rgba(16, 185, 129, 0.3);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 14px rgba(16, 185, 129, 0.95), 0 0 20px rgba(52, 211, 153, 0.6);
    transform: scale(1.15);
  }
}

@keyframes agyPulseGlow {
  0%, 100% {
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.7), 0 0 12px rgba(16, 185, 129, 0.3);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 14px rgba(16, 185, 129, 0.95), 0 0 20px rgba(52, 211, 153, 0.6);
    transform: scale(1.15);
  }
}

@keyframes agyCyanPulseGlow {
  0%, 100% {
    box-shadow: 0 0 6px rgba(6, 182, 212, 0.7), 0 0 12px rgba(56, 189, 248, 0.4);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 12px rgba(6, 182, 212, 0.95), 0 0 18px rgba(56, 189, 248, 0.7);
    transform: scale(1.18);
  }
}

/* Kill default browser markers completely so they NEVER jump to the left */
ul, ol, [role="article"] ul, [role="article"] ol,
.rendered-markdown ul, .rendered-markdown ol,
.animate-markdown ul, .animate-markdown ol,
[data-testid="conversation-view"] ul, [data-testid="conversation-view"] ol,
.jetski-custom-editor-pane ul, .jetski-custom-editor-pane ol,
[data-aux-pane-open] ul, [data-aux-pane-open] ol,
.part.auxiliarybar ul, .part.auxiliarybar ol,
div.break-words ul, div.break-words ol {
  list-style: none !important;
  list-style-type: none !important;
}

ul > li::marker, ol > li::marker,
[role="article"] ul > li::marker, [role="article"] ol > li::marker,
.rendered-markdown ul > li::marker, .rendered-markdown ol > li::marker,
.animate-markdown ul > li::marker, .animate-markdown ol > li::marker,
[data-testid="conversation-view"] ul > li::marker, [data-testid="conversation-view"] ol > li::marker,
.jetski-custom-editor-pane ul > li::marker, .jetski-custom-editor-pane ol > li::marker,
[data-aux-pane-open] ul > li::marker, [data-aux-pane-open] ol > li::marker,
.part.auxiliarybar ul > li::marker, .part.auxiliarybar ol > li::marker,
div.break-words ul > li::marker, div.break-words ol > li::marker {
  display: none !important;
  content: "" !important;
  font-size: 0 !important;
  color: transparent !important;
}

/* Persian Unordered List Container (Top-level) */
ul:dir(rtl), [dir="rtl"] ul, ul[dir="rtl"],
ul:has(> li:dir(rtl)), ul:has(> li[dir="rtl"]), ul:has(> li[dir="auto"]:dir(rtl)),
[role="article"] ul:has(> li:dir(rtl)),
[role="article"] ul,
.rendered-markdown ul:dir(rtl),
.rendered-markdown ul[dir="rtl"],
.animate-markdown ul:dir(rtl),
.animate-markdown ul[dir="rtl"],
[data-testid="conversation-view"] ul:has(> li:dir(rtl)),
[data-testid="conversation-view"] ul:dir(rtl),
[data-testid="conversation-view"] ul[dir="rtl"],
.jetski-custom-editor-pane ul:has(> li:dir(rtl)),
.jetski-custom-editor-pane ul:dir(rtl),
.jetski-custom-editor-pane ul[dir="rtl"],
[data-aux-pane-open] ul:has(> li:dir(rtl)),
[data-aux-pane-open] ul:dir(rtl),
[data-aux-pane-open] ul[dir="rtl"],
.part.auxiliarybar ul:has(> li:dir(rtl)),
.part.auxiliarybar ul:dir(rtl),
.part.auxiliarybar ul[dir="rtl"],
div.break-words ul:has(> li:dir(rtl)),
div.break-words ul:dir(rtl),
div.break-words ul[dir="rtl"] {
  list-style: none !important;
  margin: 0.75rem 0 !important;
  padding: 0 !important;
  padding-right: 28px !important;
  padding-left: 0 !important;
  margin-left: 0 !important;
  position: relative !important;
  direction: rtl !important;
  text-align: right !important;
}

/* Layer 1 List Item */
ul:dir(rtl) > li, [dir="rtl"] ul > li, ul[dir="rtl"] > li,
ul:has(> li:dir(rtl)) > li:dir(rtl), ul:has(> li:dir(rtl)) > li[dir="rtl"],
[role="article"] ul > li,
.rendered-markdown ul > li,
.animate-markdown ul > li,
[data-testid="conversation-view"] ul > li:dir(rtl),
[data-testid="conversation-view"] ul > li[dir="rtl"],
[data-testid="conversation-view"] ul:has(> li:dir(rtl)) > li,
.jetski-custom-editor-pane ul > li:dir(rtl),
.jetski-custom-editor-pane ul:has(> li:dir(rtl)) > li,
.part.auxiliarybar ul > li:dir(rtl),
.part.auxiliarybar ul:has(> li:dir(rtl)) > li,
div.break-words ul > li:dir(rtl),
div.break-words ul > li[dir="rtl"],
div.break-words ul:has(> li:dir(rtl)) > li {
  list-style: none !important;
  position: relative !important;
  padding-right: 0 !important;
  padding-left: 0 !important;
  margin-left: 0 !important;
  margin-bottom: 14px !important;
  line-height: 1.85 !important;
  color: #f1f5f9 !important;
  direction: rtl !important;
  text-align: justify !important;
  text-justify: inter-word !important;
  text-align-last: start !important;
}

/* Vertical Raindrop Animated Spine on Parent */
ul:dir(rtl) > li::before, [dir="rtl"] ul > li::before, ul[dir="rtl"] > li::before,
ul:has(> li:dir(rtl)) > li:dir(rtl)::before, ul:has(> li:dir(rtl)) > li[dir="rtl"]::before,
[role="article"] ul > li::before,
.rendered-markdown ul > li::before,
.animate-markdown ul > li::before,
[data-testid="conversation-view"] ul > li:dir(rtl)::before,
[data-testid="conversation-view"] ul > li[dir="rtl"]::before,
[data-testid="conversation-view"] ul:has(> li:dir(rtl)) > li::before,
.jetski-custom-editor-pane ul > li:dir(rtl)::before,
.jetski-custom-editor-pane ul:has(> li:dir(rtl)) > li::before,
.part.auxiliarybar ul > li:dir(rtl)::before,
.part.auxiliarybar ul:has(> li:dir(rtl)) > li::before,
div.break-words ul > li:dir(rtl)::before,
div.break-words ul > li[dir="rtl"]::before,
div.break-words ul:has(> li:dir(rtl)) > li::before {
  content: "" !important;
  position: absolute !important;
  right: -20px !important;
  top: 14px !important;
  bottom: -14px !important;
  width: 2px !important;
  background-image: repeating-linear-gradient(
    to bottom,
    rgba(16, 185, 129, 0.9) 0px,
    rgba(52, 211, 153, 0.4) 6px,
    transparent 10px,
    transparent 14px,
    rgba(16, 185, 129, 0.95) 20px,
    rgba(56, 189, 248, 0.8) 26px,
    transparent 30px
  ) !important;
  background-size: 2px 36px !important;
  animation: agyRaindropFlow 1.6s linear infinite !important;
  border-radius: 2px !important;
  opacity: 0.85 !important;
  z-index: 1 !important;
  display: block !important;
}

/* Last item in Layer 1 stops spine at the bullet ONLY if it has no nested sublist */
ul:dir(rtl) > li:last-child:not(:has(ul))::before,
[dir="rtl"] ul > li:last-child:not(:has(ul))::before,
ul[dir="rtl"] > li:last-child:not(:has(ul))::before,
[role="article"] ul > li:last-child:not(:has(ul))::before,
.rendered-markdown ul > li:last-child:not(:has(ul))::before,
.animate-markdown ul > li:last-child:not(:has(ul))::before,
[data-testid="conversation-view"] ul > li:last-child:not(:has(ul))::before,
.jetski-custom-editor-pane ul > li:last-child:not(:has(ul))::before,
.part.auxiliarybar ul > li:last-child:not(:has(ul))::before,
div.break-words ul > li:last-child:not(:has(ul))::before {
  bottom: 8px !important;
}

/* Layer 1 Glowing Emerald Node (The Bullet Droplet) */
ul:dir(rtl) > li::after, [dir="rtl"] ul > li::after, ul[dir="rtl"] > li::after,
ul:has(> li:dir(rtl)) > li:dir(rtl)::after, ul:has(> li:dir(rtl)) > li[dir="rtl"]::after,
[role="article"] ul > li::after,
.rendered-markdown ul > li::after,
.animate-markdown ul > li::after,
[data-testid="conversation-view"] ul > li:dir(rtl)::after,
[data-testid="conversation-view"] ul > li[dir="rtl"]::after,
[data-testid="conversation-view"] ul:has(> li:dir(rtl)) > li::after,
.jetski-custom-editor-pane ul > li:dir(rtl)::after,
.jetski-custom-editor-pane ul:has(> li:dir(rtl)) > li::after,
.part.auxiliarybar ul > li:dir(rtl)::after,
.part.auxiliarybar ul:has(> li:dir(rtl)) > li::after,
div.break-words ul > li:dir(rtl)::after,
div.break-words ul > li[dir="rtl"]::after,
div.break-words ul:has(> li:dir(rtl)) > li::after {
  content: "" !important;
  position: absolute !important;
  right: -25px !important;
  top: 7px !important;
  width: 12px !important;
  height: 12px !important;
  border-radius: 50% !important;
  background: radial-gradient(circle at 35% 35%, #a7f3d0 0%, #10b981 55%, #065f46 100%) !important;
  border: 1.5px solid rgba(255, 255, 255, 0.9) !important;
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.7) !important;
  animation: agyEmeraldPulseGlow 2.5s ease-in-out infinite !important;
  z-index: 3 !important;
  display: block !important;
}
  right: -25px !important;
  top: 7px !important;
  width: 12px !important;
  height: 12px !important;
  border-radius: 50% !important;
  background: radial-gradient(circle at 35% 35%, #a7f3d0 0%, #10b981 55%, #065f46 100%) !important;
  border: 1.5px solid rgba(255, 255, 255, 0.9) !important;
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.7) !important;
  animation: agyEmeraldPulseGlow 2.5s ease-in-out infinite !important;
  z-index: 3 !important;
  display: block !important;
}

/* ==========================================================================
   Layer 2: Nested Sub-Lists (اتصال بدون درز شاخه خمیده با ستون فقرات والد)
   ========================================================================== */
ul ul,
[role="article"] ul ul,
.rendered-markdown ul ul,
.rendered-markdown ul[dir="rtl"] ul,
.rendered-markdown [dir="rtl"] ul ul,
.rendered-markdown ul ul:dir(rtl),
.rendered-markdown ul:dir(rtl) ul,
.rendered-markdown ul:dir(rtl) ul:dir(rtl),
.animate-markdown ul ul,
.animate-markdown ul[dir="rtl"] ul,
.animate-markdown [dir="rtl"] ul ul,
.animate-markdown ul ul:dir(rtl),
.animate-markdown ul:dir(rtl) ul,
.animate-markdown ul:dir(rtl) ul:dir(rtl),
[role="article"] ul[dir="rtl"] ul,
[role="article"] [dir="rtl"] ul ul,
[role="article"] ul ul:dir(rtl),
[role="article"] ul:dir(rtl) ul,
[role="article"] ul:dir(rtl) ul:dir(rtl),
[dir="rtl"] ul ul,
ul[dir="rtl"] ul,
ul:dir(rtl) ul,
ul:dir(rtl) ul:dir(rtl),
[data-testid="conversation-view"] ul ul,
[data-testid="conversation-view"] ul ul:dir(rtl),
[data-testid="conversation-view"] ul[dir="rtl"] ul,
.jetski-custom-editor-pane ul ul,
[data-aux-pane-open] ul ul,
.part.auxiliarybar ul ul,
div.break-words ul ul,
div.break-words ul ul:dir(rtl),
div.break-words ul[dir="rtl"] ul,
ul:dir(rtl) > li > ul, [dir="rtl"] ul > li > ul, ul[dir="rtl"] > li > ul {
  position: relative !important;
  margin: 6px 0 8px 0 !important;
  margin-right: 0 !important;
  margin-inline-start: 0 !important;
  margin-left: 0 !important;
  margin-inline-end: 0 !important;
  padding: 0 !important;
  padding-right: 0 !important;
  padding-inline-start: 0 !important;
  padding-left: 0 !important;
  padding-inline-end: 0 !important;
  border: none !important;
  list-style: none !important;
}

ul ul > li,
[role="article"] ul ul > li,
.rendered-markdown ul ul > li,
.rendered-markdown ul[dir="rtl"] ul > li,
.rendered-markdown [dir="rtl"] ul ul > li,
.rendered-markdown ul ul:dir(rtl) > li,
.animate-markdown ul ul > li,
.animate-markdown ul[dir="rtl"] ul > li,
.animate-markdown [dir="rtl"] ul ul > li,
.animate-markdown ul ul:dir(rtl) > li,
[role="article"] ul[dir="rtl"] ul > li,
[role="article"] [dir="rtl"] ul ul > li,
[role="article"] ul ul:dir(rtl) > li,
[dir="rtl"] ul ul > li,
ul[dir="rtl"] ul > li,
ul:dir(rtl) ul > li,
ul:dir(rtl) ul:dir(rtl) > li,
[data-testid="conversation-view"] ul ul > li,
[data-testid="conversation-view"] ul ul > li:dir(rtl),
.jetski-custom-editor-pane ul ul > li,
[data-aux-pane-open] ul ul > li,
.part.auxiliarybar ul ul > li,
div.break-words ul ul > li,
div.break-words ul ul > li:dir(rtl),
ul:dir(rtl) > li > ul > li, [dir="rtl"] ul > li > ul > li {
  position: relative !important;
  padding-right: 14px !important;
  padding-left: 0 !important;
  margin-left: 0 !important;
  margin-bottom: 7px !important;
  color: #cbd5e1 !important;
  font-size: 0.93em !important;
  line-height: 1.75 !important;
  list-style: none !important;
}

/* Level 2 Sub-list Elbow Box: REMOVED COMPLETELY (Zero awkward floating boxes!) */
ul ul > li::before,
[role="article"] ul ul > li::before,
.rendered-markdown ul ul > li::before,
.rendered-markdown ul[dir="rtl"] ul > li::before,
.rendered-markdown [dir="rtl"] ul ul > li::before,
.rendered-markdown ul ul:dir(rtl) > li::before,
.animate-markdown ul ul > li::before,
.animate-markdown ul[dir="rtl"] ul > li::before,
.animate-markdown [dir="rtl"] ul ul > li::before,
.animate-markdown ul ul:dir(rtl) > li::before,
[role="article"] ul[dir="rtl"] ul > li::before,
[role="article"] [dir="rtl"] ul ul > li::before,
[role="article"] ul ul:dir(rtl) > li::before,
[dir="rtl"] ul ul > li::before,
ul[dir="rtl"] ul > li::before,
ul:dir(rtl) ul > li::before,
ul:dir(rtl) ul:dir(rtl) > li::before,
[data-testid="conversation-view"] ul ul > li::before,
[data-testid="conversation-view"] ul ul > li:dir(rtl)::before,
.jetski-custom-editor-pane ul ul > li::before,
[data-aux-pane-open] ul ul > li::before,
.part.auxiliarybar ul ul > li::before,
div.break-words ul ul > li::before,
div.break-words ul ul > li:dir(rtl)::before,
ul:dir(rtl) > li > ul > li::before,
ul ul > li:last-child::before,
.rendered-markdown ul ul > li:last-child::before,
[data-testid="conversation-view"] ul ul > li:last-child::before,
div.break-words ul ul > li:last-child::before {
  display: none !important;
  content: none !important;
  border: none !important;
  width: 0 !important;
  height: 0 !important;
  box-shadow: none !important;
}

/* Sleek Minimal Glowing Cyan Bullet Node (Tightly positioned 8-9px from text) */
ul ul > li::after,
[role="article"] ul ul > li::after,
.rendered-markdown ul ul > li::after,
.rendered-markdown ul[dir="rtl"] ul > li::after,
.rendered-markdown [dir="rtl"] ul ul > li::after,
.rendered-markdown ul ul:dir(rtl) > li::after,
.animate-markdown ul ul > li::after,
.animate-markdown ul[dir="rtl"] ul > li::after,
.animate-markdown [dir="rtl"] ul ul > li::after,
.animate-markdown ul ul:dir(rtl) > li::after,
[role="article"] ul[dir="rtl"] ul > li::after,
[role="article"] [dir="rtl"] ul ul > li::after,
[role="article"] ul ul:dir(rtl) > li::after,
[dir="rtl"] ul ul > li::after,
ul[dir="rtl"] ul > li::after,
ul:dir(rtl) ul > li::after,
ul:dir(rtl) ul:dir(rtl) > li::after,
[data-testid="conversation-view"] ul ul > li::after,
[data-testid="conversation-view"] ul ul > li:dir(rtl)::after,
.jetski-custom-editor-pane ul ul > li::after,
[data-aux-pane-open] ul ul > li::after,
.part.auxiliarybar ul ul > li::after,
div.break-words ul ul > li::after,
div.break-words ul ul > li:dir(rtl)::after,
ul:dir(rtl) > li > ul > li::after,
ul ul > li:last-child::after,
.rendered-markdown ul ul > li:last-child::after,
[data-testid="conversation-view"] ul ul > li:last-child::after,
div.break-words ul ul > li:last-child::after {
  content: "" !important;
  position: absolute !important;
  right: 0px !important;
  top: 10px !important;
  bottom: auto !important;
  width: 5px !important;
  height: 5px !important;
  border-radius: 50% !important;
  background: #06b6d4 !important;
  box-shadow: 0 0 6px rgba(6, 182, 212, 0.75), 0 0 10px rgba(56, 189, 248, 0.45) !important;
  border: none !important;
  animation: none !important;
  z-index: 3 !important;
  display: block !important;
}

/* ==========================================================================
   Layer 3: Multi-level Nested Sub-Lists (Level 3+)
   ========================================================================== */
ul ul ul,
[role="article"] ul ul ul,
.rendered-markdown ul ul ul,
.animate-markdown ul ul ul {
  position: relative !important;
  margin: 4px 0 6px 0 !important;
  margin-right: 0 !important;
  padding: 0 !important;
  padding-right: 0 !important;
  border: none !important;
  list-style: none !important;
}

ul ul ul > li,
[role="article"] ul ul ul > li,
.rendered-markdown ul ul ul > li,
.animate-markdown ul ul ul > li {
  position: relative !important;
  padding-right: 12px !important;
  padding-left: 0 !important;
  margin-bottom: 6px !important;
  color: #94a3b8 !important;
  font-size: 0.9em !important;
  line-height: 1.7 !important;
  list-style: none !important;
}

ul ul ul > li::before,
[role="article"] ul ul ul > li::before,
.rendered-markdown ul ul ul > li::before,
.animate-markdown ul ul ul > li::before {
  display: none !important;
  content: none !important;
  border: none !important;
  width: 0 !important;
  height: 0 !important;
}

ul ul ul > li::after,
[role="article"] ul ul ul > li::after,
.rendered-markdown ul ul ul > li::after,
.animate-markdown ul ul ul > li::after {
  content: "" !important;
  position: absolute !important;
  right: 0px !important;
  top: 10px !important;
  width: 4px !important;
  height: 4px !important;
  border-radius: 50% !important;
  background: #94a3b8 !important;
  box-shadow: 0 0 4px rgba(148, 163, 184, 0.5) !important;
  border: none !important;
  display: block !important;
}

/* ==========================================================================
   Numbered lists (OL): Persian Counter Anchored on the RIGHT (Markdown Content ONLY)
   ========================================================================== */
.rendered-markdown ol:dir(rtl),
.rendered-markdown [dir="rtl"] ol,
.rendered-markdown ol[dir="rtl"],
.rendered-markdown ol:has(> li:dir(rtl)),
.prose ol:dir(rtl),
.prose [dir="rtl"] ol,
.prose ol[dir="rtl"],
.prose ol:has(> li:dir(rtl)) {
  counter-reset: agy-counter !important;
  list-style: none !important;
  margin: 0.8rem 0 !important;
  padding: 0 !important;
  padding-right: 32px !important;
  padding-left: 0 !important;
  margin-left: 0 !important;
  position: relative !important;
  direction: rtl !important;
  text-align: justify !important;
  text-justify: inter-word !important;
}

.rendered-markdown ol:dir(rtl) > li,
.rendered-markdown [dir="rtl"] ol > li,
.rendered-markdown ol[dir="rtl"] > li,
.rendered-markdown ol:has(> li:dir(rtl)) > li,
.prose ol:dir(rtl) > li,
.prose [dir="rtl"] ol > li,
.prose ol[dir="rtl"] > li,
.prose ol:has(> li:dir(rtl)) > li {
  counter-increment: agy-counter !important;
  list-style: none !important;
  position: relative !important;
  padding-right: 18px !important;
  padding-left: 0 !important;
  margin-left: 0 !important;
  margin-bottom: 12px !important;
  line-height: 2 !important;
  color: #f1f5f9 !important;
  direction: rtl !important;
  text-align: justify !important;
  text-justify: inter-word !important;
  text-align-last: start !important;
}

/* Custom Styled Number Badge on the RIGHT - In Markdown ONLY */
.rendered-markdown ol:dir(rtl) > li::before,
.rendered-markdown [dir="rtl"] ol > li::before,
.rendered-markdown ol[dir="rtl"] > li::before,
.rendered-markdown ol:has(> li:dir(rtl)) > li::before,
.prose ol:dir(rtl) > li::before,
.prose [dir="rtl"] ol > li::before,
.prose ol[dir="rtl"] > li::before,
.prose ol:has(> li:dir(rtl)) > li::before {
  content: counter(agy-counter) "." !important;
  position: absolute !important;
  right: -24px !important;
  top: 0px !important;
  color: #34d399 !important;
  font-weight: 800 !important;
  font-size: 1.1em !important;
  font-family: 'Vazirmatn', sans-serif !important;
  text-shadow: 0 0 10px rgba(52, 211, 153, 0.4) !important;
  display: inline-block !important;
  width: 22px !important;
  text-align: left !important;
  direction: ltr !important;
}

/* Strict Immunity for Outer Conversation Turn Containers (Kill phantom 1 2 3... on left) */
[data-testid="conversation-view"] > ol,
[data-testid="conversation-view"] > ol > li,
[data-testid="conversation-view"] > div > ol,
[data-testid="conversation-view"] > div > ol > li,
[role="article"] > ol,
[role="article"] > ol > li,
ol[role="log"],
ol[role="log"] > li,
ol.conversation-turns,
ol.conversation-turns > li {
  list-style: none !important;
  counter-reset: none !important;
  counter-increment: none !important;
}

[data-testid="conversation-view"] > ol > li::before,
[data-testid="conversation-view"] > ol > li::after,
[data-testid="conversation-view"] > div > ol > li::before,
[data-testid="conversation-view"] > div > ol > li::after,
[role="article"] > ol > li::before,
[role="article"] > ol > li::after,
ol[role="log"] > li::before,
ol[role="log"] > li::after,
ol.conversation-turns > li::before,
ol.conversation-turns > li::after {
  content: none !important;
  display: none !important;
}

ol:dir(rtl) > li::after, [dir="rtl"] ol > li::after, ol[dir="rtl"] > li::after,
[role="article"] ol > li::after,
[data-testid="conversation-view"] ol > li::after,
div.break-words ol > li::after {
  content: none !important;
  display: none !important;
}

/* Universal Vazirmatn Font Enforcement on Monaco Workbench & Whole App */
.monaco-workbench,
.monaco-workbench.windows,
.monaco-workbench.mac,
.monaco-workbench.linux,
.font-sans,
[class*="font-sans"],
body,
html,
#root {
  font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif !important;
}

/* RTL-PATCH-START */

@font-face {
  font-family: 'Vazirmatn';
  src: local('Vazirmatn'), local('Vazirmatn-Regular'), local('Vazir'),
       url('/__agy_rtl/vazirmatn.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200F;
}

:root {
  --default-font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif !important;
  --font-sans: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif !important;
  --font-display: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif !important;
}

body, html, #root {
  font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif !important;
}

/* ==========================================================================
   1. Dynamic BiDi (RTL/LTR Auto-Detection) & Full Justification
   ========================================================================== */

/* User Input Bubble & Sent Prompt Turns: Auto-detect English (LTR) vs Persian (RTL) */
[data-testid="user-input-step"],
[data-testid="user-input-step"] *,
[class*="group/user-input-step"],
[class*="group/user-input-step"] *,
.interactive-item-container.interactive-request,
.interactive-item-container.interactive-request * {
  font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif !important;
}

[data-testid="user-input-step"] .whitespace-pre-wrap,
[data-testid="user-input-step"] [class*="whitespace-pre-wrap"],
.interactive-item-container.interactive-request .value,
.interactive-request .value {
  unicode-bidi: plaintext !important;
  text-align: start !important;
  line-height: 1.85 !important;
}

/* Markdown Body & Paragraphs: Full Justification (Full Align) with BiDi Auto-Detection */
.rendered-markdown,
.chat-widget .rendered-markdown,
.interactive-session .rendered-markdown,
.antigravity-agent-side-panel,
.antigravity-agent-manager,
.animate-markdown,
[role="article"] {
  font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif !important;
}

[role="article"] p,
[role="article"] li,
[role="article"] dd,
[role="article"] dt,
.rendered-markdown p,
.rendered-markdown li,
.rendered-markdown dd,
.rendered-markdown dt,
.chat-widget .rendered-markdown p,
.chat-widget .rendered-markdown li,
.antigravity-agent-side-panel p,
.antigravity-agent-side-panel li,
.antigravity-agent-manager p,
.antigravity-agent-manager li,
.animate-markdown p,
.animate-markdown li {
  font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif !important;
  unicode-bidi: plaintext !important;
  text-align: justify !important;
  text-justify: inter-word !important;
  text-align-last: auto !important;
  line-height: 2.1 !important;
  margin-bottom: 1rem !important;
}

/* Persian Paragraphs & Lists: Force Direction RTL, Right-Align Last Line */
[role="article"] li:dir(rtl),
.rendered-markdown li:dir(rtl),
.chat-widget .rendered-markdown li:dir(rtl),
.antigravity-agent-side-panel li:dir(rtl),
.antigravity-agent-manager li:dir(rtl),
.animate-markdown li:dir(rtl),
[role="article"] [dir="rtl"] li,
.rendered-markdown [dir="rtl"] li,
li:dir(rtl),
li[dir="rtl"],
li[dir="auto"]:dir(rtl),
[data-testid="conversation-view"] li:dir(rtl),
[data-testid="conversation-view"] li[dir="rtl"],
div.break-words li:dir(rtl),
div.break-words li[dir="rtl"],
.jetski-custom-editor-pane li:dir(rtl),
.part.auxiliarybar li:dir(rtl),
[data-aux-pane-open] li:dir(rtl),
[role="article"] ul:has(> li:dir(rtl)),
[role="article"] ol:has(> li:dir(rtl)),
.rendered-markdown ul:has(> li:dir(rtl)),
.rendered-markdown ol:has(> li:dir(rtl)),
.animate-markdown ul:has(> li:dir(rtl)),
.animate-markdown ol:has(> li:dir(rtl)),
[data-testid="conversation-view"] ul:has(> li:dir(rtl)),
[data-testid="conversation-view"] ol:has(> li:dir(rtl)),
div.break-words ul:has(> li:dir(rtl)),
div.break-words ol:has(> li:dir(rtl)),
.jetski-custom-editor-pane ul:has(> li:dir(rtl)),
.jetski-custom-editor-pane ol:has(> li:dir(rtl)),
.part.auxiliarybar ul:has(> li:dir(rtl)),
.part.auxiliarybar ol:has(> li:dir(rtl)),
ul[dir="rtl"],
ol[dir="rtl"] {
  direction: rtl !important;
  text-align: justify !important;
  text-justify: inter-word !important;
  text-align-last: start !important;
}

[role="article"] li:dir(rtl) p,
.rendered-markdown li:dir(rtl) p,
.chat-widget .rendered-markdown li:dir(rtl),
.antigravity-agent-side-panel li:dir(rtl) p,
.antigravity-agent-manager li:dir(rtl) p,
.animate-markdown li:dir(rtl) p,
[data-testid="conversation-view"] li:dir(rtl) p,
div.break-words li:dir(rtl) p,
.jetski-custom-editor-pane li:dir(rtl) p,
.part.auxiliarybar li:dir(rtl) p,
[data-aux-pane-open] li:dir(rtl) p {
  direction: rtl !important;
  text-align: justify !important;
  text-justify: inter-word !important;
  text-align-last: start !important;
}

/* Persian Paragraphs & Lists: Force Direction RTL, Right-Align Last Line */
[role="article"] p:dir(rtl),
.rendered-markdown p:dir(rtl),
.chat-widget .rendered-markdown p:dir(rtl),
[role="article"] [dir="rtl"] p,
.rendered-markdown [dir="rtl"] p,
p:dir(rtl),
p[dir="rtl"],
p[dir="auto"]:dir(rtl),
[data-testid="conversation-view"] p:dir(rtl),
div.break-words p:dir(rtl),
.jetski-custom-editor-pane p:dir(rtl),
.part.auxiliarybar p:dir(rtl),
[data-aux-pane-open] p:dir(rtl) {
  direction: rtl !important;
  text-align: justify !important;
  text-justify: inter-word !important;
  text-align-last: start !important;
  unicode-bidi: isolate !important;
  line-height: 2 !important;
}

/* Isolate embedded English/code in RTL without breaking Persian word order */
[dir="rtl"] :is(code, pre, .monaco-editor, [dir="ltr"]) {
  unicode-bidi: isolate !important;
  direction: ltr !important;
}

/* ==========================================================================
   2. Headings: Seafoam Green (#93e9be) Palette with Gradient Background
   ========================================================================== */
[role="article"] h1,
[role="article"] h2,
[role="article"] h3,
[role="article"] h4,
[role="article"] h5,
[role="article"] h6,
.rendered-markdown h1,
.rendered-markdown h2,
.rendered-markdown h3,
.rendered-markdown h4,
.rendered-markdown h5,
.rendered-markdown h6,
.chat-widget .rendered-markdown h1,
.chat-widget .rendered-markdown h2,
.chat-widget .rendered-markdown h3,
.chat-widget .rendered-markdown h4,
.chat-widget .rendered-markdown h5,
.chat-widget .rendered-markdown h6,
.antigravity-agent-side-panel h1,
.antigravity-agent-side-panel h2,
.antigravity-agent-side-panel h3,
.antigravity-agent-side-panel h4,
.antigravity-agent-side-panel h5,
.antigravity-agent-side-panel h6,
.antigravity-agent-manager h1,
.antigravity-agent-manager h2,
.antigravity-agent-manager h3,
.antigravity-agent-manager h4,
.antigravity-agent-manager h5,
.antigravity-agent-manager h6,
.animate-markdown h1,
.animate-markdown h2,
.animate-markdown h3,
.animate-markdown h4,
.animate-markdown h5,
.animate-markdown h6,
[data-testid="conversation-view"] h1,
[data-testid="conversation-view"] h2,
[data-testid="conversation-view"] h3,
[data-testid="conversation-view"] h4,
[data-testid="conversation-view"] h5,
[data-testid="conversation-view"] h6,
div.break-words h1,
div.break-words h2,
div.break-words h3,
div.break-words h4,
div.break-words h5,
div.break-words h6,
.jetski-custom-editor-pane h1,
.jetski-custom-editor-pane h2,
.jetski-custom-editor-pane h3,
.jetski-custom-editor-pane h4,
.jetski-custom-editor-pane h5,
.jetski-custom-editor-pane h6,
.part.auxiliarybar h1,
.part.auxiliarybar h2,
.part.auxiliarybar h3,
.part.auxiliarybar h4,
.part.auxiliarybar h5,
.part.auxiliarybar h6,
[data-aux-pane-open] h1,
[data-aux-pane-open] h2,
[data-aux-pane-open] h3,
[data-aux-pane-open] h4,
[data-aux-pane-open] h5,
[data-aux-pane-open] h6 {
  font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif !important;
  font-weight: 700 !important;
  unicode-bidi: plaintext !important;
  margin-top: 1.5rem !important;
  margin-bottom: 0.75rem !important;
  letter-spacing: -0.01em !important;
  display: block !important;
  box-sizing: border-box !important;
  padding: 6px 0 !important;
  line-height: 1.5 !important;
}

/* Clean Heading Typography with Natural BiDi Alignment */
[role="article"] h1, [role="article"] h2, [role="article"] h3,
[role="article"] h4, [role="article"] h5, [role="article"] h6,
.rendered-markdown h1, .rendered-markdown h2, .rendered-markdown h3,
.rendered-markdown h4, .rendered-markdown h5, .rendered-markdown h6,
.chat-widget .rendered-markdown h1, .chat-widget .rendered-markdown h2,
.antigravity-agent-side-panel h1, .antigravity-agent-manager h1,
.animate-markdown h1, .animate-markdown h2,
[data-testid="conversation-view"] h1, [data-testid="conversation-view"] h2, [data-testid="conversation-view"] h3,
[data-testid="conversation-view"] h4, [data-testid="conversation-view"] h5, [data-testid="conversation-view"] h6,
div.break-words h1, div.break-words h2, div.break-words h3,
div.break-words h4, div.break-words h5, div.break-words h6,
.jetski-custom-editor-pane h1, .jetski-custom-editor-pane h2, .jetski-custom-editor-pane h3,
.jetski-custom-editor-pane h4, .jetski-custom-editor-pane h5, .jetski-custom-editor-pane h6,
.part.auxiliarybar h1, .part.auxiliarybar h2, .part.auxiliarybar h3,
.part.auxiliarybar h4, .part.auxiliarybar h5, .part.auxiliarybar h6,
[data-aux-pane-open] h1, [data-aux-pane-open] h2, [data-aux-pane-open] h3,
[data-aux-pane-open] h4, [data-aux-pane-open] h5, [data-aux-pane-open] h6 {
  unicode-bidi: plaintext !important;
  text-align: start !important;
}

/* Persian Headings: Strictly right-align & reset left padding (Universal IDE & Platform) */
h1:dir(rtl), h2:dir(rtl), h3:dir(rtl), h4:dir(rtl), h5:dir(rtl), h6:dir(rtl),
h1[dir="rtl"], h2[dir="rtl"], h3[dir="rtl"], h4[dir="rtl"], h5[dir="rtl"], h6[dir="rtl"],
[dir="rtl"] h1, [dir="rtl"] h2, [dir="rtl"] h3, [dir="rtl"] h4, [dir="rtl"] h5, [dir="rtl"] h6,
[role="article"] h1:dir(rtl), [role="article"] h2:dir(rtl), [role="article"] h3:dir(rtl),
[role="article"] h4:dir(rtl), [role="article"] h5:dir(rtl), [role="article"] h6:dir(rtl),
[role="article"] [dir="rtl"] h1, [role="article"] [dir="rtl"] h2, [role="article"] [dir="rtl"] h3,
[role="article"] [dir="rtl"] h4, [role="article"] [dir="rtl"] h5, [role="article"] [dir="rtl"] h6,
[role="article"] h1[dir="rtl"], [role="article"] h2[dir="rtl"], [role="article"] h3[dir="rtl"],
[role="article"] h4[dir="rtl"], [role="article"] h5[dir="rtl"], [role="article"] h6[dir="rtl"],
.rendered-markdown h1:dir(rtl), .rendered-markdown h2:dir(rtl), .rendered-markdown h3:dir(rtl),
.rendered-markdown h4:dir(rtl), .rendered-markdown h5:dir(rtl), .rendered-markdown h6:dir(rtl),
.rendered-markdown [dir="rtl"] h1, .rendered-markdown [dir="rtl"] h2, .rendered-markdown [dir="rtl"] h3,
[data-testid="conversation-view"] h1:dir(rtl), [data-testid="conversation-view"] h2:dir(rtl), [data-testid="conversation-view"] h3:dir(rtl),
[data-testid="conversation-view"] h4:dir(rtl), [data-testid="conversation-view"] h5:dir(rtl), [data-testid="conversation-view"] h6:dir(rtl),
[data-testid="conversation-view"] h1[dir="rtl"], [data-testid="conversation-view"] h2[dir="rtl"], [data-testid="conversation-view"] h3[dir="rtl"],
[data-testid="conversation-view"] h4[dir="rtl"], [data-testid="conversation-view"] h5[dir="rtl"], [data-testid="conversation-view"] h6[dir="rtl"],
div.break-words h1:dir(rtl), div.break-words h2:dir(rtl), div.break-words h3:dir(rtl),
div.break-words h4:dir(rtl), div.break-words h5:dir(rtl), div.break-words h6:dir(rtl),
div.break-words h1[dir="rtl"], div.break-words h2[dir="rtl"], div.break-words h3[dir="rtl"],
div.break-words h4[dir="rtl"], div.break-words h5[dir="rtl"], div.break-words h6[dir="rtl"],
.jetski-custom-editor-pane h1:dir(rtl), .jetski-custom-editor-pane h2:dir(rtl), .jetski-custom-editor-pane h3:dir(rtl),
.jetski-custom-editor-pane h4:dir(rtl), .jetski-custom-editor-pane h5:dir(rtl), .jetski-custom-editor-pane h6:dir(rtl),
.part.auxiliarybar h1:dir(rtl), .part.auxiliarybar h2:dir(rtl), .part.auxiliarybar h3:dir(rtl),
.part.auxiliarybar h4:dir(rtl), .part.auxiliarybar h5:dir(rtl), .part.auxiliarybar h6:dir(rtl),
[data-aux-pane-open] h1:dir(rtl), [data-aux-pane-open] h2:dir(rtl), [data-aux-pane-open] h3:dir(rtl),
[data-aux-pane-open] h4:dir(rtl), [data-aux-pane-open] h5:dir(rtl), [data-aux-pane-open] h6:dir(rtl) {
  direction: rtl !important;
  text-align: justify !important;
  text-justify: inter-word !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
  margin-left: 0 !important;
}

.rendered-markdown h1,
.chat-widget .rendered-markdown h1,
.antigravity-agent-side-panel h1,
.antigravity-agent-manager h1,
.animate-markdown h1,
[data-testid="conversation-view"] h1,
div.break-words h1,
.jetski-custom-editor-pane h1,
.part.auxiliarybar h1,
[data-aux-pane-open] h1 {
  font-size: 1.45rem !important;
  color: #93e9be !important;
  border-bottom: 1px solid rgba(147, 233, 190, 0.3) !important;
  padding-bottom: 0.4rem !important;
}

.rendered-markdown h2,
.chat-widget .rendered-markdown h2,
.antigravity-agent-side-panel h2,
.antigravity-agent-manager h2,
.animate-markdown h2,
[data-testid="conversation-view"] h2,
div.break-words h2,
.jetski-custom-editor-pane h2,
.part.auxiliarybar h2,
[data-aux-pane-open] h2 {
  font-size: 1.25rem !important;
  color: #93e9be !important;
}

.rendered-markdown h3,
.chat-widget .rendered-markdown h3,
.antigravity-agent-side-panel h3,
.antigravity-agent-manager h3,
.animate-markdown h3,
[data-testid="conversation-view"] h3,
div.break-words h3,
.jetski-custom-editor-pane h3,
.part.auxiliarybar h3,
[data-aux-pane-open] h3 {
  font-size: 1.12rem !important;
  color: #a7f3d0 !important;
}

.rendered-markdown h4,
.rendered-markdown h5,
.rendered-markdown h6,
.chat-widget .rendered-markdown h4,
.chat-widget .rendered-markdown h5,
.chat-widget .rendered-markdown h6,
.antigravity-agent-side-panel h4,
.antigravity-agent-side-panel h5,
.antigravity-agent-side-panel h6,
.antigravity-agent-manager h4,
.antigravity-agent-manager h5,
.antigravity-agent-manager h6,
.animate-markdown h4,
.animate-markdown h5,
.animate-markdown h6,
[data-testid="conversation-view"] h4,
[data-testid="conversation-view"] h5,
[data-testid="conversation-view"] h6,
div.break-words h4,
div.break-words h5,
div.break-words h6,
.jetski-custom-editor-pane h4,
.jetski-custom-editor-pane h5,
.jetski-custom-editor-pane h6,
.part.auxiliarybar h4,
.part.auxiliarybar h5,
.part.auxiliarybar h6,
[data-aux-pane-open] h4,
[data-aux-pane-open] h5,
[data-aux-pane-open] h6 {
  font-size: 1rem !important;
  color: #bbf7d0 !important;
}

/* ==========================================================================
   3. Highlighted List Titles, Numbered Points & Typography
   ========================================================================== */
.rendered-markdown li,
.chat-widget .rendered-markdown li,
.antigravity-agent-side-panel li,
.antigravity-agent-manager li,
.animate-markdown li,
[data-testid="conversation-view"] li,
div.break-words li,
.jetski-custom-editor-pane li,
.part.auxiliarybar li,
[data-aux-pane-open] li {
  font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif !important;
  unicode-bidi: plaintext !important;
  text-align: justify !important;
  text-justify: inter-word !important;
  text-align-last: start !important;
}

/* Highlight list titles/numbered points: e.g. "۱. نقطه دقیق سوییچ" */
.rendered-markdown li > strong:first-child,
.rendered-markdown li > p:first-child > strong:first-child,
.chat-widget .rendered-markdown li > strong:first-child,
.chat-widget .rendered-markdown li > p:first-child > strong:first-child,
.antigravity-agent-side-panel li > strong:first-child,
.antigravity-agent-side-panel li > p:first-child > strong:first-child,
[data-testid="conversation-view"] li > strong:first-child,
[data-testid="conversation-view"] li > p:first-child > strong:first-child,
div.break-words li > strong:first-child,
div.break-words li > p:first-child > strong:first-child,
.jetski-custom-editor-pane li > strong:first-child,
.jetski-custom-editor-pane li > p:first-child > strong:first-child,
.part.auxiliarybar li > strong:first-child,
.part.auxiliarybar li > p:first-child > strong:first-child,
[data-aux-pane-open] li > strong:first-child,
[data-aux-pane-open] li > p:first-child > strong:first-child {
  color: #93e9be !important;
  font-weight: 700 !important;
}

/* General strong emphasis: harmonized soft seafoam tint */
.rendered-markdown strong,
.chat-widget .rendered-markdown strong,
[data-testid="conversation-view"] strong,
div.break-words strong,
.jetski-custom-editor-pane strong,
.part.auxiliarybar strong,
[data-aux-pane-open] strong {
  color: #c6f6d5 !important;
  font-weight: 700 !important;
}

.rendered-markdown li:dir(ltr),
.chat-widget .rendered-markdown li:dir(ltr),
[dir="ltr"] .rendered-markdown li {
  padding-left: 0.25rem !important;
  padding-right: 0 !important;
}

.rendered-markdown ul:dir(ltr),
.rendered-markdown ol:dir(ltr),
.chat-widget .rendered-markdown ul:dir(ltr),
.chat-widget .rendered-markdown ol:dir(ltr),
[dir="ltr"] .rendered-markdown ul,
[dir="ltr"] .rendered-markdown ol {
  padding-left: 1.75rem !important;
  padding-right: 0 !important;
}

/* ==========================================================================
   4. Blockquotes & GitHub Alerts (TIP, NOTE, IMPORTANT, WARNING, CAUTION)
   ========================================================================== */

/* Immunity against nested wrapper artifacts (Eliminate double-border glitch line) */
blockquote:has(.markdown-alert),
.rendered-markdown blockquote:has(.markdown-alert),
[role="article"] blockquote:has(.markdown-alert),
.chat-widget .rendered-markdown blockquote:has(.markdown-alert),
blockquote:has(> .markdown-alert),
.markdown-alert blockquote {
  border: none !important;
  padding: 0 !important;
  margin: 0 !important;
  background: transparent !important;
  backdrop-filter: none !important;
  box-shadow: none !important;
  border-radius: 0 !important;
}

/* Standalone Clean Blockquotes */
.rendered-markdown blockquote:not(:has(.markdown-alert)),
[role="article"] blockquote:not(:has(.markdown-alert)),
.chat-widget .rendered-markdown blockquote:not(:has(.markdown-alert)),
.antigravity-agent-side-panel blockquote:not(:has(.markdown-alert)),
.antigravity-agent-manager blockquote:not(:has(.markdown-alert)),
.animate-markdown blockquote:not(:has(.markdown-alert)) {
  border: none !important;
  border-inline-start: 4px solid #93e9be !important;
  border-radius: 8px !important;
  padding: 12px 16px !important;
  margin: 16px 0 !important;
  background: rgba(147, 233, 190, 0.08) !important;
  unicode-bidi: plaintext !important;
  text-align: justify !important;
  text-justify: inter-word !important;
  text-align-last: start !important;
}

/* Clean Single-Container Markdown Alerts */
.markdown-alert,
[role="article"] .markdown-alert,
.rendered-markdown .markdown-alert,
.chat-widget .rendered-markdown .markdown-alert,
.antigravity-agent-side-panel .markdown-alert,
.antigravity-agent-manager .markdown-alert,
.animate-markdown .markdown-alert {
  border: 1px solid rgba(147, 233, 190, 0.22) !important;
  border-inline-start: 4px solid #93e9be !important;
  border-radius: 8px !important;
  padding: 12px 16px !important;
  margin: 16px 0 !important;
  box-sizing: border-box !important;
  unicode-bidi: plaintext !important;
  text-align: justify !important;
  text-justify: inter-word !important;
  text-align-last: start !important;
}

.markdown-alert.markdown-alert-tip,
[role="article"] .markdown-alert.markdown-alert-tip,
.rendered-markdown .markdown-alert.markdown-alert-tip {
  border-inline-start-color: #93e9be !important;
  border-color: rgba(147, 233, 190, 0.28) !important;
  background: linear-gradient(135deg, rgba(147, 233, 190, 0.12) 0%, rgba(147, 233, 190, 0.04) 100%) !important;
}

.markdown-alert.markdown-alert-tip .markdown-alert-title,
[role="article"] .markdown-alert.markdown-alert-tip .markdown-alert-title,
.rendered-markdown .markdown-alert.markdown-alert-tip .markdown-alert-title {
  color: #93e9be !important;
  font-weight: 700 !important;
  margin-bottom: 6px !important;
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
}

.markdown-alert.markdown-alert-note,
[role="article"] .markdown-alert.markdown-alert-note,
.rendered-markdown .markdown-alert.markdown-alert-note {
  border-inline-start-color: #38bdf8 !important;
  border-color: rgba(56, 189, 248, 0.28) !important;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(56, 189, 248, 0.04) 100%) !important;
}

.markdown-alert.markdown-alert-note .markdown-alert-title,
[role="article"] .markdown-alert.markdown-alert-note .markdown-alert-title,
.rendered-markdown .markdown-alert.markdown-alert-note .markdown-alert-title {
  color: #38bdf8 !important;
  font-weight: 700 !important;
  margin-bottom: 6px !important;
}

.markdown-alert.markdown-alert-important,
[role="article"] .markdown-alert.markdown-alert-important,
.rendered-markdown .markdown-alert.markdown-alert-important {
  border-inline-start-color: #a78bfa !important;
  border-color: rgba(167, 139, 250, 0.28) !important;
  background: linear-gradient(135deg, rgba(167, 139, 250, 0.12) 0%, rgba(167, 139, 250, 0.04) 100%) !important;
}

.markdown-alert.markdown-alert-important .markdown-alert-title,
[role="article"] .markdown-alert.markdown-alert-important .markdown-alert-title,
.rendered-markdown .markdown-alert.markdown-alert-important .markdown-alert-title {
  color: #c4b5fd !important;
  font-weight: 700 !important;
  margin-bottom: 6px !important;
}

.markdown-alert.markdown-alert-warning,
[role="article"] .markdown-alert.markdown-alert-warning,
.rendered-markdown .markdown-alert.markdown-alert-warning {
  border-inline-start-color: #f59e0b !important;
  border-color: rgba(245, 158, 11, 0.28) !important;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.04) 100%) !important;
}

.markdown-alert.markdown-alert-warning .markdown-alert-title,
[role="article"] .markdown-alert.markdown-alert-warning .markdown-alert-title,
.rendered-markdown .markdown-alert.markdown-alert-warning .markdown-alert-title {
  color: #fbbf24 !important;
  font-weight: 700 !important;
  margin-bottom: 6px !important;
}

.markdown-alert.markdown-alert-caution,
[role="article"] .markdown-alert.markdown-alert-caution,
.rendered-markdown .markdown-alert.markdown-alert-caution {
  border-inline-start-color: #ef4444 !important;
  border-color: rgba(239, 68, 68, 0.28) !important;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(239, 68, 68, 0.04) 100%) !important;
}

.markdown-alert.markdown-alert-caution .markdown-alert-title,
[role="article"] .markdown-alert.markdown-alert-caution .markdown-alert-title,
.rendered-markdown .markdown-alert.markdown-alert-caution .markdown-alert-title {
  color: #f87171 !important;
  font-weight: 700 !important;
  margin-bottom: 6px !important;
}

/* ==========================================================================
   5. Inputs & Textareas BiDi
   ========================================================================== */
textarea, input[type="text"], input:not([type]), [contenteditable="true"] {
  font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif !important;
  unicode-bidi: plaintext !important;
}

textarea:dir(rtl), input:dir(rtl), [contenteditable="true"]:dir(rtl),
textarea[dir="rtl"], input[dir="rtl"], [contenteditable="true"][dir="rtl"] {
  direction: rtl !important;
  text-align: justify !important;
  text-justify: inter-word !important;
}

textarea:dir(ltr), input:dir(ltr), [contenteditable="true"]:dir(ltr),
textarea[dir="ltr"], input[dir="ltr"], [contenteditable="true"][dir="ltr"] {
  direction: ltr !important;
  text-align: left !important;
}

/* ==========================================================================
   6. Seafoam Green Luxury Markdown Tables (#93e9be)
   ========================================================================== */
.rendered-markdown table,
.chat-widget .rendered-markdown table,
.antigravity-agent-side-panel table,
.antigravity-agent-manager table,
.animate-markdown table {
  border-collapse: separate !important;
  border-spacing: 0 !important;
  border-radius: 8px !important;
  overflow: hidden !important;
  border: 1px solid rgba(147, 233, 190, 0.3) !important;
  margin: 1.25rem 0 !important;
  width: 100% !important;
  background: rgba(15, 23, 42, 0.45) !important;
  backdrop-filter: blur(8px) !important;
}

.rendered-markdown th,
.chat-widget .rendered-markdown th,
.antigravity-agent-side-panel th,
.antigravity-agent-manager th,
.animate-markdown th {
  background: linear-gradient(180deg, rgba(147, 233, 190, 0.22) 0%, rgba(147, 233, 190, 0.10) 100%) !important;
  color: #93e9be !important;
  font-family: 'Vazirmatn', sans-serif !important;
  font-weight: 700 !important;
  font-size: 0.95rem !important;
  padding: 10px 14px !important;
  border-bottom: 2px solid rgba(147, 233, 190, 0.35) !important;
  border-inline-end: 1px solid rgba(147, 233, 190, 0.12) !important;
  text-align: start !important;
}

.rendered-markdown th:last-child {
  border-inline-end: none !important;
}

.rendered-markdown td,
.chat-widget .rendered-markdown td,
.antigravity-agent-side-panel td,
.antigravity-agent-manager td,
.animate-markdown td {
  padding: 8px 14px !important;
  border-bottom: 1px solid rgba(147, 233, 190, 0.12) !important;
  border-inline-end: 1px solid rgba(147, 233, 190, 0.08) !important;
  font-family: 'Vazirmatn', sans-serif !important;
  font-size: 0.92rem !important;
  line-height: 1.75 !important;
  color: #e2e8f0 !important;
  text-align: start !important;
  vertical-align: middle !important;
}

.rendered-markdown td:last-child {
  border-inline-end: none !important;
}

.rendered-markdown tbody tr:nth-child(even) {
  background: rgba(147, 233, 190, 0.03) !important;
}

.rendered-markdown tbody tr:hover {
  background: rgba(147, 233, 190, 0.1) !important;
  transition: background 0.18s ease-in-out !important;
}

.rendered-markdown tbody tr:last-child td {
  border-bottom: none !important;
}

.rendered-markdown td:first-child {
  font-weight: 700 !important;
  color: #93e9be !important;
}

/* ==========================================================================
   7. Code blocks & Monospace Isolation
   ========================================================================== */
pre, pre code, pre *, .monaco-editor, .monaco-editor *, .view-line, .view-lines, kbd, samp {
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace !important;
  direction: ltr !important;
  text-align: left !important;
  unicode-bidi: isolate !important;
}

:not(pre) > code {
  font-family: 'Cascadia Code', 'Fira Code', 'Vazirmatn', Consolas, monospace !important;
  background: rgba(147, 233, 190, 0.12) !important;
  border: 1px solid rgba(147, 233, 190, 0.25) !important;
  color: #93e9be !important;
  padding: 1px 6px !important;
  border-radius: 4px !important;
  font-size: 0.9em !important;
  unicode-bidi: plaintext !important;
}

:not(pre) > code[dir="rtl"],
:not(pre) > code:dir(rtl) {
  direction: rtl !important;
  text-align: justify !important;
  text-justify: inter-word !important;
  font-family: 'Vazirmatn', 'Cascadia Code', monospace !important;
}


/* ==========================================================================
   8. UI/UX Pro Max - High-End Luxury Sidebar Architecture (Platform & IDE)
   ========================================================================== */

/* 8.0 Cyber Emerald Sidebar Palette & Contrast Upgrade (Platform & IDE) */
:root, [data-theme], body, .monaco-workbench {
  --sidebar: #090e13 !important;
  --sidebar-foreground: #f1f5f9 !important;
  --sidebar-primary: #10b981 !important;
  --sidebar-primary-foreground: #ffffff !important;
  --sidebar-accent: rgba(16, 185, 129, 0.14) !important;
  --sidebar-accent-foreground: #6ee7b7 !important;
  --sidebar-border: rgba(16, 185, 129, 0.22) !important;
  --sidebar-ring: #10b981 !important;
  --sidebar-muted: rgba(16, 185, 129, 0.10) !important;

  /* VS Code / Monaco Workbench Native Sidebar Tokens */
  --vscode-sideBar-background: #080d12 !important;
  --vscode-sideBar-foreground: #cbd5e1 !important;
  --vscode-sideBar-border: rgba(16, 185, 129, 0.22) !important;
  --vscode-sideBarTitle-foreground: #34d399 !important;
  --vscode-sideBarSectionHeader-background: #0c141c !important;
  --vscode-sideBarSectionHeader-foreground: #a7f3d0 !important;
  --vscode-sideBarSectionHeader-border: rgba(16, 185, 129, 0.18) !important;
  --vscode-activityBar-background: #060a0e !important;
  --vscode-activityBar-foreground: #10b981 !important;
  --vscode-activityBar-inactiveForeground: rgba(148, 163, 184, 0.5) !important;
  --vscode-activityBar-activeBorder: #10b981 !important;
  --vscode-activityBarBadge-background: #10b981 !important;
  --vscode-activityBarBadge-foreground: #ffffff !important;
  --vscode-list-activeSelectionBackground: rgba(16, 185, 129, 0.18) !important;
  --vscode-list-activeSelectionForeground: #f1f5f9 !important;
  --vscode-list-inactiveSelectionBackground: rgba(16, 185, 129, 0.10) !important;
  --vscode-list-inactiveSelectionForeground: #e2e8f0 !important;
  --vscode-list-hoverBackground: rgba(16, 185, 129, 0.08) !important;
  --vscode-list-hoverForeground: #ffffff !important;
  --vscode-list-highlightForeground: #34d399 !important;
  --vscode-tree-indentGuidesStroke: rgba(16, 185, 129, 0.22) !important;

  /* VS Code Auxiliary Bar (Secondary Sidebar / Chat Panel) Cyber Emerald Tokens */
  --vscode-auxiliaryBar-background: #080d12 !important;
  --vscode-auxiliaryBar-foreground: #cbd5e1 !important;
  --vscode-auxiliaryBar-border: rgba(16, 185, 129, 0.22) !important;
  --vscode-auxiliaryBarTitle-background: #080d12 !important;
  --vscode-auxiliaryBarTitle-foreground: #34d399 !important;
  --vscode-auxiliaryBarSectionHeader-background: #0c141c !important;
  --vscode-auxiliaryBarSectionHeader-foreground: #a7f3d0 !important;
  --vscode-auxiliaryBarSectionHeader-border: rgba(16, 185, 129, 0.18) !important;

  /* VS Code Chat & Agent Widget Tokens */
  --vscode-chat-requestBackground: #0f1c24 !important;
  --vscode-chat-requestBorder: rgba(16, 185, 129, 0.35) !important;
  --vscode-chat-avatarBackground: #10b981 !important;
  --vscode-chat-avatarForeground: #ffffff !important;
  --vscode-chat-slashCommandBackground: rgba(16, 185, 129, 0.16) !important;
  --vscode-chat-slashCommandForeground: #6ee7b7 !important;
  --vscode-interactive-activeCodeBorder: #10b981 !important;
  --vscode-interactive-inactiveCodeBorder: rgba(16, 185, 129, 0.20) !important;

  /* VS Code Panel Tokens */
  --vscode-panel-background: #080d12 !important;
  --vscode-panel-border: rgba(16, 185, 129, 0.22) !important;
  --vscode-panelTitle-activeForeground: #34d399 !important;
  --vscode-panelTitle-activeBorder: #10b981 !important;
  --vscode-panelTitle-inactiveForeground: rgba(148, 163, 184, 0.6) !important;
}

.bg-sidebar {
  background-color: #090e13 !important;
  border-color: rgba(16, 185, 129, 0.20) !important;
}

.bg-sidebar-muted {
  background-color: rgba(16, 185, 129, 0.12) !important;
  color: #a7f3d0 !important;
}

.bg-sidebar-secondary {
  background-color: rgba(16, 185, 129, 0.08) !important;
}

/* IDE Sidebar, Auxiliary Bar & File Tree Cyber Emerald Contrast Enhancement */
.part.sidebar,
.part.activitybar,
.part.auxiliarybar,
.part.auxiliarybar.basepanel,
.composite.title,
.monaco-workbench .part.sidebar,
.monaco-workbench .part.activitybar,
.monaco-workbench .part.auxiliarybar,
.monaco-workbench .part.auxiliarybar > .title,
.monaco-workbench .part.auxiliarybar > .content,
.monaco-workbench .part.auxiliarybar .pane-body,
.monaco-workbench .part.auxiliarybar .split-view-view,
.monaco-workbench .part.auxiliarybar .pane-header,
.monaco-workbench .part.auxiliarybar .pane-composite-part {
  background-color: #080d12 !important;
  color: #cbd5e1 !important;
  border-color: rgba(16, 185, 129, 0.22) !important;
}

.monaco-workbench .part.sidebar .monaco-list,
.monaco-workbench .part.auxiliarybar .monaco-list,
.monaco-workbench .part.auxiliarybar .monaco-list-rows {
  background-color: #080d12 !important;
  color: #cbd5e1 !important;
}

.monaco-workbench .part.sidebar .monaco-list-row,
.monaco-workbench .part.auxiliarybar .monaco-list-row {
  color: #cbd5e1 !important;
}

.part.sidebar .title-label h2,
.part.sidebar .title-actions,
.part.auxiliarybar .title-label,
.part.auxiliarybar .title-label h2,
.part.auxiliarybar .title-actions,
.part.auxiliarybar .composite-bar-container,
.part.auxiliarybar .title-actions .action-label,
.explorer-viewlet .title {
  color: #34d399 !important;
  font-weight: 700 !important;
  letter-spacing: 0.04em !important;
}

.part.auxiliarybar .monaco-action-bar .action-item .action-label {
  color: #a7f3d0 !important;
}

/* Antigravity Aux Pane, Agent & Conversation View Containers (Right Side Panel) */
[data-aux-pane-open],
[data-aux-pane-open] > div,
[data-aux-pane-focus-scope="true"],
div:has(> [data-aux-pane-open]),
div:has(> [data-aux-pane-focus-scope="true"]),
[data-testid="conversation-view"],
.jetski-custom-editor-pane,
.antigravity-onboarding,
div:has(> [data-testid="conversation-view"]) {
  background-color: #080d12 !important;
  color: #cbd5e1 !important;
  --background: #080d12 !important;
  --content: #080d12 !important;
  --card: #0c141c !important;
  --card-border: rgba(16, 185, 129, 0.22) !important;
  --secondary: #0c141c !important;
  --secondary-foreground: #a7f3d0 !important;
  --muted: rgba(16, 185, 129, 0.08) !important;
  --muted-foreground: #94a3b8 !important;
  --border: rgba(16, 185, 129, 0.20) !important;
  --primary: #10b981 !important;
  --primary-foreground: #ffffff !important;
  --placeholder: rgba(148, 163, 184, 0.5) !important;
}

/* Aux Pane Tab Bar & Buttons */
button[data-tab-id] {
  font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif !important;
}
button[data-tab-id].bg-secondary,
button[data-tab-id][class*="bg-secondary"] {
  background-color: #0c141c !important;
  color: #34d399 !important;
  border: 1px solid rgba(16, 185, 129, 0.3) !important;
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.15) !important;
}
button[data-tab-id]:hover:not([class*="bg-secondary"]) {
  background-color: rgba(16, 185, 129, 0.08) !important;
  color: #f1f5f9 !important;
}

/* Aux Pane Sash Divider */
[data-testid="aux-pane-sash"] {
  background-color: rgba(16, 185, 129, 0.22) !important;
}
[data-testid="aux-pane-sash"]:hover {
  background-color: #10b981 !important;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.5) !important;
}

/* Aux Pane Tab Header & Dividers */
.group\/file-row,
[data-aux-pane-focus-scope="true"] .border-border,
[data-aux-pane-open] .border-border {
  border-color: rgba(16, 185, 129, 0.20) !important;
}

/* User Message Bubble in Agent Chat */
[data-testid="user-message-bubble"],
.relative.p-px.rounded-xl.bg-card-border > div {
  background-color: #0f1c24 !important;
  border: 1px solid rgba(16, 185, 129, 0.35) !important;
  box-shadow: 0 0 14px -2px rgba(16, 185, 129, 0.18) !important;
  color: #f1f5f9 !important;
}

.bg-card-border {
  background-color: rgba(16, 185, 129, 0.25) !important;
}

/* Agent Bottom Chat Input Card & Border */
[data-testid="conversation-view"] .border-border,
[data-testid="conversation-view"] .bg-card,
[data-testid="conversation-view"] [data-testid="user-input-step"],
[data-testid="conversation-view"] div[data-testid="user-input-step"] {
  border-color: rgba(16, 185, 129, 0.22) !important;
}

[data-testid="conversation-view"] textarea,
[data-testid="conversation-view"] input,
[data-testid="conversation-view"] [contenteditable="true"] {
  background-color: transparent !important;
  color: #f1f5f9 !important;
  font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif !important;
}

/* Agent Trajectory / Steps / Tool Badges */
[data-testid="conversation-view"] [data-testid*="step"],
[data-testid="conversation-view"] .group\/user-input-step {
  color: #cbd5e1 !important;
}

/* ==========================================================================
   Comprehensive Vazirmatn Typography for Right Auxiliary Bar, Aux Pane, & Chat Panel
   ========================================================================== */
.part.auxiliarybar,
.part.auxiliarybar *:not(pre):not(code):not(.monaco-editor):not(.codicon):not(.google-symbols):not([class*="codicon-"]):not(.cursor-edit),
[data-aux-pane-open],
[data-aux-pane-open] *:not(pre):not(code):not(.monaco-editor):not(.codicon):not(.google-symbols):not([class*="codicon-"]):not(.cursor-edit),
[data-aux-pane-focus-scope="true"],
[data-aux-pane-focus-scope="true"] *:not(pre):not(code):not(.monaco-editor):not(.codicon):not(.google-symbols):not([class*="codicon-"]):not(.cursor-edit),
[data-testid="conversation-view"],
[data-testid="conversation-view"] *:not(pre):not(code):not(.monaco-editor):not(.codicon):not(.google-symbols):not([class*="codicon-"]):not(.cursor-edit),
[data-testid="chat-message"],
[data-testid="chat-message"] *:not(pre):not(code):not(.monaco-editor):not(.codicon):not(.google-symbols):not([class*="codicon-"]):not(.cursor-edit),
[data-testid="user-message-bubble"],
[data-testid="user-message-bubble"] *:not(pre):not(code):not(.monaco-editor):not(.codicon):not(.google-symbols):not([class*="codicon-"]):not(.cursor-edit),
[data-testid="user-input-step"],
[data-testid="user-input-step"] *:not(pre):not(code):not(.monaco-editor):not(.codicon):not(.google-symbols):not([class*="codicon-"]):not(.cursor-edit),
[data-testid="user-message-content"],
[data-testid="user-message-content"] *:not(pre):not(code):not(.monaco-editor):not(.codicon):not(.google-symbols):not([class*="codicon-"]):not(.cursor-edit),
[role="article"],
[role="article"] *:not(pre):not(code):not(.monaco-editor):not(.codicon):not(.google-symbols):not([class*="codicon-"]):not(.cursor-edit),
div.break-words,
div.break-words *:not(pre):not(code):not(.monaco-editor):not(.codicon):not(.google-symbols):not([class*="codicon-"]):not(.cursor-edit),
div.leading-relaxed,
div.leading-relaxed *:not(pre):not(code):not(.monaco-editor):not(.codicon):not(.google-symbols):not([class*="codicon-"]):not(.cursor-edit),
.rendered-markdown,
.rendered-markdown *:not(pre):not(code):not(.monaco-editor):not(.codicon):not(.google-symbols):not([class*="codicon-"]):not(.cursor-edit),
.prose,
.prose *:not(pre):not(code):not(.monaco-editor):not(.codicon):not(.google-symbols):not([class*="codicon-"]):not(.cursor-edit),
.markdown-body,
.markdown-body *:not(pre):not(code):not(.monaco-editor):not(.codicon):not(.google-symbols):not([class*="codicon-"]):not(.cursor-edit) {
  font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif !important;
}

/* BiDi Auto-Alignment & Text Normalization for Chat Pane */
[data-testid="conversation-view"],
[data-testid="chat-message"],
[data-testid="user-input-step"],
[data-testid="user-message-bubble"],
[data-testid="user-message-content"],
[role="article"],
.leading-relaxed,
.rendered-markdown,
.prose,
.markdown-body,
div[data-lexical-editor="true"],
#antigravity\.agentSidePanelInputBox [contenteditable="true"],
textarea[data-testid="ask-question-writein"] {
  unicode-bidi: plaintext !important;
  text-align: start !important;
  line-height: 1.7 !important;
  font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif !important;
}

/* Double Scrollbar Elimination in Conversation View */
[data-testid="conversation-view"] .chat-message,
[data-testid="conversation-view"] [class*="prose"],
[data-testid="conversation-view"] [role="article"],
[data-testid="conversation-view"] .leading-relaxed {
  overflow-y: visible !important;
  overflow-x: visible !important;
  max-height: none !important;
  scrollbar-width: none !important;
}

[data-testid="autoscroll-viewport"] {
  overflow-y: auto !important;
}

[data-testid="conversation-view"] .chat-message::-webkit-scrollbar,
[data-testid="conversation-view"] [class*="prose"]::-webkit-scrollbar,
[data-testid="conversation-view"] [role="article"]::-webkit-scrollbar,
[data-testid="conversation-view"] .leading-relaxed::-webkit-scrollbar {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
}

/* ==========================================================================
   RTL & BiDi Auto-Alignment for Chat Bubbles, Markdown and Prompts
   ========================================================================== */
/* Persian / RTL text inside Conversation View, Chat, Bubbles, Markdown */
[data-testid="conversation-view"] [dir="auto"]:dir(rtl),
[data-testid="conversation-view"] [dir="rtl"],
[data-testid="conversation-view"] :dir(rtl),
[data-testid="conversation-view"] p:dir(rtl),
[data-testid="conversation-view"] p[dir="rtl"],
[data-testid="conversation-view"] li:dir(rtl),
[data-testid="conversation-view"] li[dir="rtl"],
[data-testid="conversation-view"] h1:dir(rtl),
[data-testid="conversation-view"] h2:dir(rtl),
[data-testid="conversation-view"] h3:dir(rtl),
[data-testid="conversation-view"] h4:dir(rtl),
[data-testid="conversation-view"] h5:dir(rtl),
[data-testid="conversation-view"] h6:dir(rtl),
[data-testid="conversation-view"] blockquote:dir(rtl),
[data-testid="conversation-view"] div[role="article"]:dir(rtl),
[data-testid="conversation-view"] div.break-words:dir(rtl),
[data-testid="user-message-bubble"]:dir(rtl),
[data-testid="user-message-bubble"]:dir(rtl) *,
[data-testid="user-input-step"]:dir(rtl),
[data-testid="user-input-step"]:dir(rtl) *,
.part.auxiliarybar [dir="rtl"],
.part.auxiliarybar :dir(rtl),
[data-aux-pane-open] [dir="rtl"],
[data-aux-pane-open] :dir(rtl),
[data-aux-pane-focus-scope="true"] [dir="rtl"],
[data-aux-pane-focus-scope="true"] :dir(rtl),
[role="article"]:dir(rtl),
[role="article"] [dir="auto"]:dir(rtl),
div.break-words [dir="auto"]:dir(rtl),
div.break-words :dir(rtl),
div.leading-relaxed :dir(rtl) {
  direction: rtl !important;
  text-align: justify !important;
  text-justify: inter-word !important;
  text-align-last: start !important;
  font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif !important;
}

/* BiDi Neutral Text with Auto Direction inside Conversation View */
[data-testid="conversation-view"] [dir="auto"],
[data-testid="conversation-view"] p,
[data-testid="conversation-view"] li,
[data-testid="conversation-view"] div[role="article"],
[data-testid="conversation-view"] .rendered-markdown,
[data-testid="conversation-view"] .whitespace-pre-wrap,
[role="article"] p,
.rendered-markdown p,
[data-testid="user-message-bubble"][dir="auto"],
[data-testid="user-input-step"][dir="auto"],
[role="article"] [dir="auto"],
div.break-words[dir="auto"],
div.leading-relaxed[dir="auto"] {
  unicode-bidi: plaintext !important;
  text-align: start !important;
  text-align-last: start !important;
  font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif !important;
}

/* ==========================================================================
   High-Specificity LTR Isolation & Monospace Protection (POST-RTL SHIELD)
   ========================================================================== */
[data-testid="conversation-view"] pre,
[data-testid="conversation-view"] code,
[data-testid="conversation-view"] pre *,
[data-testid="conversation-view"] code *,
[data-testid="conversation-view"] pre code,
[data-testid="conversation-view"] :dir(rtl) pre,
[data-testid="conversation-view"] :dir(rtl) code,
[data-testid="conversation-view"] :dir(rtl) pre *,
[data-testid="conversation-view"] :dir(rtl) code *,
[role="article"] pre,
[role="article"] code,
[role="article"] pre *,
[role="article"] code *,
[role="article"] :dir(rtl) pre,
[role="article"] :dir(rtl) code,
[role="article"] :dir(rtl) pre *,
[role="article"] :dir(rtl) code *,
.part.auxiliarybar pre,
.part.auxiliarybar code,
.part.auxiliarybar pre *,
.part.auxiliarybar code *,
.part.auxiliarybar :dir(rtl) pre,
.part.auxiliarybar :dir(rtl) code,
.prose pre,
.prose code,
.prose pre *,
.prose code *,
.prose :dir(rtl) pre,
.prose :dir(rtl) code,
.markdown-body pre,
.markdown-body code,
.markdown-body pre *,
.markdown-body code *,
div.leading-relaxed pre,
div.leading-relaxed code,
div.leading-relaxed :dir(rtl) pre,
div.leading-relaxed :dir(rtl) code,
div.break-words pre,
div.break-words code,
pre,
code,
pre *,
code * {
  direction: ltr !important;
  text-align: left !important;
  text-align-last: left !important;
  unicode-bidi: isolate !important;
  font-family: var(--monaco-monospace-font, 'Cascadia Code', Consolas, 'Courier New', monospace) !important;
}

/* Monaco Editor Container & Line Level LTR Isolation */
[data-testid="conversation-view"] .monaco-editor,
[data-testid="conversation-view"] .monaco-editor *,
[data-testid="conversation-view"] :dir(rtl) .monaco-editor,
[data-testid="conversation-view"] :dir(rtl) .monaco-editor *,
[role="article"] .monaco-editor,
[role="article"] .monaco-editor *,
.part.auxiliarybar .monaco-editor,
.part.auxiliarybar .monaco-editor *,
.monaco-editor,
.monaco-editor *,
.view-line,
.view-lines {
  direction: ltr !important;
  text-align: left !important;
  text-align-last: left !important;
  unicode-bidi: isolate !important;
  font-family: var(--monaco-monospace-font, 'Cascadia Code', Consolas, 'Courier New', monospace) !important;
}

/* Thinking / Reasoning Trace Block Strict LTR Shield */
[data-testid="conversation-view"] .cursor-edit,
[data-testid="conversation-view"] .cursor-edit *,
[data-testid="conversation-view"] .cursor-edit.text-secondary-foreground,
[data-testid="conversation-view"] .cursor-edit.text-secondary-foreground *,
[data-testid="conversation-view"] :dir(rtl) .cursor-edit,
[data-testid="conversation-view"] :dir(rtl) .cursor-edit *,
[role="article"] .cursor-edit,
[role="article"] .cursor-edit *,
.part.auxiliarybar .cursor-edit,
.part.auxiliarybar .cursor-edit *,
.cursor-edit,
.cursor-edit *,
.cursor-edit.text-secondary-foreground,
.cursor-edit.text-secondary-foreground * {
  direction: ltr !important;
  text-align: left !important;
  text-align-last: left !important;
  unicode-bidi: isolate !important;
  font-family: var(--monaco-monospace-font, 'Cascadia Code', Consolas, 'Courier New', monospace) !important;
}

/* Icon Font Immunity Shield (Codicon & Google Symbols) */
[data-testid="conversation-view"] .codicon,
[data-testid="conversation-view"] [class*="codicon-"],
[data-testid="conversation-view"] :dir(rtl) .codicon,
[data-testid="conversation-view"] :dir(rtl) [class*="codicon-"],
[role="article"] .codicon,
[role="article"] [class*="codicon-"],
[role="article"] :dir(rtl) .codicon,
[role="article"] :dir(rtl) [class*="codicon-"],
.part.auxiliarybar .codicon,
.part.auxiliarybar [class*="codicon-"],
.part.auxiliarybar :dir(rtl) .codicon,
.part.auxiliarybar :dir(rtl) [class*="codicon-"],
.prose .codicon,
.prose [class*="codicon-"],
.prose :dir(rtl) .codicon,
.prose :dir(rtl) [class*="codicon-"],
.codicon,
[class*="codicon-"] {
  font-family: codicon !important;
  direction: ltr !important;
  text-align: left !important;
}

[data-testid="conversation-view"] .google-symbols,
[data-testid="conversation-view"] :dir(rtl) .google-symbols,
[role="article"] .google-symbols,
[role="article"] :dir(rtl) .google-symbols,
.part.auxiliarybar .google-symbols,
.part.auxiliarybar :dir(rtl) .google-symbols,
.prose .google-symbols,
.prose :dir(rtl) .google-symbols,
.google-symbols {
  font-family: "Google Symbols" !important;
  direction: ltr !important;
  text-align: left !important;
}

/* RTL-PATCH-END */

/* Full Align (Justify) for Persian Paragraphs */
p:dir(rtl), [dir="rtl"] p, p[dir="rtl"],
.rendered-markdown p:dir(rtl), .rendered-markdown p[dir="rtl"],
.prose p:dir(rtl), .prose p[dir="rtl"],
[role="article"] p:dir(rtl), [role="article"] p[dir="rtl"],
div.break-words p:dir(rtl), div.break-words p[dir="rtl"],
[data-testid="conversation-view"] p:dir(rtl), [data-testid="conversation-view"] p[dir="rtl"] {
  text-align: justify !important;
  text-justify: inter-word !important;
  text-align-last: start !important;
  line-height: 2.1 !important;
}

/* User Message Bubble Docking: RTL attaches to the RIGHT, LTR attaches to the LEFT */
[data-testid="user-input-step"]:dir(rtl),
[data-testid="user-input-step"][dir="rtl"],
[data-testid="user-message-bubble"]:dir(rtl),
[data-testid="user-message-bubble"][dir="rtl"],
[aria-label="User message"]:dir(rtl),
[aria-label="User message"][dir="rtl"],
.interactive-request:dir(rtl),
.interactive-request[dir="rtl"],
.agy-user-bubble:dir(rtl),
.agy-user-bubble[dir="rtl"] {
  margin-left: auto !important;
  margin-right: 0 !important;
  align-self: flex-end !important;
  direction: rtl !important;
  text-align: right !important;
}

[data-testid="user-input-step"]:dir(ltr),
[data-testid="user-input-step"][dir="ltr"],
[data-testid="user-message-bubble"]:dir(ltr),
[data-testid="user-message-bubble"][dir="ltr"],
[aria-label="User message"]:dir(ltr),
[aria-label="User message"][dir="ltr"],
.interactive-request:dir(ltr),
.interactive-request[dir="ltr"],
.agy-user-bubble:dir(ltr),
.agy-user-bubble[dir="ltr"] {
  margin-left: 0 !important;
  margin-right: auto !important;
  align-self: flex-start !important;
  direction: ltr !important;
  text-align: left !important;
}


/* ==========================================================================
   Full Align (Strict Dual-Margin Justification) for Persian Text
   ========================================================================== */
p:dir(rtl), [dir="rtl"] p, p[dir="rtl"],
li:dir(rtl), [dir="rtl"] li, li[dir="rtl"],
.rendered-markdown p, .rendered-markdown li,
.prose p, .prose li,
[role="article"] p, [role="article"] li,
div.break-words p, div.break-words li,
[data-testid="conversation-view"] p, [data-testid="conversation-view"] li {
  text-align: justify !important;
  text-justify: inter-word !important;
  text-align-last: start !important;
  line-height: 2.1 !important;
}

/* ==========================================================================
   User Prompt Bubble: Dynamic Floating Geometry & Docking
   ========================================================================== */

/* 1. Eliminate Outer Wrapper Green Ghost Artifact: Wrapper must be 100% transparent */
.relative.p-px.rounded-xl.bg-card-border:has([data-testid="user-message-bubble"]),
div:has(> [data-testid="user-message-bubble"]) {
  background: transparent !important;
  background-color: transparent !important;
  border: none !important;
  padding: 0 !important;
  box-shadow: none !important;
  width: fit-content !important;
  max-width: 85% !important;
}

/* 2. Self-Contained User Message Bubble with Natural Horizontal Expansion (No word collapse!) */
[data-testid="user-message-bubble"],
[data-testid="user-input-step"] > div:has([data-testid="user-message-bubble"]) {
  background-color: #0f1c24 !important;
  border: 1px solid rgba(16, 185, 129, 0.35) !important;
  border-radius: 12px !important;
  box-shadow: 0 0 14px -2px rgba(16, 185, 129, 0.18) !important;
  color: #f1f5f9 !important;
  width: fit-content !important;
  max-width: 85% !important;
  display: flex !important;
  box-sizing: border-box !important;
  padding: 8px 14px !important;
}

/* Stop Flex-1 Collapse: Allow text to expand horizontally to its full line width! */
[data-testid="user-message-bubble"] > div:first-child,
[data-testid="user-message-bubble"] .flex-1,
[data-testid="user-message-bubble"] [class*="flex-1"] {
  flex: 0 1 auto !important;
  min-width: fit-content !important;
  width: auto !important;
  white-space: pre-wrap !important;
  word-break: break-word !important;
  overflow-wrap: break-word !important;
  line-height: 1.8 !important;
}

/* RTL: Outer Card & Row Docks Flush to the RIGHT with 0 margin-right */
.relative.p-px.rounded-xl.bg-card-border:has([data-testid="user-message-bubble"]:dir(rtl)),
.relative.p-px.rounded-xl.bg-card-border:has([data-testid="user-message-bubble"][dir="rtl"]),
.relative.p-px.rounded-xl.bg-card-border:has([dir="rtl"]),
div:has(> [data-testid="user-message-bubble"]:dir(rtl)),
div:has(> [data-testid="user-message-bubble"][dir="rtl"]),
div:has(> [dir="rtl"] > [data-testid="user-message-bubble"]),
[data-testid="user-message-bubble"]:dir(rtl),
[data-testid="user-message-bubble"][dir="rtl"],
[data-testid="user-input-step"]:dir(rtl),
[data-testid="user-input-step"][dir="rtl"],
[aria-label="User message"]:dir(rtl),
[aria-label="User message"][dir="rtl"],
.agy-user-bubble:dir(rtl),
.agy-user-bubble[dir="rtl"],
.agy-user-bubble-frame:dir(rtl),
.agy-user-bubble-frame[dir="rtl"] {
  margin-left: auto !important;
  margin-right: 0px !important;
  align-self: flex-end !important;
  direction: rtl !important;
}

/* LTR: Outer Card & Row Docks Flush to the LEFT */
.relative.p-px.rounded-xl.bg-card-border:has([data-testid="user-message-bubble"]:dir(ltr)),
.relative.p-px.rounded-xl.bg-card-border:has([data-testid="user-message-bubble"][dir="ltr"]),
.relative.p-px.rounded-xl.bg-card-border:has([dir="ltr"]),
div:has(> [data-testid="user-message-bubble"]:dir(ltr)),
div:has(> [data-testid="user-message-bubble"][dir="ltr"]),
div:has(> [dir="ltr"] > [data-testid="user-message-bubble"]),
[data-testid="user-message-bubble"]:dir(ltr),
[data-testid="user-message-bubble"][dir="ltr"],
[data-testid="user-input-step"]:dir(ltr),
[data-testid="user-input-step"][dir="ltr"],
[aria-label="User message"]:dir(ltr),
[aria-label="User message"][dir="ltr"],
.agy-user-bubble:dir(ltr),
.agy-user-bubble[dir="ltr"],
.agy-user-bubble-frame:dir(ltr),
.agy-user-bubble-frame[dir="ltr"] {
  margin-left: 0px !important;
  margin-right: auto !important;
  align-self: flex-start !important;
  direction: ltr !important;
}

/* Outer Row Container (div.w-full & user-input-step) flex-aligns to the edge */
div:has(> .relative.p-px.rounded-xl.bg-card-border > [data-testid="user-message-bubble"]:dir(rtl)),
div:has(> .relative.p-px.rounded-xl.bg-card-border > [data-testid="user-message-bubble"][dir="rtl"]),
div.w-full:has([data-testid="user-message-bubble"]:dir(rtl)),
div.w-full:has([data-testid="user-message-bubble"][dir="rtl"]),
[data-testid="user-input-step"]:has([data-testid="user-message-bubble"]:dir(rtl)),
[data-testid="user-input-step"]:has([data-testid="user-message-bubble"][dir="rtl"]) {
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-end !important;
  justify-content: flex-end !important;
  width: 100% !important;
}

div:has(> .relative.p-px.rounded-xl.bg-card-border > [data-testid="user-message-bubble"]:dir(ltr)),
div:has(> .relative.p-px.rounded-xl.bg-card-border > [data-testid="user-message-bubble"][dir="ltr"]),
div.w-full:has([data-testid="user-message-bubble"]:dir(ltr)),
div.w-full:has([data-testid="user-message-bubble"][dir="ltr"]),
[data-testid="user-input-step"]:has([data-testid="user-message-bubble"]:dir(ltr)),
[data-testid="user-input-step"]:has([data-testid="user-message-bubble"][dir="ltr"]) {
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important;
  justify-content: flex-start !important;
  width: 100% !important;
}

/* ==========================================================================
   Chat Composer & Toolbar Layout Shield (Model Selector LEFT, Send Button RIGHT)
   ========================================================================== */
form,
[data-testid="chat-input"],
[data-testid="composer"],
div:has(> textarea),
div:has(> [contenteditable="true"]),
div:has(> [data-lexical-editor="true"]),
.relative.p-px.rounded-xl.bg-card-border:has(textarea),
.relative.p-px.rounded-xl.bg-card-border:has([contenteditable="true"]) {
  direction: ltr !important;
  width: 100% !important;
  max-width: 100% !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
  align-self: stretch !important;
}

/* Ensure the footer toolbar row (model selector on left, send button on right) stays LTR */
form div[class*="flex"],
[data-testid="chat-input"] div[class*="flex"],
div:has(> textarea) div[class*="flex"],
.relative.p-px.rounded-xl.bg-card-border div[class*="flex"] {
  direction: ltr !important;
}

/* Only the text inside textarea or contenteditable responds to Persian RTL typing */
textarea:dir(rtl), textarea[dir="rtl"],
[contenteditable="true"]:dir(rtl), [contenteditable="true"][dir="rtl"],
div[data-lexical-editor="true"]:dir(rtl) {
  direction: rtl !important;
  text-align: right !important;
  unicode-bidi: plaintext !important;
}

textarea:dir(ltr), textarea[dir="ltr"],
[contenteditable="true"]:dir(ltr), [contenteditable="true"][dir="ltr"],
div[data-lexical-editor="true"]:dir(ltr) {
  direction: ltr !important;
  text-align: left !important;
  unicode-bidi: plaintext !important;
}

"#;

#[tauri::command]
pub async fn get_antigravity_rtl_status() -> Result<AntigravityRtlStatus, String> {
    let mut desktop_asar = None;
    let mut desktop_patched = false;
    let mut desktop_backup = false;

    // 1. Detect Desktop 2.0 app.asar
    let possible_desktop_paths = vec![
        dirs::data_local_dir().map(|d| {
            d.join("Programs")
                .join("antigravity")
                .join("resources")
                .join("app.asar")
        }),
        dirs::data_local_dir().map(|d| {
            d.join("Programs")
                .join("Antigravity")
                .join("resources")
                .join("app.asar")
        }),
    ];

    for p in possible_desktop_paths.into_iter().flatten() {
        if p.exists() {
            desktop_asar = Some(p.to_string_lossy().to_string());
            let bak = format!("{}.bak", p.to_string_lossy());
            desktop_backup = Path::new(&bak).exists();

            // Antigravity Desktop 2.0 uses Electron v44 (ASAR integrity sealed).
            // Status is verified via the live Chrome DevTools Protocol (CDP) bridge.
            desktop_patched = crate::modules::platform_cdp::is_platform_active();
            break;
        }
    }

    // 2. Detect IDE CSS path
    let mut ide_css = None;
    let mut ide_patched = false;
    let mut ide_backup = false;

    let possible_ide_paths = vec![
        dirs::data_local_dir().map(|d| {
            d.join("Programs")
                .join("Antigravity IDE")
                .join("resources")
                .join("app")
                .join("out")
                .join("vs")
                .join("workbench")
                .join("workbench.desktop.main.css")
        }),
        dirs::data_local_dir().map(|d| {
            d.join("Programs")
                .join("antigravity-ide")
                .join("resources")
                .join("app")
                .join("out")
                .join("vs")
                .join("workbench")
                .join("workbench.desktop.main.css")
        }),
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
            let p_start = "/* [Antigravity-Shield-RTL-Vazirmatn] */";
            let p_end = "/* [/Antigravity-Shield-RTL-Vazirmatn] */";
            if let Some(s) = content.find(p_start) {
                content.truncate(s);
                content.push_str(p_start);
                content.push('\n');
                content.push_str(VAZIRMATN_RTL_CSS);
                content.push('\n');
                content.push_str(p_end);
                content.push('\n');
                fs::write(css_path, &content).map_err(|e| e.to_string())?;
                applied_count += 1;
            } else if !content.contains("Antigravity-Shield-RTL-Vazirmatn") {
                content.push_str("\n\n");
                content.push_str(p_start);
                content.push('\n');
                content.push_str(VAZIRMATN_RTL_CSS);
                content.push('\n');
                content.push_str(p_end);
                content.push('\n');
                fs::write(css_path, &content).map_err(|e| e.to_string())?;
                applied_count += 1;
            }

            // Clean up bloated patches from tailwind files and ensure pristine state
            if let Some(out_dir) = css_path
                .parent()
                .and_then(|p| p.parent())
                .and_then(|p| p.parent())
            {
                let clean_targets = ["jetskiMain.tailwind.css", "tw-base.tailwind.css"];

                for rel_css in &clean_targets {
                    let target_path =
                        out_dir.join(rel_css.replace('/', std::path::MAIN_SEPARATOR_STR));
                    if target_path.exists() {
                        if let Ok(content) = fs::read_to_string(&target_path) {
                            if let Some(pos) = content.find("/* [Antigravity-Shield-RTL-Vazirmatn")
                            {
                                let cleaned = content[..pos].trim_end().to_string();
                                let _ = fs::write(&target_path, cleaned);
                                applied_count += 1;
                            }
                        }
                        if let Some(app_dir) = out_dir.parent() {
                            update_product_checksum(app_dir, rel_css, &target_path);
                        }
                    }
                }

                // Idempotently patch jetskiAgent/main.css
                let agent_css = out_dir.join("jetskiAgent").join("main.css");
                if agent_css.exists() {
                    let bak_path = format!("{}.bak", agent_css.to_string_lossy());
                    if !Path::new(&bak_path).exists() {
                        let _ = fs::copy(&agent_css, &bak_path);
                    }
                    if let Ok(mut jc) = fs::read_to_string(&agent_css) {
                        let p_start = "/* [Antigravity-Shield-RTL-Vazirmatn] */";
                        let p_end = "/* [/Antigravity-Shield-RTL-Vazirmatn] */";
                        if let Some(s) = jc.find(p_start) {
                            jc.truncate(s);
                            jc.push_str(p_start);
                            jc.push('\n');
                            jc.push_str(VAZIRMATN_RTL_CSS);
                            jc.push('\n');
                            jc.push_str(p_end);
                            jc.push('\n');
                            let _ = fs::write(&agent_css, &jc);
                            applied_count += 1;
                        } else if !jc.contains("Antigravity-Shield-RTL-Vazirmatn") {
                            jc.push_str("\n\n");
                            jc.push_str(p_start);
                            jc.push('\n');
                            jc.push_str(VAZIRMATN_RTL_CSS);
                            jc.push('\n');
                            jc.push_str(p_end);
                            jc.push('\n');
                            let _ = fs::write(&agent_css, &jc);
                            applied_count += 1;
                        }
                    }
                    if let Some(app_dir) = out_dir.parent() {
                        update_product_checksum(app_dir, "jetskiAgent/main.css", &agent_css);
                    }
                }

                // Restore minified JS bundles from .orig/.bak if available to prevent crashes
                let main_js = out_dir.join("jetskiAgent").join("main.js");
                let main_orig = out_dir.join("jetskiAgent").join("main.js.orig");
                if main_orig.exists() && main_js.exists() {
                    let _ = fs::copy(&main_orig, &main_js);
                    applied_count += 1;
                    if let Some(app_dir) = out_dir.parent() {
                        update_product_checksum(app_dir, "jetskiAgent/main.js", &main_js);
                    }
                }

                let wb_js_path = out_dir
                    .join("vs")
                    .join("workbench")
                    .join("workbench.desktop.main.js");
                let wb_orig = out_dir
                    .join("vs")
                    .join("workbench")
                    .join("workbench.desktop.main.js.orig");
                if wb_js_path.exists() {
                    if !wb_orig.exists() {
                        let _ = fs::copy(&wb_js_path, &wb_orig);
                    }
                    let src_path = if wb_orig.exists() { &wb_orig } else { &wb_js_path };
                    if let Ok(mut wb_content) = fs::read_to_string(src_path) {
                        let wb_replacements = [
                            (
                                "oDd=t=>{let{animate:e,claimStaggerDelays:i}=$ne();return v(\"p\",{...t,className:ht(t.className)",
                                "oDd=t=>{let{animate:e,claimStaggerDelays:i}=$ne();return v(\"p\",{dir:\"auto\",...t,className:ht(t.className)",
                            ),
                            (
                                "aDd=t=>{let{animate:e,claimStaggerDelays:i}=$ne();return v(KTd,{...t,animate:e,claimStaggerDelays:i})}",
                                "aDd=t=>{let{animate:e,claimStaggerDelays:i}=$ne();return v(KTd,{dir:\"auto\",...t,animate:e,claimStaggerDelays:i})}",
                            ),
                            (
                                "_3e=t=>{let e=i=>{let{animate:n,claimStaggerDelays:r}=$ne();return v(t,{...i,className:ht(i.className)",
                                "_3e=t=>{let e=i=>{let{animate:n,claimStaggerDelays:r}=$ne();return v(t,{dir:\"auto\",...i,className:ht(i.className)",
                            ),
                            (
                                "return v(\"div\",{className:ht(\"leading-relaxed\",\"select-text\",\"text-sm\",\"flex flex-col\",\"[&_strong]:font-semibold\",\"[&_b]:font-semibold\",",
                                "return v(\"div\",{dir:\"auto\",className:ht(\"leading-relaxed\",\"select-text\",\"text-sm\",\"flex flex-col\",\"[&_strong]:font-semibold\",\"[&_b]:font-semibold\",",
                            ),
                            (
                                "wNd=`\ndiv:has(> table),\ntable th,\ntable td {\n  border-style: solid;\n  border-color: rgba(128, 128, 128, 0.2);\n}\n`",
                                "wNd=`\ndiv:has(> table),\ntable th,\ntable td {\n  border-style: solid;\n  border-color: rgba(128, 128, 128, 0.2);\n}\np, li, dd, dt, h1, h2, h3, h4, h5, h6, blockquote, span, div {\n  font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif !important;\n}\np[dir=\"auto\"], div[dir=\"auto\"], span[dir=\"auto\"], li[dir=\"auto\"] {\n  unicode-bidi: plaintext !important;\n}\np:dir(rtl), li:dir(rtl), h1:dir(rtl), h2:dir(rtl), h3:dir(rtl), h4:dir(rtl), h5:dir(rtl), h6:dir(rtl), blockquote:dir(rtl), [dir=\"rtl\"], :dir(rtl) {\n  text-align: right !important;\n  direction: rtl !important;\n}\nul, ol {\n  padding-left: 0 !important;\n  margin-left: 0 !important;\n}\nul:dir(rtl), ol:dir(rtl), ul:has(> li:dir(rtl)), ol:has(> li:dir(rtl)) {\n  padding-right: 28px !important;\n  direction: rtl !important;\n  text-align: right !important;\n}\n`",
                            ),
                            (
                                "function PHd({step:t}){let{renderers:e}=Ur(),i=e.markdown,n=(t.step.case===\"plannerResponse\"?t.step.value:null)?.response;if(!n)return null;let r=t.status===Kr.RUNNING||t.status===Kr.GENERATING,s=Pm(t.metadata,null);return v(\"div\",{className:\"px-2 py-1\"",
                                "function PHd({step:t}){let{renderers:e}=Ur(),i=e.markdown,n=(t.step.case===\"plannerResponse\"?t.step.value:null)?.response;if(!n)return null;let r=t.status===Kr.RUNNING||t.status===Kr.GENERATING,s=Pm(t.metadata,null);return v(\"div\",{dir:\"auto\",className:\"px-2 py-1\"",
                            ),
                            (
                                "v(\"div\",{role:\"article\",\"aria-label\":\"Agent response\",\"data-quotable\":\"true\",children:",
                                "v(\"div\",{dir:\"auto\",role:\"article\",\"aria-label\":\"Agent response\",\"data-quotable\":\"true\",children:",
                            ),
                            (
                                "LPd=({items:t})=>{let{chatParams:{artifactsDir:e},trajectorySummariesProvider:i,stepHandler:n,isBrowserPaneAvailable:r,openUrlInBrowserPane:s}=Ur(),o=Kt().get(\"browserAuxPane\");return v(\"div\",{\"data-quotable\":\"true\",className:\"whitespace-pre-wrap text-sm\"",
                                "LPd=({items:t})=>{let{chatParams:{artifactsDir:e},trajectorySummariesProvider:i,stepHandler:n,isBrowserPaneAvailable:r,openUrlInBrowserPane:s}=Ur(),o=Kt().get(\"browserAuxPane\");return v(\"div\",{dir:\"auto\",\"data-quotable\":\"true\",className:\"whitespace-pre-wrap text-sm\"",
                            ),
                            (
                                "style:a?sWe.container:void 0,\"data-testid\":\"conversation-view\"",
                                "dir:\"auto\",style:a?sWe.container:void 0,\"data-testid\":\"conversation-view\"",
                            ),
                            (
                                "children:v(\"div\",{ref:se,\"data-testid\":\"user-message-bubble\"",
                                "children:v(\"div\",{ref:se,dir:\"auto\",\"data-testid\":\"user-message-bubble\"",
                            ),
                        ];

                        let mut replaced_any = false;
                        for (target, replacement) in &wb_replacements {
                            if wb_content.contains(target) {
                                wb_content = wb_content.replacen(target, replacement, 1);
                                replaced_any = true;
                            }
                        }
                        if replaced_any {
                            let _ = fs::write(&wb_js_path, &wb_content);
                            applied_count += 1;
                            if let Some(app_dir) = out_dir.parent() {
                                update_product_checksum(
                                    app_dir,
                                    "vs/workbench/workbench.desktop.main.js",
                                    &wb_js_path,
                                );
                            }
                        }
                    }
                }

                // Inject BiDi Sentinel into jetskiAgent.js and workbench.js
                let sentinel_code = r#"
// [Antigravity-Shield-IDE-BiDi-Sentinel]
(()=>{
  const isPersian = (s) => /[\u0600-\u06FF]/.test(s);

  function applyBiDiToElement(el) {
    if (!el || el.nodeType !== 1) return;

    // 1. Guard against global document and shell nodes
    if (el === document.body || el === document.documentElement || el.tagName === 'BODY' || el.tagName === 'HTML') return;
    if (el.classList.contains('monaco-workbench')) return;

    // 2. Guard against sidebar, editor, and terminal panels
    if (el.closest('.part.sidebar') || el.closest('.sidebar')) return;
    if (el.closest('.part.editor') || el.closest('.editor') || el.closest('.monaco-editor')) return;

    // 3. Guard against chat container / viewport / layout wrappers (Container Scope Inversion Guard)
    if (
      el.classList.contains('auxiliarybar') ||
      el.getAttribute('data-testid') === 'conversation-view' ||
      el.getAttribute('data-testid') === 'autoscroll-viewport' ||
      el.getAttribute('data-testid') === 'chat-message' ||
      el.getAttribute('role') === 'article' ||
      el.hasAttribute('data-aux-pane-open') ||
      el.hasAttribute('data-aux-pane-focus-scope') ||
      el.classList.contains('rendered-markdown') ||
      el.classList.contains('prose') ||
      el.classList.contains('markdown-body')
    ) {
      return;
    }

    // 4. Guard against code blocks, preformatted text, thinking traces, and icon fonts
    if (el.tagName === 'CODE' || el.tagName === 'PRE' || el.closest('pre') || el.closest('code')) return;
    if (el.classList.contains('cursor-edit') || el.closest('.cursor-edit')) return;
    if (
      el.classList.contains('codicon') ||
      el.classList.contains('google-symbols') ||
      (typeof el.className === 'string' && el.className.includes('codicon-'))
    ) {
      return;
    }

    const txt = el.textContent || '';
    if (isPersian(txt)) {
      if (el.getAttribute('dir') !== 'rtl') el.setAttribute('dir', 'rtl');
      if (el.style.direction !== 'rtl') el.style.setProperty('direction', 'rtl', 'important');
      if (el.style.fontFamily !== "'Vazirmatn'") el.style.setProperty('font-family', "'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif", 'important');
      if (el.style.textAlign !== 'right') el.style.setProperty('text-align', 'right', 'important');

      if (el.tagName === 'LI') {
        el.style.setProperty('padding-left', '0', 'important');
        el.style.setProperty('margin-left', '0', 'important');
        const parentList = el.closest('ul, ol');
        if (parentList) {
          if (parentList.getAttribute('dir') !== 'rtl') parentList.setAttribute('dir', 'rtl');
          parentList.style.setProperty('direction', 'rtl', 'important');
          parentList.style.setProperty('text-align', 'right', 'important');
          parentList.style.setProperty('padding-left', '0', 'important');
          parentList.style.setProperty('margin-left', '0', 'important');
          if (parentList.tagName === 'UL') {
            parentList.style.setProperty('padding-right', '28px', 'important');
          } else if (parentList.tagName === 'OL') {
            parentList.style.setProperty('padding-right', '32px', 'important');
          }
        }
      } else if (/^H[1-6]$/.test(el.tagName)) {
        el.style.setProperty('padding-left', '0', 'important');
        el.style.setProperty('padding-right', '0', 'important');
        el.style.setProperty('margin-left', '0', 'important');
      } else if (el.tagName === 'BLOCKQUOTE') {
        el.style.setProperty('border-left', 'none', 'important');
        el.style.setProperty('border-right', '4px solid var(--border, #93e9be)', 'important');
      }
    }
  }

  function patchBiDi(root = document) {
    if (!root) return;
    // CRITICAL: NEVER call applyBiDiToElement(root) directly to prevent container scope inversion
    if (!root.querySelectorAll) return;

    const targets = root.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, th, td, [data-testid="user-message-bubble"], [data-testid="user-input-step"], [role="article"] > p, [role="article"] > li');
    for (let i = 0; i < targets.length; i++) {
      applyBiDiToElement(targets[i]);
    }

    const iframes = root.querySelectorAll('iframe, webview');
    for (let i = 0; i < iframes.length; i++) {
      try {
        const doc = iframes[i].contentDocument || iframes[i].contentWindow?.document;
        if (doc) patchBiDi(doc);
      } catch(e) {}
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
          if (n.nodeType === 1) {
            if (n.matches && n.matches('p, li, h1, h2, h3, h4, h5, h6, blockquote, th, td, [data-testid="user-message-bubble"], [data-testid="user-input-step"]')) {
              applyBiDiToElement(n);
            }
            patchBiDi(n);
          }
        }
      } else if (m.type === 'characterData') {
        const p = m.target.parentElement;
        if (p) {
          const block = p.closest('p, li, h1, h2, h3, h4, h5, h6, blockquote, [data-testid="user-message-bubble"], [data-testid="user-input-step"]') || p;
          applyBiDiToElement(block);
        }
      }
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  let pollCount = 0;
  const poller = setInterval(() => {
    patchBiDi();
    pollCount++;
    if (pollCount > 30) {
      clearInterval(poller);
      setInterval(() => patchBiDi(), 1500);
    }
  }, 300);

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el) return;
    // Guard against editor, sidebar, or terminal input fields
    if (el.closest('.part.sidebar') || el.closest('.sidebar') || el.closest('.part.editor') || el.closest('.editor') || el.closest('.monaco-editor')) return;
    if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const val = el.value || el.textContent || '';
      if (isPersian(val)) {
        el.setAttribute('dir', 'rtl');
        el.style.setProperty('direction', 'rtl', 'important');
        el.style.setProperty('text-align', 'right', 'important');
        el.style.setProperty('font-family', "'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif", 'important');
        el.style.setProperty('unicode-bidi', 'isolate', 'important');
      } else if (val.trim().length > 0) {
        el.setAttribute('dir', 'ltr');
        el.style.setProperty('direction', 'ltr');
        el.style.setProperty('text-align', 'left');
      }
    }
  }, true);
})();
"#;

                for js_rel in &[
                    "vs/code/electron-browser/workbench/jetskiAgent.js",
                    "vs/code/electron-browser/workbench/workbench.js",
                ] {
                    let entry_path =
                        out_dir.join(js_rel.replace('/', std::path::MAIN_SEPARATOR_STR));
                    if entry_path.exists() {
                        let entry_bak = format!("{}.bak", entry_path.to_string_lossy());
                        if !Path::new(&entry_bak).exists() {
                            let _ = fs::copy(&entry_path, &entry_bak);
                        }
                        if let Ok(mut content) = fs::read_to_string(&entry_path) {
                            if content.contains("// [Antigravity-Shield-IDE-BiDi-Sentinel]") {
                                let idx = content
                                    .find("// [Antigravity-Shield-IDE-BiDi-Sentinel]")
                                    .unwrap();
                                content.truncate(idx);
                            }
                            content.push_str(sentinel_code);
                            let _ = fs::write(&entry_path, &content);
                            applied_count += 1;
                            if let Some(app_dir) = out_dir.parent() {
                                update_product_checksum(app_dir, js_rel, &entry_path);
                            }
                        }
                    }
                }

                for html_rel in &[
                    "vs/code/electron-browser/workbench/workbench.html",
                    "vs/code/electron-browser/workbench/workbench-jetski-agent.html",
                    "vs/workbench/contrib/webview/browser/pre/index.html",
                ] {
                    let hp = out_dir.join(html_rel.replace('/', std::path::MAIN_SEPARATOR_STR));
                    if hp.exists() {
                        let html_bak = format!("{}.bak", hp.to_string_lossy());
                        if !Path::new(&html_bak).exists() {
                            let _ = fs::copy(&hp, &html_bak);
                        }
                        if let Ok(mut hc) = fs::read_to_string(&hp) {
                            let mut html_changed = false;
                            let old_fsrc = "\t\t\t\tfont-src\n\t\t\t\t\t'self'\n\t\t\t\t\tvscode-remote-resource:";
                            let new_fsrc = "\t\t\t\tfont-src\n\t\t\t\t\t'self'\n\t\t\t\t\tdata:\n\t\t\t\t\tvscode-remote-resource:";
                            if hc.contains(old_fsrc) {
                                hc = hc.replace(old_fsrc, new_fsrc);
                                html_changed = true;
                            }
                            if hc.contains("style-src 'unsafe-inline';") && !hc.contains("font-src")
                            {
                                hc = hc.replace(
                                    "style-src 'unsafe-inline';",
                                    "style-src 'unsafe-inline'; font-src 'self' data:;",
                                );
                                html_changed = true;
                            }
                            let bidi_style = format!(
                                r#"	<style id="antigravity-shield-ide-bidi">
{}

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

		/* Isolate embedded English/code in RTL without breaking Persian word order */
		[dir="rtl"] :is(code, pre, .monaco-editor, [dir="ltr"]) {{
			unicode-bidi: isolate !important;
			direction: ltr !important;
		}}

		pre, pre *, .monaco-editor, .monaco-editor *, .view-line, .view-lines {{
			font-family: var(--monaco-monospace-font, 'Cascadia Code', Consolas, 'Courier New', monospace) !important;
			direction: ltr !important;
			text-align: left !important;
		}}
	</style>
</head>"#,
                                VAZIRMATN_RTL_CSS
                            );
                            if let Some(s_pos) =
                                hc.find("<style id=\"antigravity-shield-ide-bidi\">")
                            {
                                if let Some(e_pos) = hc[s_pos..].find("</style>") {
                                    hc.replace_range(
                                        s_pos..s_pos + e_pos + 8,
                                        bidi_style.trim_end_matches("\n</head>").trim_start(),
                                    );
                                    html_changed = true;
                                }
                            } else {
                                hc = hc.replace("</head>", &bidi_style);
                                html_changed = true;
                            }
                            if html_changed {
                                let _ = fs::write(&hp, hc);
                                applied_count += 1;
                            }
                        }
                        if let Some(app_dir) = out_dir.parent() {
                            update_product_checksum(app_dir, html_rel, &hp);
                        }
                    }
                }
                if let Some(app_dir) = out_dir.parent() {
                    update_product_checksum(
                        app_dir,
                        "vs/workbench/workbench.desktop.main.css",
                        css_path,
                    );

                // Patch agy extension for the chat webview iframe (Cross-Origin Iframe BiDi & Vazirmatn Proxy)
                if let Some(app_dir) = out_dir.parent() {
                    let agy_vscode_dir = app_dir.join("extensions").join("agy").join("vscode");
                    if agy_vscode_dir.exists() {
                        let agy_ext_js = agy_vscode_dir.join("extension.js");
                        if agy_ext_js.exists() {
                            if let Ok(mut ext_content) = fs::read_to_string(&agy_ext_js) {
                                let target_anchor = "a.search=m.toString();return a.toString()}setupFontChangeListener";
                                let hook_anchor = "a.search=m.toString();try{return require(\"./rtl-proxy.js\").wrap(a.toString())}catch(e){return a.toString()}}setupFontChangeListener";
                                if ext_content.contains(target_anchor) {
                                    let ext_bak = format!("{}.orig", agy_ext_js.to_string_lossy());
                                    if !Path::new(&ext_bak).exists() {
                                        let _ = fs::copy(&agy_ext_js, &ext_bak);
                                    }
                                    ext_content = ext_content.replace(target_anchor, hook_anchor);
                                    let _ = fs::write(&agy_ext_js, &ext_content);
                                    applied_count += 1;
                                }
                            }
                        }
                    }
                }
                }

                // Clear Electron V8 code cache so changes take effect immediately
                if let Some(config_dir) = dirs::config_dir() {
                    let roaming_ide = config_dir.join("Antigravity IDE");
                    for sub in &["Cache", "Code Cache/js", "CachedData"] {
                        let cdir = roaming_ide.join(sub.replace('/', std::path::MAIN_SEPARATOR_STR));
                        if cdir.exists() {
                            let _ = fs::remove_dir_all(&cdir);
                        }
                    }
                }
            }
        }
    }

    // Inject live into Antigravity Desktop Platform via Chrome DevTools Protocol
    if let Ok(count) = crate::modules::platform_cdp::inject_platform_rtl().await {
        if count > 0 {
            applied_count += 1;
        }
    }

    if applied_count > 0 {
        Ok(format!(
            "پچ راست‌چین و فونت وزیرمتن با موفقیت بر روی {} ماژول اعمال شد.",
            applied_count
        ))
    } else {
        Ok("پچ پیش از این اعمال شده بود یا موردی برای تغییر یافت نشد.".into())
    }
}

#[tauri::command]
pub async fn restore_antigravity_rtl() -> Result<String, String> {
    let status = get_antigravity_rtl_status().await?;
    let mut restored_count = 0;

    // 1. Comprehensive restore of all IDE files and checksums
    if let Some(css_path_str) = status.ide_css_path {
        let css_path = Path::new(&css_path_str);
        if let Some(out_dir) = css_path
            .parent()
            .and_then(|p| p.parent())
            .and_then(|p| p.parent())
        {
            let files_to_restore = [
                (
                    "vs/workbench/workbench.desktop.main.css",
                    "vs/workbench/workbench.desktop.main.css",
                ),
                ("jetskiMain.tailwind.css", "jetskiMain.tailwind.css"),
                ("tw-base.tailwind.css", "tw-base.tailwind.css"),
                ("jetskiAgent/main.css", "jetskiAgent/main.css"),
                ("jetskiAgent/main.js", "jetskiAgent/main.js"),
                (
                    "vs/code/electron-browser/workbench/jetskiAgent.js",
                    "vs/code/electron-browser/workbench/jetskiAgent.js",
                ),
                (
                    "vs/workbench/workbench.desktop.main.js",
                    "vs/workbench/workbench.desktop.main.js",
                ),
                (
                    "vs/code/electron-browser/workbench/workbench.js",
                    "vs/code/electron-browser/workbench/workbench.js",
                ),
                (
                    "vs/code/electron-browser/workbench/workbench.html",
                    "vs/code/electron-browser/workbench/workbench.html",
                ),
                (
                    "vs/code/electron-browser/workbench/workbench-jetski-agent.html",
                    "vs/code/electron-browser/workbench/workbench-jetski-agent.html",
                ),
                (
                    "vs/workbench/contrib/webview/browser/pre/index.html",
                    "vs/workbench/contrib/webview/browser/pre/index.html",
                ),
            ];

            for (rel_key, rel_path) in &files_to_restore {
                let target_path =
                    out_dir.join(rel_path.replace('/', std::path::MAIN_SEPARATOR_STR));
                let bak_path = format!("{}.bak", target_path.to_string_lossy());
                let orig_path = format!("{}.orig", target_path.to_string_lossy());
                let source_restore = if Path::new(&orig_path).exists() {
                    Some(orig_path)
                } else if Path::new(&bak_path).exists() {
                    Some(bak_path)
                } else {
                    None
                };

                if let Some(src) = source_restore {
                    if fs::copy(&src, &target_path).is_ok() {
                        restored_count += 1;
                        if let Some(app_dir) = out_dir.parent() {
                            update_product_checksum(app_dir, rel_key, &target_path);
                        }
                    }
                } else if target_path.exists() {
                    // Fallback cleanup if backup file is missing
                    if target_path.extension().map_or(false, |ext| ext == "css") {
                        if let Ok(content) = fs::read_to_string(&target_path) {
                            if let Some(pos) =
                                content.find("/* [Antigravity-Shield-RTL-Vazirmatn] */")
                            {
                                let cleaned = &content[..pos];
                                let _ = fs::write(&target_path, cleaned.trim_end());
                                restored_count += 1;
                                if let Some(app_dir) = out_dir.parent() {
                                    update_product_checksum(app_dir, rel_key, &target_path);
                                }
                            }
                        }
                    } else if target_path.extension().map_or(false, |ext| ext == "html") {
                        if let Ok(content) = fs::read_to_string(&target_path) {
                            if let Some(s_pos) =
                                content.find("<style id=\"antigravity-shield-ide-bidi\">")
                            {
                                if let Some(e_pos) = content[s_pos..].find("</style>") {
                                    let mut cleaned = content.clone();
                                    cleaned.replace_range(s_pos..s_pos + e_pos + 8, "");
                                    let _ = fs::write(&target_path, cleaned);
                                    restored_count += 1;
                                    if let Some(app_dir) = out_dir.parent() {
                                        update_product_checksum(app_dir, rel_key, &target_path);
                                    }
                                }
                            }
                        }
                    } else if target_path.extension().map_or(false, |ext| ext == "js") {
                        if let Ok(content) = fs::read_to_string(&target_path) {
                            if let Some(pos) =
                                content.find("// [Antigravity-Shield-IDE-BiDi-Sentinel]")
                            {
                                let cleaned = &content[..pos];
                                let _ = fs::write(&target_path, cleaned.trim_end());
                                restored_count += 1;
                                if let Some(app_dir) = out_dir.parent() {
                                    update_product_checksum(app_dir, rel_key, &target_path);
                                }
                            }
                        }
                    }
                }
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
        Ok(format!(
            "بازگردانی با موفقیت انجام شد. {} ماژول به حالت پیش‌فرض بازگشتند.",
            restored_count
        ))
    } else {
        Ok("فایل پشتیبانی برای بازگردانی یافت نشد.".into())
    }
}

fn update_product_checksum(app_dir: &Path, rel_key: &str, file_path: &Path) {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use sha2::{Digest, Sha256};

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
                checksums.insert(
                    rel_key.to_string(),
                    serde_json::Value::String(trimmed_hash.to_string()),
                );
                checksums.insert(
                    format!("out/{}", rel_key),
                    serde_json::Value::String(trimmed_hash.to_string()),
                );
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

#[tauri::command]
pub async fn apply_core_engine_patch(
) -> Result<crate::modules::patcher::PatcherExecutionResult, String> {
    tokio::task::spawn_blocking(crate::modules::patcher::run_fix_license_and_region_patch)
        .await
        .map_err(|e| format!("Task failed: {}", e))
}
