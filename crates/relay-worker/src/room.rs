use protocol::{
    ClientMsg, EventRecord, LockInfo, MAX_PAGE_BYTES, MAX_PAGE_EVENTS, PROTOCOL_VERSION, Role,
    RoomStats, ServerMsg, Session, active_lock, decide_append, decide_lock, is_valid_id,
    may_unlock,
};
use serde::Deserialize;
use worker::*;

use crate::RoomInit;
use crate::metering::Metered;
use crate::util::{json_response, now_ms};

const CLOSE_NOT_FOUND: u16 = 4404;
const CLOSE_DELETED: u16 = 4410;

/// One room = one append-only, opaque event log. Knows nothing about games.
#[durable_object]
pub struct Room {
    state: State,
    db: Metered,
}

#[derive(Deserialize)]
struct SeqRow {
    seq: Option<u32>,
}

#[derive(Deserialize)]
struct MetaRow {
    v: String,
}

#[derive(Deserialize)]
struct CountRow {
    n: u32,
}

#[derive(Deserialize)]
struct TsRow {
    ts: Option<i64>,
}

impl DurableObject for Room {
    fn new(state: State, env: Env) -> Self {
        if let Ok(pair) = worker::worker_sys::WebSocketRequestResponsePair::new("ping", "pong") {
            state.set_websocket_auto_response(&pair);
        }
        let db = Metered::new(&state, &env);
        Self { state, db }
    }

    async fn fetch(&self, req: Request) -> Result<Response> {
        let path = req.url()?.path().to_string();
        if path == "/usage" {
            return json_response(&self.db.today(), 200);
        }
        self.db.event();
        self.db.request(1.0);
        let resp = self.route(req).await;
        self.db
            .flush(|| path != "/delete" && self.exists().unwrap_or(false));
        resp
    }

    async fn websocket_message(
        &self,
        ws: WebSocket,
        message: WebSocketIncomingMessage,
    ) -> Result<()> {
        // Incoming WebSocket messages are billed 20:1 as requests.
        self.db.event();
        self.db.request(1.0 / 20.0);
        let result = self.on_message(ws, message);
        self.db.flush(|| true);
        result
    }

    async fn websocket_close(
        &self,
        ws: WebSocket,
        code: usize,
        reason: String,
        _was_clean: bool,
    ) -> Result<()> {
        let code = if code == 1005 || code == 1006 {
            1000
        } else {
            code as u16
        };
        let _ = ws.close(Some(code), Some(reason));
        Ok(())
    }

    async fn websocket_error(&self, ws: WebSocket, _error: Error) -> Result<()> {
        let _ = ws.close(Some(1011), Some("error"));
        Ok(())
    }
}

fn send(ws: &WebSocket, msg: &ServerMsg) -> Result<()> {
    ws.send_with_str(serde_json::to_string(msg)?)
}

fn error(code: &str, message: &str) -> ServerMsg {
    ServerMsg::Error {
        code: code.into(),
        message: message.into(),
    }
}

impl Room {
    async fn route(&self, mut req: Request) -> Result<Response> {
        let url = req.url()?;
        match url.path() {
            "/init" => {
                let init: RoomInit = req.json().await?;
                self.init(&init)?;
                Response::ok("ok")
            }
            "/ws" => self.accept(&url),
            "/stats" => self.stats(),
            "/delete" => self.delete().await,
            _ => Response::error("not found", 404),
        }
    }

    fn on_message(&self, ws: WebSocket, message: WebSocketIncomingMessage) -> Result<()> {
        let WebSocketIncomingMessage::String(text) = message else {
            return send(&ws, &error("binary_unsupported", "send JSON text frames"));
        };
        let Some(session) = ws.deserialize_attachment::<Session>()? else {
            return send(&ws, &error("no_session", "socket has no session"));
        };
        let msg: ClientMsg = match serde_json::from_str(&text) {
            Ok(m) => m,
            Err(e) => return send(&ws, &error("bad_message", &e.to_string())),
        };
        let result = match msg {
            ClientMsg::Since { after } => self.since(&ws, after),
            ClientMsg::Append { id, base, data } => self.append(&ws, &session, id, base, data),
            ClientMsg::Lock { label, ttl_ms } => self.lock(&ws, &session, &label, ttl_ms),
            ClientMsg::Unlock { force } => self.unlock(&ws, &session, force),
        };
        if let Err(e) = result {
            send(&ws, &error("internal", &e.to_string()))?;
        }
        Ok(())
    }

