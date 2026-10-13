//! Tessera relay protocol: wire messages, room tokens and pure relay decisions.
//! No I/O lives here so both the Worker and tests can share it.

mod logic;
mod messages;
mod token;

pub use logic::*;
pub use messages::*;
pub use token::*;

pub const PROTOCOL_VERSION: u32 = 1;

pub const MAX_DATA_LEN: usize = 768 * 1024;
pub const MAX_PAGE_BYTES: usize = 512 * 1024;
pub const MAX_PAGE_EVENTS: usize = 500;
pub const MAX_LOCK_TTL_MS: i64 = 15 * 60 * 1000;
pub const MAX_LABEL_LEN: usize = 128;

/// Daily allowances of the Cloudflare Workers free plan (defaults until plan detection exists).
pub const FREE_WORKER_REQUESTS: f64 = 100_000.0;
pub const FREE_DO_REQUESTS: f64 = 100_000.0;
pub const FREE_DO_DURATION_GBS: f64 = 13_000.0;
pub const FREE_ROWS_READ: f64 = 5_000_000.0;
pub const FREE_ROWS_WRITTEN: f64 = 100_000.0;
pub const FREE_STORAGE_BYTES: f64 = 5_000_000_000.0;
/// Durable Objects are billed as if they used 128 MB (0.125 GB) while active.
pub const DO_MEMORY_GB: f64 = 0.125;

pub fn is_valid_id(s: &str) -> bool {
    (8..=64).contains(&s.len())
        && s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

pub fn is_valid_seat(s: &str) -> bool {
    (1..=64).contains(&s.len())
        && s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

/// Constant-time byte comparison for secrets.
pub fn ct_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn id_validation() {
        assert!(is_valid_id("abcDEF12"));
        assert!(is_valid_id("room_01-xyz"));
        assert!(!is_valid_id("short"));
        assert!(!is_valid_id("has space here"));
        assert!(!is_valid_id(&"x".repeat(65)));
        assert!(is_valid_seat("p1"));
        assert!(!is_valid_seat(""));
    }

    #[test]
    fn constant_time_eq() {
        assert!(ct_eq(b"secret", b"secret"));
        assert!(!ct_eq(b"secret", b"secreT"));
        assert!(!ct_eq(b"secret", b"secrets"));
    }
}
