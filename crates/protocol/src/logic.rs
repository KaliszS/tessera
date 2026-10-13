use crate::{
    LockInfo, MAX_DATA_LEN, MAX_LABEL_LEN, MAX_LOCK_TTL_MS, RejectReason, Role, is_valid_id,
};

pub fn active_lock(lock: Option<LockInfo>, now_ms: i64) -> Option<LockInfo> {
    lock.filter(|l| l.expires > now_ms)
}

/// Decides whether an append is accepted. Duplicate detection happens before this
/// (it needs storage), so `id` here is known to be new.
pub fn decide_append(
    id: &str,
    base: Option<u32>,
    data: &str,
    device: &str,
    head: u32,
    lock: Option<&LockInfo>,
) -> Result<(), RejectReason> {
    if !is_valid_id(id) || data.is_empty() {
        return Err(RejectReason::Invalid);
    }
    if data.len() > MAX_DATA_LEN {
        return Err(RejectReason::TooLarge);
    }
    if lock.is_some_and(|l| l.device != device) {
        return Err(RejectReason::Locked);
    }
    if base.is_some_and(|b| b != head) {
        return Err(RejectReason::Stale);
    }
    Ok(())
}

/// Returns the lock state after a lock request; `Ok` means granted.
pub fn decide_lock(
    current: Option<LockInfo>,
    label: &str,
    ttl_ms: i64,
    device: &str,
    now_ms: i64,
) -> Result<LockInfo, Option<LockInfo>> {
    let current = active_lock(current, now_ms);
    if label.len() > MAX_LABEL_LEN || ttl_ms <= 0 {
        return Err(current);
    }
    if let Some(l) = &current
        && l.device != device
    {
        return Err(current);
    }
    Ok(LockInfo {
        label: label.to_string(),
        device: device.to_string(),
        expires: now_ms + ttl_ms.min(MAX_LOCK_TTL_MS),
    })
}

/// Returns true when the requester may release the current lock.
pub fn may_unlock(current: Option<&LockInfo>, device: &str, role: Role, force: bool) -> bool {
    match current {
        None => true,
        Some(l) => l.device == device || (force && role == Role::Host),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lock(device: &str, expires: i64) -> LockInfo {
        LockInfo {
            label: "combat".into(),
            device: device.into(),
            expires,
        }
    }

    #[test]
    fn append_accepts_without_base_and_with_current_base() {
        assert_eq!(
            decide_append("evt_00001", None, "x", "dev_a", 5, None),
            Ok(())
        );
        assert_eq!(
            decide_append("evt_00001", Some(5), "x", "dev_a", 5, None),
            Ok(())
        );
    }

    #[test]
    fn append_rejects_stale_base() {
        assert_eq!(
            decide_append("evt_00001", Some(4), "x", "dev_a", 5, None),
            Err(RejectReason::Stale)
        );
    }

    #[test]
    fn append_respects_lock_holder() {
        let l = lock("dev_a", 10);
        assert_eq!(
            decide_append("evt_00001", None, "x", "dev_a", 0, Some(&l)),
            Ok(())
        );
        assert_eq!(
            decide_append("evt_00001", None, "x", "dev_b", 0, Some(&l)),
            Err(RejectReason::Locked)
        );
    }

    #[test]
    fn append_validates_input() {
        assert_eq!(
            decide_append("bad", None, "x", "dev_a", 0, None),
            Err(RejectReason::Invalid)
        );
        assert_eq!(
            decide_append("evt_00001", None, "", "dev_a", 0, None),
            Err(RejectReason::Invalid)
        );
        let big = "x".repeat(MAX_DATA_LEN + 1);
        assert_eq!(
            decide_append("evt_00001", None, &big, "dev_a", 0, None),
            Err(RejectReason::TooLarge)
        );
    }

    #[test]
    fn lock_grant_renew_deny_expire() {
        let granted = decide_lock(None, "combat", 1_000, "dev_a", 0).unwrap();
        assert_eq!(granted.expires, 1_000);
        let renewed = decide_lock(Some(granted.clone()), "combat", 1_000, "dev_a", 500).unwrap();
        assert_eq!(renewed.expires, 1_500);
        assert_eq!(
            decide_lock(Some(renewed.clone()), "x", 1_000, "dev_b", 600),
            Err(Some(renewed.clone()))
        );
        assert!(decide_lock(Some(renewed), "x", 1_000, "dev_b", 1_500).is_ok());
    }

    #[test]
    fn lock_ttl_is_capped() {
        let l = decide_lock(None, "x", i64::MAX / 2, "dev_a", 0).unwrap();
        assert_eq!(l.expires, MAX_LOCK_TTL_MS);
    }

    #[test]
    fn unlock_rules() {
        let l = lock("dev_a", 10);
        assert!(may_unlock(Some(&l), "dev_a", Role::Player, false));
        assert!(!may_unlock(Some(&l), "dev_b", Role::Player, true));
        assert!(!may_unlock(Some(&l), "dev_b", Role::Host, false));
        assert!(may_unlock(Some(&l), "dev_b", Role::Host, true));
    }
}
