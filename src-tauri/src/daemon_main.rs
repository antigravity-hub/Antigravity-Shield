// daemon_main.rs - Standalone Headless CLI AI Gateway Daemon (v5.7.1)
// Decoupled from graphical desktop subsystems (X11/Wayland) for Linux, VPS, and Docker.

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tracing::{error, info, warn};

#[derive(Debug)]
struct CliArgs {
    command: String,
    port: Option<u16>,
    bind: Option<String>,
    config_path: Option<PathBuf>,
}

fn parse_cli_args() -> CliArgs {
    let args: Vec<String> = std::env::args().collect();
    let mut command = "start".to_string();
    let mut port = None;
    let mut bind = None;
    let mut config_path = None;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "start" | "status" | "accounts" | "version" | "help" => {
                command = args[i].clone();
            }
            "--port" | "-p" => {
                if i + 1 < args.len() {
                    port = args[i + 1].parse::<u16>().ok();
                    i += 1;
                }
            }
            "--bind" | "-b" => {
                if i + 1 < args.len() {
                    bind = Some(args[i + 1].clone());
                    i += 1;
                }
            }
            "--config" | "-c" => {
                if i + 1 < args.len() {
                    config_path = Some(PathBuf::from(&args[i + 1]));
                    i += 1;
                }
            }
            "--help" | "-h" => {
                command = "help".to_string();
            }
            _ => {}
        }
        i += 1;
    }

    CliArgs {
        command,
        port,
        bind,
        config_path,
    }
}

fn print_help() {
    println!(
        r#"
Antigravity Shield Headless AI Gateway Daemon (shield-daemon)
Version 5.7.1

USAGE:
    shield-daemon [COMMAND] [OPTIONS]

COMMANDS:
    start       Start the headless AI gateway proxy server (default)
    status      Check status of local data directory and configured accounts
    accounts    List accounts and their active quota states
    version     Display version information
    help        Show this help message

OPTIONS:
    -p, --port <PORT>       Override listening port (default: from config or 8045)
    -b, --bind <HOST>       Override bind address (default: 127.0.0.1)
    -c, --config <PATH>     Specify custom configuration JSON path
    -h, --help              Print help information
"#
    );
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = parse_cli_args();

    if cli.command == "help" {
        print_help();
        return Ok(());
    }

    if cli.command == "version" {
        println!("shield-daemon v5.7.1 (headless gateway engine)");
        return Ok(());
    }

    // Set up headless tracing subscriber (stdout)
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));
    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(false)
        .with_thread_ids(false)
        .init();

    info!("🛡️ Starting Antigravity Shield Headless Daemon (v5.7.1)...");

    // Initialize headless data directory
    let data_dir = antigravity_shield_lib::modules::account::get_data_dir()
        .map_err(|e| format!("Failed to resolve data directory: {}", e))?;
    info!("📂 Using data directory: {}", data_dir.display());

    // Load configuration
    let mut config = antigravity_shield_lib::modules::config::load_app_config()
        .map_err(|e| format!("Failed to load configuration: {}", e))?;

    // Apply CLI overrides
    if let Some(p) = cli.port {
        config.proxy.port = p;
    }
    if let Some(b) = cli.bind {
        config.proxy.host = b;
    }

    if cli.command == "status" || cli.command == "accounts" {
        let token_manager = Arc::new(antigravity_shield_lib::proxy::TokenManager::new(data_dir.clone()));
        token_manager.load_accounts().await?;
        let accounts = token_manager.enabled_account_ids();
        println!("\n=== Antigravity Shield Daemon Status ===");
        println!("Data Directory: {}", data_dir.display());
        println!("Configured Port: {}", config.proxy.port);
        println!("Active Accounts: {}", accounts.len());
        for id in accounts {
            println!("  - Account ID: {}", id);
        }
        println!("========================================\n");
        return Ok(());
    }

    // Initialize headless token manager and integration
    let token_manager = Arc::new(antigravity_shield_lib::proxy::TokenManager::new(data_dir.clone()));
    token_manager.load_accounts().await?;
    info!("👥 Loaded {} accounts into token manager", token_manager.enabled_account_ids().len());

    let integration = antigravity_shield_lib::modules::integration::SystemManager::Headless;
    let monitor = Arc::new(antigravity_shield_lib::proxy::monitor::ProxyMonitor::new(1000, None));
    let cloudflared_state = Arc::new(antigravity_shield_lib::commands::cloudflared::CloudflaredState::default());

    let host = config.proxy.host.clone();
    let port = config.proxy.port;

    info!("🚀 Launching Axum AI Gateway on http://{}:{}...", host, port);

    let (server, _handle) = antigravity_shield_lib::proxy::AxumServer::start(
        host,
        port,
        token_manager.clone(),
        config.proxy.custom_mapping.clone(),
        config.proxy.request_timeout,
        config.proxy.upstream_proxy.clone(),
        config.proxy.user_agent_override.clone(),
        antigravity_shield_lib::proxy::ProxySecurityConfig::from_proxy_config(&config.proxy),
        config.proxy.zai.clone(),
        monitor,
        config.proxy.experimental.clone(),
        config.proxy.debug_logging.clone(),
        integration,
        cloudflared_state,
        config.proxy.proxy_pool.clone(),
        config.proxy.only_raw_quota_models,
        config.proxy.image_scheduler.clone(),
    )
    .await
    .map_err(|e| format!("Axum server failed to bind: {}", e))?;

    info!("✅ Shield Headless Daemon successfully initialized and listening.");

    // Handle graceful shutdown signals (SIGINT / SIGTERM)
    tokio::signal::ctrl_c().await?;
    info!("🛑 Shutting down Shield Headless Daemon...");
    token_manager.graceful_shutdown(Duration::from_secs(2)).await;
    info!("👋 Shutdown complete.");

    Ok(())
}
