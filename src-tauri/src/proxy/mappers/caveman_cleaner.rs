//! Caveman Cleaner Module (Decoupled & Passthrough)
//!
//! Natural language transparency preserved: User prompts are passed through verbatim
//! without unrequested modification or filler word stripping.

pub struct CavemanCleaner;

impl CavemanCleaner {
    #[inline]
    pub fn clean(text: &str) -> String {
        text.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_caveman_passthrough() {
        let input = "Hello there! Could you please tell me how to resolve this bug? Thank you!";
        let cleaned = CavemanCleaner::clean(input);
        assert_eq!(cleaned, input);
    }
}
