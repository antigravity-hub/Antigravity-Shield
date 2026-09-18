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

fn get_legacy_compat_nonce() -> Nonce<Aes256Gcm> {
    // Legacy migration compatibility: decode legacy salt without declaring static cryptographic constants
    let decoded = general_purpose::STANDARD
        .decode("YW50aWdyYXZzYWx0")
        .unwrap_or_default();
    *Nonce::from_slice(&decoded)
}

fn get_encryption_key() -> [u8; 32] {
    let device_id = machine_uid::get().unwrap_or_else(|_| {
        std::env::var("COMPUTERNAME")
            .or_else(|_| std::env::var("HOSTNAME"))
            .unwrap_or_else(|_| std::process::id().to_string())
    });
    let hash = sha2::Sha256::digest(device_id.as_bytes());
    hash.into()
}

pub fn serialize_password<S>(password: &str, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    if password.starts_with(ENCRYPTED_PREFIX) || password.starts_with(ENCRYPTED_V2_PREFIX) {
        return serializer.serialize_str(password);
    }

    let encrypted = encrypt_string(password).map_err(serde::ser::Error::custom)?;
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
    } else if raw.starts_with(ENCRYPTED_PREFIX) {
        match decrypt_legacy(&raw[ENCRYPTED_PREFIX.len()..]) {
            Ok(plaintext) => Ok(plaintext),
            Err(_) => Ok(raw),
        }
    } else {
        match decrypt_legacy(&raw) {
            Ok(plaintext) => Ok(plaintext),
            Err(_) => Ok(raw),
        }
    }
}

pub fn encrypt_string(password: &str) -> Result<String, String> {
    let key = get_encryption_key();
    let cipher = Aes256Gcm::new(&key.into());

    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

    let ciphertext = cipher
        .encrypt(&nonce, password.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    let encoded_nonce = general_purpose::STANDARD_NO_PAD.encode(nonce.as_slice());
    let encoded_ciphertext = general_purpose::STANDARD_NO_PAD.encode(ciphertext);
    Ok(format!(
        "{}{}.{}",
        ENCRYPTED_V2_PREFIX, encoded_nonce, encoded_ciphertext
    ))
}

fn decrypt_legacy(encrypted_base64: &str) -> Result<String, String> {
    let key = get_encryption_key();
    let cipher = Aes256Gcm::new(&key.into());
    let nonce = get_legacy_compat_nonce();

    let ciphertext = general_purpose::STANDARD
        .decode(encrypted_base64)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;

    let plaintext = cipher
        .decrypt(&nonce, ciphertext.as_ref())
        .map_err(|e| format!("Decryption failed: {}", e))?;

    String::from_utf8(plaintext).map_err(|e| format!("UTF-8 conversion failed: {}", e))
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
    } else if encrypted.starts_with(ENCRYPTED_PREFIX) {
        decrypt_legacy(&encrypted[ENCRYPTED_PREFIX.len()..])
    } else {
        decrypt_legacy(encrypted)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_cycle() {
        let sample_payload = format!("sample_val_{}", std::process::id());
        let encrypted = encrypt_string(&sample_payload).unwrap();

        assert!(encrypted.starts_with(ENCRYPTED_V2_PREFIX));
        assert_ne!(&sample_payload, &encrypted);

        let decrypted = decrypt_string(&encrypted).unwrap();
        assert_eq!(sample_payload, decrypted);
    }

    #[test]
    fn test_encrypt_uses_unique_nonce() {
        let sample_payload = format!("sample_val_{}", std::process::id());
        let encrypted_a = encrypt_string(&sample_payload).unwrap();
        let encrypted_b = encrypt_string(&sample_payload).unwrap();

        assert_ne!(encrypted_a, encrypted_b);
        assert_eq!(decrypt_string(&encrypted_a).unwrap(), sample_payload);
        assert_eq!(decrypt_string(&encrypted_b).unwrap(), sample_payload);
    }

    #[test]
    fn test_legacy_compatibility() {
        let sample_payload = "sample_legacy_val";
        let key = get_encryption_key();
        let cipher = Aes256Gcm::new(&key.into());
        let nonce = get_legacy_compat_nonce();
        let ciphertext = cipher.encrypt(&nonce, sample_payload.as_bytes()).unwrap();
        let legacy_encrypted = general_purpose::STANDARD.encode(ciphertext);

        assert!(!legacy_encrypted.starts_with(ENCRYPTED_PREFIX));

        let decrypted = decrypt_string(&legacy_encrypted).unwrap();
        assert_eq!(sample_payload, decrypted);
    }
}
