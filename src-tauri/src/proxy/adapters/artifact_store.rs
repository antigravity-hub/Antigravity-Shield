// Antigravity Shield — AI Proxy & Fleet Management Engine
// Repository: https://github.com/antigravity-hub/Antigravity-Shield

//! Tool artifact store - Decoupled stub for Antigravity Shield proxy core.

use std::sync::OnceLock;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredToolArtifact {
    pub artifact_id: String,
    pub call_id: Option<String>,
    pub kind: String,
    pub original_chars: usize,
    pub original_lines: usize,
    pub persisted: bool,
}

#[derive(Debug, Default)]
pub struct ToolArtifactStore;

impl ToolArtifactStore {
    pub fn new() -> Self {
        Self
    }
}

static GLOBAL_STORE: OnceLock<ToolArtifactStore> = OnceLock::new();

pub fn global_tool_artifact_store() -> &'static ToolArtifactStore {
    GLOBAL_STORE.get_or_init(ToolArtifactStore::new)
}
