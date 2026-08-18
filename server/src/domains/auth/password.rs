use argon2::{
    Argon2, PasswordHash, PasswordHasher, PasswordVerifier, password_hash::SaltString,
    password_hash::rand_core::OsRng,
};

use crate::errors::AppError;

pub fn hash_password(password: &str) -> Result<String, AppError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|e| AppError::InternalServerError(format!("Password hashing failed: {e}")))
}

pub fn verify_password(password: &str, password_hash: &str) -> Result<bool, AppError> {
    let parsed_hash = PasswordHash::new(password_hash)
        .map_err(|e| AppError::InternalServerError(format!("Invalid hash format: {e}")))?;

    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_and_verify_success() {
        let password = "SuperSecretPassword123!";
        let hash = hash_password(password).expect("Hashing should succeed");

        // Verify correct password returns true
        let is_valid = verify_password(password, &hash).expect("Verification should succeed");
        assert!(is_valid);
    }

    #[test]
    fn test_verify_wrong_password() {
        let password = "SuperSecretPassword123!";
        let wrong_password = "WrongPassword123!";

        let hash = hash_password(password).expect("Hashing should succeed");

        // Verify wrong password returns false (not an Err)
        let is_valid = verify_password(wrong_password, &hash).expect("Verification should execute");
        assert!(!is_valid);
    }

    #[test]
    fn test_salt_uniqueness_for_same_password() {
        let password = "SamePassword123!";

        let hash1 = hash_password(password).expect("First hash failed");
        let hash2 = hash_password(password).expect("Second hash failed");

        // Random OsRng salting guarantees distinct string hashes
        assert_ne!(hash1, hash2);

        // Both distinct hashes must still successfully verify the password
        assert!(verify_password(password, &hash1).unwrap());
        assert!(verify_password(password, &hash2).unwrap());
    }

    #[test]
    fn test_phc_format_structure() {
        let password = "TestFormatPassword";
        let hash = hash_password(password).expect("Hashing failed");

        // Argon2id default outputs a string starting with $argon2id$v=19$
        assert!(hash.starts_with("$argon2id$v=19$"));
    }

    #[test]
    fn test_verify_invalid_hash_format() {
        let invalid_hash = "invalid_phc_hash_string";
        let result = verify_password("some_password", invalid_hash);

        // Should return an Err because PasswordHash::new fails to parse
        assert!(result.is_err());
    }
}
