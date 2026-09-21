// Autostart 命令
use tauri::Emitter;
use tauri_plugin_autostart::ManagerExt;

#[cfg(target_os = "windows")]
const STARTUP_APPS: &[&str] = &["Antigravity Shield", "Antigravity Tools"];

/// Synchronizes Windows Task Manager's StartupApproved registry entry.
/// Windows 10/11 uses HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run
/// to track whether an application is enabled (byte 0 = 0x03 / absent) or disabled (byte 0 = 0x02) by the user in Task Manager.
#[cfg(target_os = "windows")]
pub fn sync_windows_startup_approved(enable: bool) {
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let subkey_path = r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";

    if let Ok((key, _)) = hkcu.create_subkey(subkey_path) {
        for &app_name in STARTUP_APPS {
            if enable {
                if let Ok(data) = key.get_raw_value(app_name) {
                    if !data.bytes.is_empty() && data.bytes[0] == 0x02 {
                        let mut updated_bytes = data.bytes.clone();
                        updated_bytes[0] = 0x03;
                        let reg_val = winreg::RegValue {
                            vtype: REG_BINARY,
                            bytes: updated_bytes,
                        };
                        let _ = key.set_raw_value(app_name, &reg_val);
                    }
                } else {
                    let default_approved = [
                        0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                    ];
                    let reg_val = winreg::RegValue {
                        vtype: REG_BINARY,
                        bytes: default_approved.to_vec(),
                    };
                    let _ = key.set_raw_value(app_name, &reg_val);
                }
            } else {
                let _ = key.delete_value(app_name);
            }
        }
    }
}

/// Applies auto-launch state to the underlying operating system.
pub fn set_system_autostart(app: &tauri::AppHandle, enable: bool) -> Result<(), String> {
    let manager = app.autolaunch();

    if enable {
        manager
            .enable()
            .map_err(|e| format!("启用自动启动失败: {}", e))?;

        #[cfg(target_os = "windows")]
        sync_windows_startup_approved(true);

        crate::modules::logger::log_info("已启用系统开机自动启动并同步注册表批准状态");
    } else {
        match manager.disable() {
            Ok(_) => {
                #[cfg(target_os = "windows")]
                sync_windows_startup_approved(false);

                crate::modules::logger::log_info("已禁用开机自动启动");
            }
            Err(e) => {
                let err_msg = e.to_string();
                // 在 Windows 上，如果注册表项不存在，disable() 会返回 "系统找不到指定的文件" (os error 2)
                if err_msg.contains("os error 2") || err_msg.contains("找不到指定的文件") {
                    #[cfg(target_os = "windows")]
                    sync_windows_startup_approved(false);

                    crate::modules::logger::log_info("开机自启项已不存在，视为禁用成功");
                } else {
                    return Err(format!("禁用自动启动失败: {}", e));
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn toggle_auto_launch(app: tauri::AppHandle, enable: bool) -> Result<(), String> {
    set_system_autostart(&app, enable)?;

    // 同步持久化到 gui_config.json
    if let Ok(mut config) = crate::modules::config::load_app_config() {
        if config.auto_launch != enable {
            config.auto_launch = enable;
            let _ = crate::modules::config::save_app_config(&config);
            let _ = app.emit("config://updated", ());
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn is_auto_launch_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    let manager = app.autolaunch();
    let enabled = manager.is_enabled().map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    {
        if enabled {
            use winreg::enums::*;
            use winreg::RegKey;

            let hkcu = RegKey::predef(HKEY_CURRENT_USER);
            let subkey_path =
                r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";
            if let Ok(key) = hkcu.open_subkey(subkey_path) {
                for &app_name in STARTUP_APPS {
                    if let Ok(data) = key.get_raw_value(app_name) {
                        if !data.bytes.is_empty() && data.bytes[0] == 0x02 {
                            return Ok(false);
                        }
                    }
                }
            }
        }
    }

    Ok(enabled)
}
