use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[serde(rename_all = "snake_case")]
pub enum Role {
    Host,
    Player,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct EventRecord {
    pub seq: u32,
    pub id: String,
    pub data: String,
    #[cfg_attr(feature = "ts", ts(type = "number"))]
    pub ts: i64,
    pub dev: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct LockInfo {
    pub label: String,
    pub device: String,
    #[cfg_attr(feature = "ts", ts(type = "number"))]
    pub expires: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[serde(rename_all = "snake_case")]
pub enum RejectReason {
    Stale,
    Locked,
    TooLarge,
    Invalid,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMsg {
    Since {
        after: u32,
    },
    Append {
        id: String,
        #[serde(default)]
        base: Option<u32>,
        data: String,
    },
    Lock {
        label: String,
        #[cfg_attr(feature = "ts", ts(type = "number"))]
        ttl_ms: i64,
    },
    Unlock {
        #[serde(default)]
        force: bool,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMsg {
    Welcome {
        protocol: u32,
        head: u32,
        device: String,
        role: Role,
        seat: Option<String>,
        lock: Option<LockInfo>,
    },
    Events {
        events: Vec<EventRecord>,
        head: u32,
        more: bool,
    },
    Event {
        event: EventRecord,
    },
    Ack {
        id: String,
        seq: u32,
        duplicate: bool,
    },
    Reject {
        id: String,
        reason: RejectReason,
        head: u32,
        lock: Option<LockInfo>,
    },
    Lock {
        lock: Option<LockInfo>,
    },
    LockResult {
        granted: bool,
        lock: Option<LockInfo>,
    },
    Error {
        code: String,
        message: String,
    },
    Deleted {},
}

/// Attached to each hibernatable socket so identity survives DO eviction.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Session {
    pub device: String,
    pub role: Role,
    pub seat: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct CreateRoomRequest {
    #[serde(default)]
    pub label: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct CreateRoomResponse {
    pub room: String,
    pub host_token: String,
    pub player_token: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct MintTokenRequest {
    pub role: Role,
    #[serde(default)]
    pub seat: Option<String>,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(type = "number | null"))]
    pub exp: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct MintTokenResponse {
    pub token: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct RoomStats {
    pub room: String,
    pub label: Option<String>,
    #[cfg_attr(feature = "ts", ts(type = "number"))]
    pub created: i64,
    pub head: u32,
    #[cfg_attr(feature = "ts", ts(type = "number"))]
    pub size_bytes: i64,
    #[cfg_attr(feature = "ts", ts(type = "number | null"))]
    pub last_ts: Option<i64>,
    pub connections: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct AdminRoomsResponse {
    pub rooms: Vec<RoomStats>,
    #[cfg_attr(feature = "ts", ts(type = "number"))]
    pub total_bytes: i64,
    #[cfg_attr(feature = "ts", ts(type = "number"))]
    pub limit_bytes: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct UsageMetric {
    pub id: String,
    #[cfg_attr(feature = "ts", ts(type = "number | null"))]
    pub used: Option<f64>,
    #[cfg_attr(feature = "ts", ts(type = "number"))]
    pub limit: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct UsageResponse {
    /// "cloudflare" (official analytics), "local" (dev estimates) or "none".
    pub source: String,
    /// UTC day the counters belong to (limits reset at 00:00 UTC).
    pub day: String,
    pub metrics: Vec<UsageMetric>,
    pub errors: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn client_msg_wire_shape() {
        let m: ClientMsg =
            serde_json::from_value(json!({"type":"append","id":"evt_0001","data":"AA=="})).unwrap();
        assert_eq!(
            m,
            ClientMsg::Append {
                id: "evt_0001".into(),
                base: None,
                data: "AA==".into()
            }
        );
        let m: ClientMsg = serde_json::from_value(json!({"type":"unlock"})).unwrap();
        assert_eq!(m, ClientMsg::Unlock { force: false });
    }

    #[test]
    fn server_msg_wire_shape() {
        let v = serde_json::to_value(ServerMsg::Ack {
            id: "evt_0001".into(),
            seq: 3,
            duplicate: false,
        })
        .unwrap();
        assert_eq!(
            v,
            json!({"type":"ack","id":"evt_0001","seq":3,"duplicate":false})
        );
        let v = serde_json::to_value(ServerMsg::Deleted {}).unwrap();
        assert_eq!(v, json!({"type":"deleted"}));
    }
}
