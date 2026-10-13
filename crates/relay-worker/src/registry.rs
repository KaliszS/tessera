use serde::Deserialize;
use worker::*;

use crate::RoomInit;
use crate::metering::Metered;
use crate::util::json_response;

/// Singleton list of rooms created on this Worker, for the host admin panel.
#[durable_object]
pub struct Registry {
    db: Metered,
}

#[derive(Deserialize)]
struct RemoveReq {
    room: String,
}

impl DurableObject for Registry {
    fn new(state: State, env: Env) -> Self {
        Self {
            db: Metered::new(&state, &env),
        }
    }

    async fn fetch(&self, req: Request) -> Result<Response> {
        let path = req.url()?.path().to_string();
        match path.as_str() {
            "/usage" => return json_response(&self.db.today(), 200),
            "/hit" => self.db.worker_request(),
            _ => {
                self.db.event();
                self.db.request(1.0);
            }
        }
        let resp = self.route(req, &path).await;
        self.db.flush(|| true);
        resp
    }
}

impl Registry {
    async fn route(&self, mut req: Request, path: &str) -> Result<Response> {
        self.db.exec(
            "CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, label TEXT, created INTEGER NOT NULL)",
            vec![],
        )?;
        match path {
            "/hit" => Response::ok("ok"),
            "/add" => {
                let r: RoomInit = req.json().await?;
                self.db.exec(
                    "INSERT OR REPLACE INTO rooms (id, label, created) VALUES (?, ?, ?)",
                    vec![
                        r.room.into(),
                        r.label.map(Into::into).unwrap_or(SqlStorageValue::Null),
                        r.created.into(),
                    ],
                )?;
                Response::ok("ok")
            }
            "/remove" => {
                let r: RemoveReq = req.json().await?;
                self.db
                    .exec("DELETE FROM rooms WHERE id = ?", vec![r.room.into()])?;
                Response::ok("ok")
            }
            "/list" => {
                let rooms: Vec<RoomInit> = self.db.rows(
                    "SELECT id AS room, label, created FROM rooms ORDER BY created DESC",
                    vec![],
                )?;
                json_response(&rooms, 200)
            }
            _ => Response::error("not found", 404),
        }
    }
}
