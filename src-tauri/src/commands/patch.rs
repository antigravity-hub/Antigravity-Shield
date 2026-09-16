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
@import url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css');

* {
  font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
}

p, li, span, div, h1, h2, h3, h4, h5, h6, textarea, input {
  unicode-bidi: plaintext !important;
  text-align: start !important;
}

code, pre, pre *, code *, kbd, .monospace {
  font-family: Menlo, Monaco, Consolas, "Fira Code", monospace !important;
  direction: ltr !important;
  unicode-bidi: normal !important;
  text-align: left !important;
}
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
                }
            }
        }
    }

    // 2. Restore Desktop app.asar
    if let Some(asar_path_str) = status.desktop_asar_path {
        let asar_path = Path::new(&asar_path_str);
        let backup_path = format!("{}.bak", asar_path_str);
        if Path::new(&backup_path).exists() {
            fs::copy(&backup_path, asar_path).map_err(|e| e.to_string())?;
            restored_count += 1;
        }
    }

    if restored_count > 0 {
        Ok(format!("بازگردانی با موفقیت انجام شد. {} ماژول به حالت پیش‌فرض (LTR) بازگشتند.", restored_count))
    } else {
        Ok("فایل پشتیبانی برای بازگردانی یافت نشد.".into())
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

