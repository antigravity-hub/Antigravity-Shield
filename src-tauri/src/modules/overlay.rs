use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, PhysicalPosition, Position};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverlayNotificationPayload {
    /// Notification type: "countdown" for auto-switch countdown, "toast" for informative messages
    pub notification_type: String,
    pub title: String,
    pub message: String,
    pub model_name: Option<String>,
    pub current_email: Option<String>,
    pub target_email: Option<String>,
    pub target_quota_score: Option<u32>,
    pub countdown_secs: Option<u32>,
    pub target_account_id: Option<String>,
    pub target_env: Option<String>,
}

/// Show the floating overlay notification HUD at the user's configured screen position
pub fn show_overlay_notification(
    app: &tauri::AppHandle,
    payload: OverlayNotificationPayload,
) -> Result<(), String> {
    let window = app
        .get_webview_window("notification-overlay")
        .ok_or_else(|| "Overlay window 'notification-overlay' not found".to_string())?;

    // Load configured position preference
    let config = crate::modules::config::load_app_config().unwrap_or_default();
    let pos_preference = config.overlay_position.to_lowercase();

    // Determine target monitor
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| app.primary_monitor().ok().flatten());

    if let Some(mon) = monitor {
        let mon_pos = mon.position();
        let mon_size = mon.size();
        let scale = mon.scale_factor();

        let win_width = (420.0 * scale) as i32;
        let win_height = (175.0 * scale) as i32;
        let margin_x = (24.0 * scale) as i32;
        let margin_y = (24.0 * scale) as i32;

        let (x, y) = match pos_preference.as_str() {
            "top-left" => (mon_pos.x + margin_x, mon_pos.y + margin_y),
            "bottom-left" => (
                mon_pos.x + margin_x,
                mon_pos.y + (mon_size.height as i32) - win_height - margin_y - (20.0 * scale) as i32,
            ),
            "bottom-right" => (
                mon_pos.x + (mon_size.width as i32) - win_width - margin_x,
                mon_pos.y + (mon_size.height as i32) - win_height - margin_y - (20.0 * scale) as i32,
            ),
            _ => {
                // Default: top-right
                (
                    mon_pos.x + (mon_size.width as i32) - win_width - margin_x,
                    mon_pos.y + margin_y,
                )
            }
        };

        let _ = window.set_position(Position::Physical(PhysicalPosition { x, y }));
    }

    // Emit payload data to the overlay webview component
    let _ = app.emit("overlay-notification-show", &payload);

    // Reveal and elevate on top
    window
        .show()
        .map_err(|e| format!("Failed to show overlay: {}", e))?;
    let _ = window.set_always_on_top(true);
    let _ = window.set_focus();

    crate::modules::logger::log_info(&format!(
        "[Overlay] Displayed floating HUD notification: {} (type: {})",
        payload.title, payload.notification_type
    ));

    Ok(())
}

/// Hide the floating overlay notification HUD
pub fn hide_overlay_notification(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("notification-overlay") {
        window
            .hide()
            .map_err(|e| format!("Failed to hide overlay: {}", e))?;
    }
    Ok(())
}
