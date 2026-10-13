use protocol::{
    CreateRoomRequest, CreateRoomResponse, MAX_LABEL_LEN, MintTokenRequest, MintTokenResponse,
    PROTOCOL_VERSION, Role, TokenClaims, ct_eq, is_valid_id, is_valid_seat, sign_token,
    verify_token,
};
use serde::{Deserialize, Serialize};
use worker::*;

mod metering;
mod registry;
mod room;
mod usage;
mod util;

pub use registry::Registry;
pub use room::Room;
use util::{internal_post, json_response, now_ms, random_id};

#[derive(Serialize, Deserialize)]
pub(crate) struct RoomInit {
    pub room: String,
    pub label: Option<String>,
    pub created: i64,
}

#[event(fetch)]
async fn fetch(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    let origin = req.headers().get("Origin")?;
    if !origin_allowed(&env, origin.as_deref()) {
        return Response::error("origin not allowed", 403);
    }
    if req.method() == Method::Options {
        return with_cors(Response::empty()?.with_status(204), origin.as_deref());
    }
    if metering::enabled(&env) {
        let registry = env.durable_object("REGISTRY")?.get_by_name("registry")?;
        let _ = registry.fetch_with_str("https://registry/hit").await;
    }
    let is_upgrade = req.headers().get("Upgrade")?.as_deref() == Some("websocket");
    let resp = match route(req, &env).await {
        Ok(r) => r,
        Err(e) => Response::error(e.to_string(), 500)?,
    };
    if is_upgrade {
        Ok(resp)
    } else {
        with_cors(resp, origin.as_deref())
    }
}

async fn route(req: Request, env: &Env) -> Result<Response> {
    let url = req.url()?;
    let segs: Vec<String> = url
        .path_segments()
        .map(|s| s.filter(|p| !p.is_empty()).map(String::from).collect())
        .unwrap_or_default();
    let segs: Vec<&str> = segs.iter().map(String::as_str).collect();
    match (req.method(), segs.as_slice()) {
        (Method::Get, []) => json_response(
            &serde_json::json!({ "name": "tessera-relay", "protocol": PROTOCOL_VERSION }),
            200,
        ),
        (Method::Post, ["rooms"]) => match require_host(&req, env)? {
            Some(secret) => create_room(req, env, &secret).await,
            None => unauthorized(),
        },
        (Method::Post, ["rooms", room, "tokens"]) => match require_host(&req, env)? {
            Some(secret) => mint_token(req, room, &secret).await,
            None => unauthorized(),
        },
        (Method::Get, ["rooms", room, "check"]) => check_token(&url, room, env),
        (Method::Get, ["rooms", room, "ws"]) => connect(&req, &url, room, env).await,
        (Method::Get, ["admin", "rooms"]) => match require_host(&req, env)? {
            Some(_) => admin_rooms(env).await,
            None => unauthorized(),
        },
        (Method::Get, ["admin", "usage"]) => match require_host(&req, env)? {
            Some(_) => usage::usage(env).await,
            None => unauthorized(),
        },
        (Method::Delete, ["admin", "rooms", room]) => match require_host(&req, env)? {
            Some(_) => admin_delete(env, room).await,
            None => unauthorized(),
        },
        _ => Response::error("not found", 404),
    }
}

fn unauthorized() -> Result<Response> {
    Response::error("unauthorized", 401)
}

fn host_secret(env: &Env) -> Result<String> {
    env.secret("HOST_SECRET")
        .map(|s| s.to_string())
        .map_err(|_| Error::RustError("HOST_SECRET is not configured".into()))
}

fn require_host(req: &Request, env: &Env) -> Result<Option<String>> {
    let secret = host_secret(env)?;
    let given = req
        .headers()
        .get("Authorization")?
        .and_then(|h| h.strip_prefix("Bearer ").map(String::from))
        .unwrap_or_default();
    Ok(ct_eq(given.as_bytes(), secret.as_bytes()).then_some(secret))
}

fn origin_allowed(env: &Env, origin: Option<&str>) -> bool {
    let list = env
        .var("ALLOWED_ORIGINS")
        .map(|v| v.to_string())
        .unwrap_or_default();
    let list: Vec<&str> = list
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .collect();
    match origin {
        _ if list.is_empty() => true,
        None => true,
        Some(o) => list.contains(&o),
    }
}

fn with_cors(resp: Response, origin: Option<&str>) -> Result<Response> {
    let headers = Headers::new();
    for (k, v) in resp.headers().entries() {
        headers.set(&k, &v)?;
    }
    headers.set("Access-Control-Allow-Origin", origin.unwrap_or("*"))?;
    headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")?;
    headers.set(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type",
    )?;
    headers.set("Access-Control-Max-Age", "86400")?;
    headers.set("Vary", "Origin")?;
    Ok(resp.with_headers(headers))
}

