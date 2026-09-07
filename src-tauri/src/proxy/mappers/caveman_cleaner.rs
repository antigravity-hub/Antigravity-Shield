//! Caveman Cleaner Module
//!
//! Rust-native implementation of natural language prompt compression.
//! Ported and optimized from OmniRoute's Caveman engine.

use once_cell::sync::Lazy;
use regex::Regex;

// Regular expression to isolate code blocks, inline code, URLs, env vars, etc.
static PROTECTED_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?im)```[\s\S]*?```|`[^`\n]{1,1000}`|https?://[^\s\)\x22]+|\bprocess\.env\.[A-Za-z_]\w*|\$[A-Z_]\w*|\b(?:TypeError|ReferenceError|SyntaxError|RangeError|URIError|Error|Exception):[^\n]*").unwrap()
});

// A collection of clean rules: (Regex to match, Replacement string)
static FILLER_RULES: Lazy<Vec<(Regex, &'static str)>> = Lazy::new(|| {
    vec![
        // Polite phrasing & acknowledgements
        (Regex::new(r"(?i)\b(please|kindly|could you please|would you please|can you please|i would like you to|i want you to|i need you to)\b\s*").unwrap(), ""),
        (Regex::new(r"(?i)\b(i'd be happy to|i would be happy to|i'd be glad to|i would be glad to|glad to help|happy to|thank you so much|thank you|thanks in advance|thanks|no problem|you're welcome|youre welcome|absolutely|certainly|of course)\b[,.!?\s]*").unwrap(), ""),
        (Regex::new(r"(?i)\bsure\b[,.!?\s]*").unwrap(), ""),

        // Verbose queries / starters
        (Regex::new(r"(?i)\b(i was wondering if you could|would it be possible to)\b\s*").unwrap(), ""),
        (Regex::new(r"(?im)^(hi there|hello|good morning|hey)\s*[,.!?\s]?\s*").unwrap(), ""),

        // Hedging & qualifiers
        (Regex::new(r"(?i)\b(it seems like|it appears that|i think that|i believe that|probably|possibly|maybe it|maybe)\b\s*").unwrap(), ""),
        (Regex::new(r"(?i)\b(a bit|a little|somewhat|kind of|sort of)\b\s*").unwrap(), ""),

        // Filler adverbs & helper starters
        (Regex::new(r"(?i)\b(basically|essentially|actually|literally|simply|currently)\b\s*").unwrap(), ""),

        // Structural verbosity
        (Regex::new(r"(?i)\b(in order to|so as to)\b\s*").unwrap(), "to "),
        (Regex::new(r"(?i)\b(for the purpose of|with the goal of|in an effort to)\b\s*").unwrap(), "to "),
        (Regex::new(r"(?i)\b(furthermore|additionally|moreover|in addition)\b\s*").unwrap(), "also "),
        (Regex::new(r"(?i)\b(each and every single|each and every|any and all)\b\s*").unwrap(), "each "),
        (Regex::new(r"(?i)\b(very|really|extremely|highly|quite)\b\s*").unwrap(), ""),

        // Redundant transition openers
        (Regex::new(r"(?im)^(on the other hand|in contrast|however),?\s*").unwrap(), ""),
    ]
});

// Spaces cleanup
static SPACE_PUNCT_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"\s+([,.!?;:])").unwrap());

static MULTI_SPACE_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"[ \t]+").unwrap());

static MULTI_NEWLINE_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"\n{3,}").unwrap());

pub struct CavemanCleaner;

impl CavemanCleaner {
    /// Compress natural language prompt by removing fillers while protecting code/URL structures
    pub fn clean(text: &str) -> String {
        if text.is_empty() {
            return String::new();
        }

        // 1. Extract and preserve code blocks/URLs/errors
        let mut preserved_blocks = Vec::new();
        let placeholder_text = PROTECTED_RE
            .replace_all(text, |caps: &regex::Captures| {
                let matched = caps.get(0).unwrap().as_str().to_string();
                let idx = preserved_blocks.len();
                preserved_blocks.push(matched);
                format!("__PRESERVED_BLOCK_{}__", idx)
            })
            .to_string();

        // 1.5. Protect "make sure" and "be sure" before removing "sure" as a filler
        let make_sure_re = Regex::new(r"(?i)\b(make|be)\s+sure\b").unwrap();
        let placeholder_text_protected = make_sure_re
            .replace_all(&placeholder_text, |caps: &regex::Captures| {
                let verb = caps.get(1).unwrap().as_str().to_string();
                format!("__PROTECTED_SURE_{}__", verb)
            })
            .to_string();

        // 2. Apply filler removal rules on the non-code text
        let mut compressed_text = placeholder_text_protected;
        for (re, replacement) in FILLER_RULES.iter() {
            compressed_text = re.replace_all(&compressed_text, *replacement).to_string();
        }

        // 3. Clean spacing and punctuation
        compressed_text = Self::cleanup_artifacts(&compressed_text);

        // Restore protected "sure" phrases
        let restore_make_sure_re = Regex::new(r"(?i)__PROTECTED_SURE_(make|be)__").unwrap();
        compressed_text = restore_make_sure_re
            .replace_all(&compressed_text, |caps: &regex::Captures| {
                let verb = caps.get(1).unwrap().as_str().to_string();
                format!("{} sure", verb)
            })
            .to_string();

        // 4. Restore preserved blocks
        for (idx, block) in preserved_blocks.iter().enumerate() {
            let placeholder = format!("__PRESERVED_BLOCK_{}__", idx);
            compressed_text = compressed_text.replace(&placeholder, block);
        }

        // 5. Final spacing cleanup after block restoration
        Self::cleanup_artifacts(&compressed_text)
    }

    /// Helper to cleanup whitespace, excess newlines, and trailing spaces
    fn cleanup_artifacts(text: &str) -> String {
        let mut s = text.to_string();

        // Collapse multiple spaces/tabs into a single space
        s = MULTI_SPACE_RE.replace_all(&s, " ").to_string();

        // Remove spaces before punctuation (e.g. "word ." -> "word.")
        s = SPACE_PUNCT_RE.replace_all(&s, "$1").to_string();

        // Collapse 3+ consecutive newlines into 2 (keep paragraph breaks clean)
        s = MULTI_NEWLINE_RE.replace_all(&s, "\n\n").to_string();

        // Trim leading and trailing newlines/spaces
        s.trim().to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_caveman_clean() {
        let input = "Hello there! Could you please tell me how to resolve this bug? Basically, I need to make sure to fix it in order to run my project successfully. Here is the code:\n\n```rust\nfn main() {\n    println!(\"Hello World\");\n}\n```\n\nThank you so much in advance!";

        let cleaned = CavemanCleaner::clean(input);

        // Assert fillers are stripped
        assert!(!cleaned.contains("Hello there"));
        assert!(!cleaned.contains("Could you please"));
        assert!(!cleaned.contains("Basically"));
        assert!(!cleaned.contains("Thank you so much"));

        // Assert critical code and structure are preserved exactly
        assert!(cleaned.contains("fn main() {"));
        assert!(cleaned.contains("println!(\"Hello World\");"));
    }
}
