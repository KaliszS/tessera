//! Local-only usage estimates. Enabled by TESSERA_DEV_USAGE=1 in the local .env, which never
//! reaches Cloudflare; in production these counters stay off and real analytics are used.

use std::cell::Cell;

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use worker::*;

use crate::util::today_utc;

pub const FLAG: &str = "TESSERA_DEV_USAGE";

/// Roughly how long an idle object with hibernatable sockets stays in memory before eviction.
const IDLE_SECS: f64 = 10.0;

pub fn enabled(env: &Env) -> bool {
    let read = |k: &str| {
        env.var(k)
            .map(|v| v.to_string())
            .or_else(|_| env.secret(k).map(|v| v.to_string()))
            .unwrap_or_default()
    };
    read(FLAG).trim() == "1"
}

#[derive(Debug, Default, Clone, Copy, Serialize, Deserialize)]
pub struct Counts {
    pub worker_requests: f64,
    pub requests: f64,
    pub rows_read: f64,
    pub rows_written: f64,
    /// Estimated seconds the object stayed in memory (billed duration).
    pub active_secs: f64,
}

impl Counts {
    pub fn add(&mut self, o: Counts) {
        self.worker_requests += o.worker_requests;
        self.requests += o.requests;
        self.rows_read += o.rows_read;
        self.rows_written += o.rows_written;
        self.active_secs += o.active_secs;
    }
}

/// SQL access that tallies billed rows, plus request counters, for one Durable Object.
pub struct Metered {
    sql: SqlStorage,
    enabled: bool,
    pending: Cell<Counts>,
    last_event_ms: Cell<Option<i64>>,
}

impl Metered {
    pub fn new(state: &State, env: &Env) -> Self {
        Self {
            sql: state.storage().sql(),
            enabled: enabled(env),
            pending: Cell::new(Counts::default()),
            last_event_ms: Cell::new(None),
        }
    }

    fn bump(&self, f: impl FnOnce(&mut Counts)) {
        if self.enabled {
            let mut c = self.pending.get();
            f(&mut c);
            self.pending.set(c);
        }
    }

    pub fn request(&self, weight: f64) {
        self.bump(|c| c.requests += weight);
    }

    /// Call on every request or message: the object is billed for the time between events,
    /// capped at the idle period after which it would hibernate. A fresh instance assumes the
    /// previous episode ran one full idle period.
    pub fn event(&self) {
        let now = crate::util::now_ms();
        let secs = match self.last_event_ms.replace(Some(now)) {
            Some(last) => ((now - last).max(0) as f64 / 1000.0).min(IDLE_SECS),
            None => IDLE_SECS,
        };
        self.bump(|c| c.active_secs += secs);
    }

    pub fn worker_request(&self) {
        self.bump(|c| c.worker_requests += 1.0);
    }

    pub fn rows<T: DeserializeOwned>(
        &self,
        query: &str,
        bindings: Vec<SqlStorageValue>,
    ) -> Result<Vec<T>> {
        let cursor = self.sql.exec(query, bindings)?;
        let rows = cursor.to_array()?;
        let (r, w) = (cursor.rows_read() as f64, cursor.rows_written() as f64);
        self.bump(|c| {
            c.rows_read += r;
            c.rows_written += w;
        });
        Ok(rows)
    }

    pub fn one<T: DeserializeOwned>(
        &self,
        query: &str,
        bindings: Vec<SqlStorageValue>,
    ) -> Result<T> {
        self.rows(query, bindings)?
            .into_iter()
            .next()
            .ok_or_else(|| Error::RustError("query returned no rows".into()))
    }

    pub fn exec(&self, query: &str, bindings: Vec<SqlStorageValue>) -> Result<()> {
        self.rows::<serde_json::Value>(query, bindings).map(|_| ())
    }

    pub fn database_size(&self) -> usize {
        self.sql.database_size()
    }

    /// Persists pending counts (untracked). `persist` is evaluated only when metering is on,
    /// so production pays nothing; it returns false when the object must stay empty.
    pub fn flush(&self, persist: impl FnOnce() -> bool) {
        let c = self.pending.replace(Counts::default());
        if !self.enabled || !persist() {
            return;
        }
        let _ = self.sql.exec(
            "CREATE TABLE IF NOT EXISTS _usage (day TEXT PRIMARY KEY, worker_requests REAL NOT NULL, requests REAL NOT NULL, rows_read REAL NOT NULL, rows_written REAL NOT NULL, active_secs REAL NOT NULL DEFAULT 0)",
            None,
        );
        // Tables created before active time was tracked lack this column; the error is expected later.
        let _ = self.sql.exec(
            "ALTER TABLE _usage ADD COLUMN active_secs REAL NOT NULL DEFAULT 0",
            None,
        );
        let _ = self.sql.exec(
            "INSERT INTO _usage VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(day) DO UPDATE SET worker_requests = worker_requests + excluded.worker_requests, requests = requests + excluded.requests, rows_read = rows_read + excluded.rows_read, rows_written = rows_written + excluded.rows_written, active_secs = active_secs + excluded.active_secs",
            vec![
                today_utc().into(),
                c.worker_requests.into(),
                c.requests.into(),
                c.rows_read.into(),
                c.rows_written.into(),
                c.active_secs.into(),
            ],
        );
    }

    pub fn today(&self) -> Counts {
        self.sql
            .exec(
                "SELECT worker_requests, requests, rows_read, rows_written, active_secs FROM _usage WHERE day = ?",
                vec![today_utc().into()],
            )
            .and_then(|c| c.to_array::<Counts>())
            .ok()
            .and_then(|v| v.into_iter().next())
            .unwrap_or_default()
    }
}