async fn create_room(mut req: Request, env: &Env, secret: &str) -> Result<Response> {
    let body: CreateRoomRequest = req
        .json()
        .await
        .unwrap_or(CreateRoomRequest { label: None });
    let label = body.label.filter(|l| !l.is_empty());
    if label.as_ref().is_some_and(|l| l.len() > MAX_LABEL_LEN) {
        return Response::error("label too long", 400);
    }
    let init = RoomInit {
        room: random_id(16),
        label,
        created: now_ms(),
    };
    let rooms = env.durable_object("ROOMS")?;
    internal_post(&rooms.get_by_name(&init.room)?, "/init", &init).await?;
    let registry = env.durable_object("REGISTRY")?;
    internal_post(&registry.get_by_name("registry")?, "/add", &init).await?;

    let token = |role| {
        sign_token(
            secret.as_bytes(),
            &TokenClaims {
                room: init.room.clone(),
                role,
                seat: None,
                exp: None,
            },
        )
    };
    json_response(
        &CreateRoomResponse {
            host_token: token(Role::Host),
            player_token: token(Role::Player),
            room: init.room.clone(),
        },
        201,
    )
}

async fn mint_token(mut req: Request, room: &str, secret: &str) -> Result<Response> {
    let body: MintTokenRequest = match req.json().await {
        Ok(b) => b,
        Err(_) => return Response::error("invalid body", 400),
    };
    if !is_valid_id(room) || body.seat.as_deref().is_some_and(|s| !is_valid_seat(s)) {
        return Response::error("invalid room or seat", 400);
    }
    let token = sign_token(
        secret.as_bytes(),
        &TokenClaims {
            room: room.to_string(),
            role: body.role,
            seat: body.seat,
            exp: body.exp,
        },
    );
    json_response(&MintTokenResponse { token }, 200)
}

fn query(url: &Url, key: &str) -> Option<String> {
    url.query_pairs()
        .find(|(k, _)| k == key)
        .map(|(_, v)| v.into_owned())
}

fn authorize(url: &Url, room: &str, env: &Env) -> Result<std::result::Result<TokenClaims, String>> {
    let secret = host_secret(env)?;
    let token = query(url, "t").unwrap_or_default();
    Ok(
        verify_token(secret.as_bytes(), &token, room, now_ms() / 1000)
            .map_err(|e| format!("{e:?}").to_lowercase()),
    )
}

fn check_token(url: &Url, room: &str, env: &Env) -> Result<Response> {
    match authorize(url, room, env)? {
        Ok(c) => json_response(
            &serde_json::json!({ "ok": true, "role": c.role, "seat": c.seat }),
            200,
        ),
        Err(reason) => json_response(&serde_json::json!({ "ok": false, "reason": reason }), 401),
    }
}

async fn connect(req: &Request, url: &Url, room: &str, env: &Env) -> Result<Response> {
    if req.headers().get("Upgrade")?.as_deref() != Some("websocket") {
        return Response::error("expected websocket upgrade", 426);
    }
    let claims = match authorize(url, room, env)? {
        Ok(c) => c,
        Err(reason) => return Response::error(reason, 401),
    };
    let device = query(url, "d").unwrap_or_default();
    if !is_valid_id(&device) {
        return Response::error("invalid device id", 400);
    }
    let mut target = Url::parse("https://room/ws")?;
    target
        .query_pairs_mut()
        .append_pair("d", &device)
        .append_pair(
            "role",
            if claims.role == Role::Host {
                "host"
            } else {
                "player"
            },
        );
    if let Some(seat) = &claims.seat {
        target.query_pairs_mut().append_pair("seat", seat);
    }
    let headers = Headers::new();
    headers.set("Upgrade", "websocket")?;
    let mut init = RequestInit::new();
    init.with_method(Method::Get).with_headers(headers);
    let forwarded = Request::new_with_init(target.as_str(), &init)?;
    env.durable_object("ROOMS")?
        .get_by_name(room)?
        .fetch_with_request(forwarded)
        .await
}

async fn admin_rooms(env: &Env) -> Result<Response> {
    let registry = env.durable_object("REGISTRY")?.get_by_name("registry")?;
    let mut resp = registry.fetch_with_str("https://registry/list").await?;
    let listed: Vec<RoomInit> = resp.json().await?;
    let rooms_ns = env.durable_object("ROOMS")?;
    let mut rooms = Vec::with_capacity(listed.len());
    for r in listed {
        let mut stats = rooms_ns
            .get_by_name(&r.room)?
            .fetch_with_str("https://room/stats")
            .await?;
        if stats.status_code() == 200 {
            rooms.push(stats.json::<protocol::RoomStats>().await?);
        } else {
            rooms.push(protocol::RoomStats {
                room: r.room,
                label: r.label,
                created: r.created,
                head: 0,
                size_bytes: 0,
                last_ts: None,
                connections: 0,
            });
        }
    }
    let total_bytes = rooms.iter().map(|r| r.size_bytes).sum();
    json_response(
        &protocol::AdminRoomsResponse {
            rooms,
            total_bytes,
            limit_bytes: protocol::FREE_STORAGE_BYTES as i64,
        },
        200,
    )
}

async fn admin_delete(env: &Env, room: &str) -> Result<Response> {
    if !is_valid_id(room) {
        return Response::error("invalid room", 400);
    }
    let rooms = env.durable_object("ROOMS")?;
    internal_post(&rooms.get_by_name(room)?, "/delete", &()).await?;
    let registry = env.durable_object("REGISTRY")?;
    internal_post(
        &registry.get_by_name("registry")?,
        "/remove",
        &serde_json::json!({ "room": room }),
    )
    .await?;
    json_response(&serde_json::json!({ "ok": true }), 200)
}
