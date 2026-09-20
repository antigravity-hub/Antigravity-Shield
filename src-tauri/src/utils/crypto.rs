use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose, Engine as _};
use rand::rngs::OsRng;
use serde::{Deserialize, Deserializer, Serializer};
use sha2::Digest;

const ENCRYPTED_PREFIX: &str = "ag_enc_";
const ENCRYPTED_V2_PREFIX: &str = "ag_enc_v2_";

fn get_encryption_key() -> [u8; 32] {
    if let Ok(device_id) = machine_uid::get() {
        if !device_id.trim().is_empty() {
            let hash = sha2::Sha256::digest(device_id.as_bytes());
            return hash.into();
        }
    }

    // Dynamic runtime fallback without hard-coded literals
    let mut hasher = sha2::Sha256::new();
    hasher.update(std::process::id().to_le_bytes());
    if let Ok(duration) = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) {
        hasher.update(duration.as_nanos().to_le_bytes());
    }
    hasher.finalize().into()
}

pub fn serialize_password<S>(secret: &str, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    if secret.starts_with(ENCRYPTED_PREFIX) || secret.starts_with(ENCRYPTED_V2_PREFIX) {
        return serializer.serialize_str(secret);
    }

    let encrypted = encrypt_string(secret).map_err(serde::ser::Error::custom)?;
    serializer.serialize_str(&encrypted)
}

pub fn deserialize_password<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: Deserializer<'de>,
{
    let raw = String::deserialize(deserializer)?;
    if raw.is_empty() {
        return Ok(raw);
    }

    if raw.starts_with(ENCRYPTED_V2_PREFIX) {
        match decrypt_string_v2(&raw[ENCRYPTED_V2_PREFIX.len()..]) {
            Ok(plaintext) => Ok(plaintext),
            Err(_) => Ok(raw),
        }
    } else {
        // Plain text or legacy unencrypted entry
        Ok(raw)
    }
}

pub fn encrypt_string(plain_text: &str) -> Result<String, String> {
    let key = get_encryption_key();
    let cipher = Aes256Gcm::new(&key.into());

    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

    let ciphertext = cipher
        .encrypt(&nonce, plain_text.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    let encoded_nonce = general_purpose::STANDARD_NO_PAD.encode(nonce.as_slice());
    let encoded_ciphertext = general_purpose::STANDARD_NO_PAD.encode(ciphertext);
    Ok(format!(
        "{}{}.{}",
        ENCRYPTED_V2_PREFIX, encoded_nonce, encoded_ciphertext
    ))
}

fn decrypt_string_v2(encrypted: &str) -> Result<String, String> {
    let (nonce_base64, ciphertext_base64) = encrypted
        .split_once('.')
        .ok_or_else(|| "Invalid encrypted payload".to_string())?;

    let nonce_bytes = general_purpose::STANDARD_NO_PAD
        .decode(nonce_base64)
        .map_err(|e| format!("Nonce decode failed: {}", e))?;
    if nonce_bytes.len() != 12 {
        return Err("Invalid nonce length".to_string());
    }

    let ciphertext = general_purpose::STANDARD_NO_PAD
        .decode(ciphertext_base64)
        .map_err(|e| format!("Ciphertext decode failed: {}", e))?;

    let key = get_encryption_key();
    let cipher = Aes256Gcm::new(&key.into());
    let plaintext = cipher
        .decrypt(Nonce::from_slice(&nonce_bytes), ciphertext.as_ref())
        .map_err(|e| format!("Decryption failed: {}", e))?;

    String::from_utf8(plaintext).map_err(|e| format!("UTF-8 conversion failed: {}", e))
}

pub fn decrypt_string(encrypted: &str) -> Result<String, String> {
    if encrypted.starts_with(ENCRYPTED_V2_PREFIX) {
        decrypt_string_v2(&encrypted[ENCRYPTED_V2_PREFIX.len()..])
    } else {
        Ok(encrypted.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_cycle() {
        let test_content = format!("test_value_{}", std::process::id());
        let encrypted = encrypt_string(&test_content).unwrap();

        assert!(encrypted.starts_with(ENCRYPTED_V2_PREFIX));
        assert_ne!(&test_content, &encrypted);

        let decrypted = decrypt_string(&encrypted).unwrap();
        assert_eq!(test_content, decrypted);
    }

    #[test]
    fn test_encrypt_uses_unique_nonce() {
        let test_content = format!("test_value_{}", std::process::id());
        let encrypted_a = encrypt_string(&test_content).unwrap();
        let encrypted_b = encrypt_string(&test_content).unwrap();

        assert_ne!(encrypted_a, encrypted_b);
        assert_eq!(decrypt_string(&encrypted_a).unwrap(), test_content);
        assert_eq!(decrypt_string(&encrypted_b).unwrap(), test_content);
    }
}
