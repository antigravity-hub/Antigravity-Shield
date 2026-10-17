//! apply_patch preflight - Decoupled stub for Antigravity Shield proxy core.

use serde_json::Value;

#[derive(Debug, Clone, PartialEq)]
pub struct Repair {
    pub file: String,
    pub kind: String,
    pub detail: String,
}

pub fn repairs_to_value(_repairs: &[Repair]) -> Value {
    Value::Array(Vec::new())
}
