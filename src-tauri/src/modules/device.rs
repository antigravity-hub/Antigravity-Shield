use crate::models::DeviceProfile;
use crate::modules::{logger, process};
use chrono::Local;
use dashmap::DashMap;
use rand::{distributions::Alphanumeric, Rng};
use rusqlite::Connection;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;
use uuid::Uuid;

const DATA_DIR: &str = ".antigravity_tools";
const GLOBAL_BASELINE: &str = "device_original.json";

fn get_data_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("failed_to_get_home_dir")?;
    let data_dir = home.join(DATA_DIR);
    if !data_dir.exists() {
        fs::create_dir_all(&data_dir).map_err(|e| format!("failed_to_create_data_dir: {}", e))?;
    }
    Ok(data_dir)
}

/// Find storage.json path (prefer custom/portable paths)
pub fn get_storage_path(target_ide: Option<&str>) -> Result<PathBuf, String> {
    // 1) --user-data-dir flag
    if let Some(user_data_dir) = process::get_user_data_dir_from_process(target_ide) {
        let path = user_data_dir
            .join("User")
            .join("globalStorage")
            .join("storage.json");
        if path.exists() {
            return Ok(path);
        }
    }

    // 2) Portable mode (based on executable data/user-data)
    if let Some(exe_path) = process::get_antigravity_executable_path(target_ide) {
        if let Some(parent) = exe_path.parent() {
            let portable = parent
                .join("data")
                .join("user-data")
                .join("User")
                .join("globalStorage")
                .join("storage.json");
            if portable.exists() {
                return Ok(portable);
            }
        }
    }

    let folder_names: &[&str] = if target_ide == Some("ide") {
        &["Antigravity IDE"]
    } else if target_ide == Some("code") || target_ide == Some("cursor") {
        &["Antigravity"]
    } else {
        // target_ide = None: try IDE folder first, fall back to classic name
        &["Antigravity IDE", "Antigravity"]
    };

    // 3) Standard installation location
    #[cfg(target_os = "macos")]
    {
        let home = dirs::home_dir().ok_or("failed_to_get_home_dir")?;
        for folder_name in folder_names {
            let path = home.join(format!(
                "Library/Application Support/{}/User/globalStorage/storage.json",
                folder_name
            ));
            if path.exists() {
                return Ok(path);
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let appdata =
            std::env::var("APPDATA").map_err(|_| "failed_to_get_appdata_env".to_string())?;
        for folder_name in folder_names {
            let path = PathBuf::from(&appdata)
                .join(folder_name)
                .join("User\\globalStorage\\storage.json");
            if path.exists() {
                return Ok(path);
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let home = dirs::home_dir().ok_or("failed_to_get_home_dir")?;
        for folder_name in folder_names {
            let path = home.join(format!(
                ".config/{}/User/globalStorage/storage.json",
                folder_name
            ));
            if path.exists() {
                return Ok(path);
            }
        }
    }

    Err("storage_json_not_found".to_string())
}

/// Get directory of storage.json
pub fn get_storage_dir() -> Result<PathBuf, String> {
    let path = get_storage_path(None)?;
    path.parent()
        .map(|p| p.to_path_buf())
        .ok_or_else(|| "failed_to_get_storage_parent_dir".to_string())
}

/// Get state.vscdb path (same directory as storage.json)
pub fn get_state_db_path() -> Result<PathBuf, String> {
    let dir = get_storage_dir()?;
    Ok(dir.join("state.vscdb"))
}

/// Backup storage.json, returns backup file path
#[allow(dead_code)]
pub fn backup_storage(storage_path: &Path) -> Result<PathBuf, String> {
    if !storage_path.exists() {
        return Err(format!("storage_json_missing: {:?}", storage_path));
    }
    let dir = storage_path
        .parent()
        .ok_or_else(|| "failed_to_get_storage_parent_dir".to_string())?;
    let backup_path = dir.join(format!(
        "storage.json.backup_{}",
        Local::now().format("%Y%m%d_%H%M%S")
    ));
    fs::copy(storage_path, &backup_path).map_err(|e| format!("backup_failed: {}", e))?;
    Ok(backup_path)
}

/// Read current device profile from storage.json
#[allow(dead_code)]
pub fn read_profile(storage_path: &Path) -> Result<DeviceProfile, String> {
    let content = fs::read_to_string(storage_path)
        .map_err(|e| format!("read_failed ({:?}): {}", storage_path, e))?;
    let json: Value = serde_json::from_str(&content)
        .map_err(|e| format!("parse_failed ({:?}): {}", storage_path, e))?;

    // Supports nested telemetry or flat telemetry.xxx
    let get_field = |key: &str| -> Option<String> {
        if let Some(obj) = json.get("telemetry").and_then(|v| v.as_object()) {
            if let Some(v) = obj.get(key).and_then(|v| v.as_str()) {
                return Some(v.to_string());
            }
        }
        if let Some(v) = json
            .get(format!("telemetry.{key}"))
            .and_then(|v| v.as_str())
        {
            return Some(v.to_string());
        }
        None
    };

    Ok(DeviceProfile {
        machine_id: get_field("machineId").ok_or("missing_machine_id")?,
        mac_machine_id: get_field("macMachineId").ok_or("missing_mac_machine_id")?,
        dev_device_id: get_field("devDeviceId").ok_or("missing_dev_device_id")?,
        sqm_id: get_field("sqmId").ok_or("missing_sqm_id")?,
    })
}

/// Write device profile to storage.json
pub fn write_profile(storage_path: &Path, profile: &DeviceProfile) -> Result<(), String> {
    if !storage_path.exists() {
        return Err(format!("storage_json_missing: {:?}", storage_path));
    }

    let content = fs::read_to_string(storage_path).map_err(|e| format!("read_failed: {}", e))?;
    let mut json: Value =
        serde_json::from_str(&content).map_err(|e| format!("parse_failed: {}", e))?;

    // Ensure telemetry is an object
    if !json.get("telemetry").map_or(false, |v| v.is_object()) {
        if json.as_object_mut().is_some() {
            json["telemetry"] = serde_json::json!({});
        } else {
            return Err("json_top_level_not_object".to_string());
        }
    }

    if let Some(telemetry) = json.get_mut("telemetry").and_then(|v| v.as_object_mut()) {
        telemetry.insert(
            "machineId".to_string(),
            Value::String(profile.machine_id.clone()),
        );
        telemetry.insert(
            "macMachineId".to_string(),
            Value::String(profile.mac_machine_id.clone()),
        );
        telemetry.insert(
            "devDeviceId".to_string(),
            Value::String(profile.dev_device_id.clone()),
        );
        telemetry.insert("sqmId".to_string(), Value::String(profile.sqm_id.clone()));
    } else {
        return Err("telemetry_not_object".to_string());
    }

    // Write flat keys as well, compatible with old formats
    if let Some(map) = json.as_object_mut() {
        map.insert(
            "telemetry.machineId".to_string(),
            Value::String(profile.machine_id.clone()),
        );
        map.insert(
            "telemetry.macMachineId".to_string(),
            Value::String(profile.mac_machine_id.clone()),
        );
        map.insert(
            "telemetry.devDeviceId".to_string(),
            Value::String(profile.dev_device_id.clone()),
        );
        map.insert(
            "telemetry.sqmId".to_string(),
            Value::String(profile.sqm_id.clone()),
        );
    }

    // Sync storage.serviceMachineId (match with devDeviceId), place at root level
    if let Some(map) = json.as_object_mut() {
        map.insert(
            "storage.serviceMachineId".to_string(),
            Value::String(profile.dev_device_id.clone()),
        );
    }

    let updated =
        serde_json::to_string_pretty(&json).map_err(|e| format!("serialize_failed: {}", e))?;
    fs::write(storage_path, updated)
        .map_err(|e| format!("write_failed ({:?}): {}", storage_path, e))?;
    logger::log_info(&format!("device_profile_written to {:?}", storage_path));

    // Sync ItemTable.storage.serviceMachineId in state.vscdb
    let _ = sync_state_service_machine_id_value(&profile.dev_device_id);
    Ok(())
}

/// Only sync serviceMachineId, don't change other fields
#[allow(dead_code)]
pub fn sync_service_machine_id(storage_path: &Path, service_id: &str) -> Result<(), String> {
    let content = fs::read_to_string(storage_path).map_err(|e| format!("read_failed: {}", e))?;
    let mut json: Value =
        serde_json::from_str(&content).map_err(|e| format!("parse_failed: {}", e))?;

    if let Some(map) = json.as_object_mut() {
        map.insert(
            "storage.serviceMachineId".to_string(),
            Value::String(service_id.to_string()),
        );
    }

    let updated =
        serde_json::to_string_pretty(&json).map_err(|e| format!("serialize_failed: {}", e))?;
    fs::write(storage_path, updated).map_err(|e| format!("write_failed: {}", e))?;
    logger::log_info("service_machine_id_synced");

    let _ = sync_state_service_machine_id_value(service_id);
    Ok(())
}

/// Read serviceMachineId from storage.json (fallback to devDeviceId), sync back if missing and sync state.vscdb
#[allow(dead_code)]
pub fn sync_service_machine_id_from_storage(storage_path: &Path) -> Result<(), String> {
    if !storage_path.exists() {
        return Err("storage_json_missing".to_string());
    }
    let content = fs::read_to_string(storage_path).map_err(|e| format!("read_failed: {}", e))?;
    let mut json: Value =
        serde_json::from_str(&content).map_err(|e| format!("parse_failed: {}", e))?;

    let service_id = json
        .get("storage.serviceMachineId")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| {
            json.get("telemetry")
                .and_then(|t| t.get("devDeviceId"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
        .or_else(|| {
            json.get("telemetry.devDeviceId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
        .ok_or("missing_ids_in_storage")?;

    let mut dirty = false;
    if json
        .get("storage.serviceMachineId")
        .and_then(|v| v.as_str())
        .is_none()
    {
        if let Some(map) = json.as_object_mut() {
            map.insert(
                "storage.serviceMachineId".to_string(),
                Value::String(service_id.clone()),
            );
            dirty = true;
        }
    }

    if dirty {
        let updated =
            serde_json::to_string_pretty(&json).map_err(|e| format!("serialize_failed: {}", e))?;
        fs::write(storage_path, updated).map_err(|e| format!("write_failed: {}", e))?;
        logger::log_info("service_machine_id_added");
    }

    sync_state_service_machine_id_value(&service_id)
}

fn sync_state_service_machine_id_value(service_id: &str) -> Result<(), String> {
    let db_path = get_state_db_path()?;
    if !db_path.exists() {
        logger::log_warn(&format!("state_db_missing: {:?}", db_path));
        return Ok(());
    }

    let conn = Connection::open(&db_path).map_err(|e| format!("db_open_failed: {}", e))?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS ItemTable (key TEXT PRIMARY KEY, value TEXT);",
        [],
    )
    .map_err(|e| format!("failed_to_create_item_table: {}", e))?;
    conn.execute(
        "INSERT OR REPLACE INTO ItemTable (key, value) VALUES ('storage.serviceMachineId', ?1);",
        [service_id],
    )
    .map_err(|e| format!("failed_to_write_to_db: {}", e))?;
    logger::log_info("service_machine_id_synced_to_db");
    Ok(())
}

/// Load/Save global original profile (shared across all accounts)
pub fn load_global_original() -> Option<DeviceProfile> {
    if let Ok(dir) = get_data_dir() {
        let path = dir.join(GLOBAL_BASELINE);
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(profile) = serde_json::from_str::<DeviceProfile>(&content) {
                    return Some(profile);
                }
            }
        }
    }
    None
}

pub fn save_global_original(profile: &DeviceProfile) -> Result<(), String> {
    let dir = get_data_dir()?;
    let path = dir.join(GLOBAL_BASELINE);
    if path.exists() {
        return Ok(()); // already exists, don't overwrite
    }
    let content =
        serde_json::to_string_pretty(profile).map_err(|e| format!("serialize_failed: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("write_failed: {}", e))
}

/// List storage.json backups in current directory (descending by time)
#[allow(dead_code)]
pub fn list_backups(storage_path: &Path) -> Result<Vec<PathBuf>, String> {
    let dir = storage_path
        .parent()
        .ok_or_else(|| "failed_to_get_storage_parent_dir".to_string())?;
    let mut backups = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.starts_with("storage.json.backup_") {
                    backups.push(path);
                }
            }
        }
    }
    // Sort by modification time (new to old)
    backups.sort_by(|a, b| {
        let ma = fs::metadata(a).and_then(|m| m.modified()).ok();
        let mb = fs::metadata(b).and_then(|m| m.modified()).ok();
        mb.cmp(&ma)
    });
    Ok(backups)
}

/// Restore backup to storage.json. If use_oldest=true, use oldest backup, else use latest.
#[allow(dead_code)]
pub fn restore_backup(storage_path: &Path, use_oldest: bool) -> Result<PathBuf, String> {
    let backups = list_backups(storage_path)?;
    if backups.is_empty() {
        return Err("no_backups_found".to_string());
    }
    let target = if use_oldest {
        backups.last().unwrap().clone()
    } else {
        backups.first().unwrap().clone()
    };
    // backup current first
    let _ = backup_storage(storage_path)?;
    fs::copy(&target, storage_path).map_err(|e| format!("restore_failed: {}", e))?;
    logger::log_info(&format!("storage_json_restored: {:?}", target));
    Ok(target)
}

/// Generate a new set of device fingerprints (Cursor/VSCode style)
pub fn generate_profile() -> DeviceProfile {
    DeviceProfile {
        machine_id: format!("auth0|user_{}", random_hex(32)),
        mac_machine_id: new_standard_machine_id(),
        dev_device_id: Uuid::new_v4().to_string(),
        sqm_id: format!("{{{}}}", Uuid::new_v4().to_string().to_uppercase()),
    }
}

fn random_hex(length: usize) -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(length)
        .map(char::from)
        .collect::<String>()
        .to_lowercase()
}

fn new_standard_machine_id() -> String {
    // xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (y in 8..b)
    let mut rng = rand::thread_rng();
    let mut id = String::with_capacity(36);
    for ch in "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".chars() {
        if ch == '-' || ch == '4' {
            id.push(ch);
        } else if ch == 'x' {
            id.push_str(&format!("{:x}", rng.gen_range(0..16)));
        } else if ch == 'y' {
            id.push_str(&format!("{:x}", rng.gen_range(8..12)));
        }
    }
    id
}

/// Per-account in-memory session cache: account_id -> session_id
static ACCOUNT_SESSIONS: LazyLock<DashMap<String, String>> = LazyLock::new(DashMap::new);

/// Deterministically derive a unique, RFC 4122 compliant UUID machine ID for an account
/// using the host machine UID as a salt, ensuring no two accounts ever share a machine ID
/// and no raw host hardware ID is ever transmitted upstream.
pub fn derive_account_machine_id(account_id: &str) -> String {
    let host_seed = machine_uid::get().unwrap_or_else(|_| "antigravity-default-host".to_string());
    let mut hasher = Sha256::new();
    hasher.update(b"antigravity:device_profile:machine_id:v1:");
    hasher.update(host_seed.as_bytes());
    hasher.update(b":");
    hasher.update(account_id.as_bytes());
    let digest = hasher.finalize();

    // Format first 16 bytes as UUIDv4-like string: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    let mut bytes = [0u8; 16];
    bytes.copy_from_slice(&digest[..16]);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant RFC 4122

    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        bytes[0], bytes[1], bytes[2], bytes[3],
        bytes[4], bytes[5],
        bytes[6], bytes[7],
        bytes[8], bytes[9],
        bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]
    )
}

/// Retrieve the isolated machine ID for an account.
/// Priority:
/// 1. `profile.mac_machine_id` (if present and non-empty)
/// 2. `profile.machine_id` (if present, non-empty, and not starting with "auth0|")
/// 3. Salted hash derived from `account_id`
/// 4. Fresh UUIDv4 runtime fallback (never raw host hardware UID)
pub fn get_account_machine_id(account_id: Option<&str>, profile: Option<&DeviceProfile>) -> String {
    if let Some(p) = profile {
        if !p.mac_machine_id.trim().is_empty() {
            return p.mac_machine_id.clone();
        }
        if !p.machine_id.trim().is_empty() && !p.machine_id.starts_with("auth0|") {
            return p.machine_id.clone();
        }
    }
    if let Some(id) = account_id {
        return derive_account_machine_id(id);
    }
    Uuid::new_v4().to_string()
}

/// Retrieve or lazily initialize an isolated session ID for an account.
/// The session ID remains stable for the lifetime of this process run,
/// perfectly mimicking a dedicated IDE window session.
pub fn derive_account_session_id(account_id: &str) -> String {
    if let Some(sess) = ACCOUNT_SESSIONS.get(account_id) {
        return sess.clone();
    }
    let new_sess = Uuid::new_v4().to_string();
    ACCOUNT_SESSIONS.insert(account_id.to_string(), new_sess.clone());
    new_sess
}

/// Manually rotate an account's session ID (e.g. after error recovery or explicit switch)
pub fn rotate_account_session_id(account_id: &str) -> String {
    let new_sess = Uuid::new_v4().to_string();
    ACCOUNT_SESSIONS.insert(account_id.to_string(), new_sess.clone());
    new_sess
}

/// [Interface Contract from PROJECT.md]
/// Builds fully isolated HTTP headers for Google v1internal requests matching account DeviceProfile.
pub fn get_account_device_headers(account: &crate::models::Account) -> rquest::header::HeaderMap {
    let mut headers = rquest::header::HeaderMap::new();

    // 1. Client Identity (Enterprise vs Standard)
    let is_enterprise = !account.email.ends_with("@gmail.com") && !account.email.ends_with("@googlemail.com");
    let client_name = if is_enterprise { "jetski" } else { "antigravity" };
    if let Ok(cname_val) = rquest::header::HeaderValue::from_str(client_name) {
        headers.insert("x-client-name", cname_val);
    }

    if let Ok(ver) = rquest::header::HeaderValue::from_str(&crate::constants::CURRENT_VERSION) {
        headers.insert("x-client-version", ver);
    }

    // 2. Isolated Machine ID
    let machine_id = get_account_machine_id(Some(&account.id), account.device_profile.as_ref());
    if let Ok(mid_val) = rquest::header::HeaderValue::from_str(&machine_id) {
        headers.insert("x-machine-id", mid_val);
    }

    // 3. Isolated Session ID
    let session_id = derive_account_session_id(&account.id);
    if let Ok(sess_val) = rquest::header::HeaderValue::from_str(&session_id) {
        headers.insert("x-vscode-sessionid", sess_val);
    }

    headers
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_derive_account_machine_id_deterministic() {
        let id1 = derive_account_machine_id("acc_123");
        let id2 = derive_account_machine_id("acc_123");
        assert_eq!(id1, id2, "Same account ID must produce identical machine ID");
    }

    #[test]
    fn test_derive_account_machine_id_isolation() {
        let id_a = derive_account_machine_id("account_a@gmail.com");
        let id_b = derive_account_machine_id("account_b@gmail.com");
        assert_ne!(id_a, id_b, "Different accounts must have completely isolated machine IDs");
    }

    #[test]
    fn test_get_account_machine_id_prefers_profile() {
        let profile = DeviceProfile {
            machine_id: "auth0|user_123".to_string(),
            mac_machine_id: "custom-bound-mac-id-12345".to_string(),
            dev_device_id: "dev-id".to_string(),
            sqm_id: "{SQM}".to_string(),
        };
        let mid = get_account_machine_id(Some("acc_xyz"), Some(&profile));
        assert_eq!(mid, "custom-bound-mac-id-12345");
    }

    #[test]
    fn test_derive_account_session_id_isolation() {
        let sess_a = derive_account_session_id("account_a");
        let sess_b = derive_account_session_id("account_b");
        assert_ne!(sess_a, sess_b, "Different accounts must have isolated session IDs");

        let sess_a_repeat = derive_account_session_id("account_a");
        assert_eq!(sess_a, sess_a_repeat, "Session ID must remain stable for same account");
    }

    #[test]
    fn test_get_account_device_headers_enterprise_parity() {
        let standard_acc = crate::models::Account::new(
            "std_acc".to_string(),
            "user@gmail.com".to_string(),
            crate::models::TokenData {
                access_token: "at".to_string(),
                refresh_token: "rt".to_string(),
                expires_in: 3600,
                expiry_timestamp: 9999999,
                project_id: None,
            },
        );
        let enterprise_acc = crate::models::Account::new(
            "ent_acc".to_string(),
            "dev@corp.enterprise.com".to_string(),
            crate::models::TokenData {
                access_token: "at".to_string(),
                refresh_token: "rt".to_string(),
                expires_in: 3600,
                expiry_timestamp: 9999999,
                project_id: None,
            },
        );

        let h_std = get_account_device_headers(&standard_acc);
        let h_ent = get_account_device_headers(&enterprise_acc);

        assert_eq!(h_std.get("x-client-name").unwrap(), "antigravity");
        assert_eq!(h_ent.get("x-client-name").unwrap(), "jetski");
        assert_ne!(h_std.get("x-machine-id").unwrap(), h_ent.get("x-machine-id").unwrap());
        assert_ne!(h_std.get("x-vscode-sessionid").unwrap(), h_ent.get("x-vscode-sessionid").unwrap());
    }
}
