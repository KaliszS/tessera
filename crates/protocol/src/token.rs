use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD as B64;
use hmac::{Hmac, KeyInit, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;

use crate::Role;

/// Room-scoped join token: `base64url(json claims) "." base64url(hmac_sha256)`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TokenClaims {
    #[serde(rename = "r")]
    pub room: String,
    pub role: Role,
    #[serde(rename = "s", default, skip_serializing_if = "Option::is_none")]
    pub seat: Option<String>,
    /// Expiry, unix seconds.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exp: Option<i64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TokenError {
    Malformed,
    BadSignature,
    Expired,
    WrongRoom,
}

fn mac(secret: &[u8], payload: &[u8]) -> Hmac<Sha256> {
    let mut m = Hmac::<Sha256>::new_from_slice(secret).expect("hmac accepts any key length");
    m.update(payload);
    m
}

pub fn sign_token(secret: &[u8], claims: &TokenClaims) -> String {
    let payload = B64.encode(serde_json::to_vec(claims).expect("claims serialize"));
    let sig = mac(secret, payload.as_bytes()).finalize().into_bytes();
    format!("{payload}.{}", B64.encode(sig))
}

pub fn verify_token(
    secret: &[u8],
    token: &str,
    room: &str,
    now_secs: i64,
) -> Result<TokenClaims, TokenError> {
    let (payload, sig) = token.split_once('.').ok_or(TokenError::Malformed)?;
    let sig = B64.decode(sig).map_err(|_| TokenError::Malformed)?;
    mac(secret, payload.as_bytes())
        .verify_slice(&sig)
        .map_err(|_| TokenError::BadSignature)?;
    let raw = B64.decode(payload).map_err(|_| TokenError::Malformed)?;
    let claims: TokenClaims = serde_json::from_slice(&raw).map_err(|_| TokenError::Malformed)?;
    if claims.room != room {
        return Err(TokenError::WrongRoom);
    }
    if claims.exp.is_some_and(|exp| exp <= now_secs) {
        return Err(TokenError::Expired);
    }
    Ok(claims)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn claims() -> TokenClaims {
        TokenClaims {
            room: "room_0001".into(),
            role: Role::Player,
            seat: Some("p2".into()),
            exp: Some(2_000),
        }
    }

    #[test]
    fn roundtrip() {
        let t = sign_token(b"secret", &claims());
        assert_eq!(
            verify_token(b"secret", &t, "room_0001", 1_000),
            Ok(claims())
        );
    }

    #[test]
    fn rejects_tampering_and_misuse() {
        let t = sign_token(b"secret", &claims());
        assert_eq!(
            verify_token(b"other", &t, "room_0001", 1_000),
            Err(TokenError::BadSignature)
        );
        assert_eq!(
            verify_token(b"secret", &t, "room_0002", 1_000),
            Err(TokenError::WrongRoom)
        );
        assert_eq!(
            verify_token(b"secret", &t, "room_0001", 2_000),
            Err(TokenError::Expired)
        );
        let forged = sign_token(
            b"secret",
            &TokenClaims {
                role: Role::Host,
                ..claims()
            },
        );
        let (forged_payload, _) = forged.split_once('.').unwrap();
        let (_, sig) = t.split_once('.').unwrap();
        assert_eq!(
            verify_token(
                b"secret",
                &format!("{forged_payload}.{sig}"),
                "room_0001",
                1_000
            ),
            Err(TokenError::BadSignature)
        );
        assert_eq!(
            verify_token(b"secret", "garbage", "room_0001", 1_000),
            Err(TokenError::Malformed)
        );
    }

    #[test]
    fn minimal_claims_omit_optional_fields() {
        let t = sign_token(
            b"k",
            &TokenClaims {
                room: "room_0001".into(),
                role: Role::Host,
                seat: None,
                exp: None,
            },
        );
        let payload = B64.decode(t.split_once('.').unwrap().0).unwrap();
        assert_eq!(
            String::from_utf8(payload).unwrap(),
            r#"{"r":"room_0001","role":"host"}"#
        );
    }
}
