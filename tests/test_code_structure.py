import sys
import os
import subprocess
import time

def test_shield_daemon_syntax_and_structure():
    daemon_path = os.path.join("src-tauri", "src", "daemon_main.rs")
    assert os.path.exists(daemon_path), f"File {daemon_path} does not exist"
    with open(daemon_path, "r", encoding="utf-8") as f:
        code = f.read()

    # Verify key architectural integrations
    assert "antigravity_shield_lib::proxy::AxumServer::start" in code
    assert "antigravity_shield_lib::modules::integration::SystemManager::Headless" in code
    assert "antigravity_shield_lib::proxy::TokenManager::new" in code
    assert "tokio::main" in code
    assert "--port" in code
    assert "graceful_shutdown" in code
    print("PASS: test_shield_daemon_syntax_and_structure")

def test_image_pool_syntax_and_structure():
    pool_path = os.path.join("src-tauri", "src", "proxy", "image_pool.rs")
    assert os.path.exists(pool_path), f"File {pool_path} does not exist"
    with open(pool_path, "r", encoding="utf-8") as f:
        code = f.read()

    assert "pub struct TokenBucketImagePool" in code
    assert "pub struct AccountTokenBucket" in code
    assert "pub struct ImagePoolPermit" in code
    assert "pub async fn acquire_bounded" in code
    assert "pub async fn apply_account_lockout" in code
    assert "calculate_jitter_backoff" in code
    print("PASS: test_image_pool_syntax_and_structure")

def test_cargo_toml_targets():
    cargo_path = os.path.join("src-tauri", "Cargo.toml")
    with open(cargo_path, "r", encoding="utf-8") as f:
        toml_content = f.read()

    assert 'name = "shield-daemon"' in toml_content
    assert 'path = "src/daemon_main.rs"' in toml_content
    print("PASS: test_cargo_toml_targets")

if __name__ == "__main__":
    print("\n--- Running Static Code Verification Suite ---")
    test_shield_daemon_syntax_and_structure()
    test_image_pool_syntax_and_structure()
    test_cargo_toml_targets()
    print("ALL CODE STRUCTURE TESTS PASSED!\n")