    fn exists(&self) -> Result<bool> {
        let row: CountRow = self.db.one(
            "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'events'",
            vec![],
        )?;
        Ok(row.n > 0)
    }

    fn init(&self, init: &RoomInit) -> Result<()> {
        self.db.exec(
            "CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)",
            vec![],
        )?;
        self.db.exec(
            "CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY, cid TEXT NOT NULL UNIQUE, data TEXT NOT NULL, ts INTEGER NOT NULL, dev TEXT NOT NULL)",
            vec![],
        )?;
        self.set_meta("room", &init.room)?;
        self.set_meta("created", &init.created.to_string())?;
        if let Some(label) = &init.label {
            self.set_meta("label", label)?;
        }
        Ok(())
    }

    fn meta(&self, k: &str) -> Result<Option<String>> {
        let rows: Vec<MetaRow> = self
            .db
            .rows("SELECT v FROM meta WHERE k = ?", vec![k.into()])?;
        Ok(rows.into_iter().next().map(|r| r.v))
    }

    fn set_meta(&self, k: &str, v: &str) -> Result<()> {
        self.db.exec(
            "INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)",
            vec![k.into(), v.into()],
        )
    }

    fn head(&self) -> Result<u32> {
        let row: SeqRow = self.db.one("SELECT max(seq) AS seq FROM events", vec![])?;
        Ok(row.seq.unwrap_or(0))
    }

    fn current_lock(&self) -> Result<Option<LockInfo>> {
        let lock = self
            .meta("lock")?
            .and_then(|v| serde_json::from_str::<LockInfo>(&v).ok());
        Ok(active_lock(lock, now_ms()))
    }

    fn broadcast(&self, msg: &ServerMsg) -> Result<()> {
        let text = serde_json::to_string(msg)?;
        for ws in self.state.get_websockets() {
            let _ = ws.send_with_str(&text);
        }
        Ok(())
    }

    fn accept(&self, url: &Url) -> Result<Response> {
        let param = |k: &str| {
            url.query_pairs()
                .find(|(key, _)| key == k)
                .map(|(_, v)| v.into_owned())
        };
        let session = Session {
            device: param("d").filter(|d| is_valid_id(d)).unwrap_or_default(),
            role: if param("role").as_deref() == Some("host") {
                Role::Host
            } else {
                Role::Player
            },
            seat: param("seat"),
        };
        let pair = WebSocketPair::new()?;
        let ws = pair.server;
        self.state.accept_web_socket(&ws);
        if !self.exists()? {
            send(&ws, &error("room_not_found", "room does not exist"))?;
            ws.close(Some(CLOSE_NOT_FOUND), Some("room not found"))?;
            return Response::from_websocket(pair.client);
        }
        ws.serialize_attachment(&session)?;
        send(
            &ws,
            &ServerMsg::Welcome {
                protocol: PROTOCOL_VERSION,
                head: self.head()?,
                device: session.device,
                role: session.role,
                seat: session.seat,
                lock: self.current_lock()?,
            },
        )?;
        Response::from_websocket(pair.client)
    }

    fn since(&self, ws: &WebSocket, after: u32) -> Result<()> {
        let rows: Vec<EventRecord> = self.db.rows(
            "SELECT seq, cid AS id, data, ts, dev FROM events WHERE seq > ? ORDER BY seq LIMIT ?",
            vec![(after as i64).into(), (MAX_PAGE_EVENTS as i64 + 1).into()],
        )?;
        let mut more = rows.len() > MAX_PAGE_EVENTS;
        let mut events = Vec::new();
        let mut bytes = 0;
        for row in rows.into_iter().take(MAX_PAGE_EVENTS) {
            bytes += row.data.len() + 96;
            if bytes > MAX_PAGE_BYTES && !events.is_empty() {
                more = true;
                break;
            }
            events.push(row);
        }
        send(
            ws,
            &ServerMsg::Events {
                events,
                head: self.head()?,
                more,
            },
        )
    }

    fn append(
        &self,
        ws: &WebSocket,
        session: &Session,
        id: String,
        base: Option<u32>,
        data: String,
    ) -> Result<()> {
        let dup: Vec<SeqRow> = self.db.rows(
            "SELECT seq FROM events WHERE cid = ?",
            vec![id.as_str().into()],
        )?;
        if let Some(seq) = dup.into_iter().next().and_then(|r| r.seq) {
            return send(
                ws,
                &ServerMsg::Ack {
                    id,
                    seq,
                    duplicate: true,
                },
            );
        }
        let head = self.head()?;
        let lock = self.current_lock()?;
        if let Err(reason) = decide_append(&id, base, &data, &session.device, head, lock.as_ref()) {
            return send(
                ws,
                &ServerMsg::Reject {
                    id,
                    reason,
                    head,
                    lock,
                },
            );
        }
        let ts = now_ms();
        let row: SeqRow = self.db.one(
            "INSERT INTO events (cid, data, ts, dev) VALUES (?, ?, ?, ?) RETURNING seq",
            vec![
                id.as_str().into(),
                data.as_str().into(),
                ts.into(),
                session.device.as_str().into(),
            ],
        )?;
        let seq = row.seq.unwrap_or(head + 1);
        send(
            ws,
            &ServerMsg::Ack {
                id: id.clone(),
                seq,
                duplicate: false,
            },
        )?;
        self.broadcast(&ServerMsg::Event {
            event: EventRecord {
                seq,
                id,
                data,
                ts,
                dev: session.device.clone(),
            },
        })
    }

    fn lock(&self, ws: &WebSocket, session: &Session, label: &str, ttl_ms: i64) -> Result<()> {
        match decide_lock(
            self.current_lock()?,
            label,
            ttl_ms,
            &session.device,
            now_ms(),
        ) {
            Ok(lock) => {
                self.set_meta("lock", &serde_json::to_string(&lock)?)?;
                send(
                    ws,
                    &ServerMsg::LockResult {
                        granted: true,
                        lock: Some(lock.clone()),
                    },
                )?;
                self.broadcast(&ServerMsg::Lock { lock: Some(lock) })
            }
            Err(lock) => send(
                ws,
                &ServerMsg::LockResult {
                    granted: false,
                    lock,
                },
            ),
        }
    }

    fn unlock(&self, ws: &WebSocket, session: &Session, force: bool) -> Result<()> {
        let current = self.current_lock()?;
        if !may_unlock(current.as_ref(), &session.device, session.role, force) {
            return send(
                ws,
                &ServerMsg::LockResult {
                    granted: false,
                    lock: current,
                },
            );
        }
        if current.is_some() {
            self.db.exec("DELETE FROM meta WHERE k = 'lock'", vec![])?;
            self.broadcast(&ServerMsg::Lock { lock: None })?;
        }
        Ok(())
    }

    fn stats(&self) -> Result<Response> {
        if !self.exists()? {
            return Response::error("not found", 404);
        }
        let last: TsRow = self.db.one("SELECT max(ts) AS ts FROM events", vec![])?;
        json_response(
            &RoomStats {
                room: self.meta("room")?.unwrap_or_default(),
                label: self.meta("label")?,
                created: self
                    .meta("created")?
                    .and_then(|c| c.parse().ok())
                    .unwrap_or(0),
                head: self.head()?,
                size_bytes: self.db.database_size() as i64,
                last_ts: last.ts,
                connections: self.state.get_websockets().len() as u32,
            },
            200,
        )
    }

    async fn delete(&self) -> Result<Response> {
        let _ = self.broadcast(&ServerMsg::Deleted {});
        for ws in self.state.get_websockets() {
            let _ = ws.close(Some(CLOSE_DELETED), Some("room deleted"));
        }
        self.state.storage().delete_all().await?;
        Response::ok("ok")
    }
}
