// Language-agnostic conformance suite for a Tessera relay.
// RELAY_URL / RELAY_SECRET point it at any implementation (default: local wrangler dev).
import { afterAll, describe, expect, test } from "bun:test";
import type {
  AdminRoomsResponse,
  ClientMsg,
  CreateRoomResponse,
  MintTokenResponse,
  ServerMsg,
} from "@tessera/protocol";

const BASE = (process.env.RELAY_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const SECRET = process.env.RELAY_SECRET ?? "dev-secret";
const auth = { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" };

let counter = 0;
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36).padStart(4, "0")}`;

type Msg = ServerMsg | { type: "__raw"; text: string };

class Client {
  private queue: Msg[] = [];
  private waiters: Array<() => void> = [];
  closed: { code: number; reason: string } | null = null;
  constructor(readonly ws: WebSocket) {
    ws.addEventListener("message", (e) => {
      const text = String(e.data);
      let msg: Msg;
      try {
        msg = JSON.parse(text);
      } catch {
        msg = { type: "__raw", text };
      }
      this.queue.push(msg);
      this.waiters.splice(0).forEach((w) => w());
    });
    ws.addEventListener("close", (e) => {
      this.closed = { code: e.code, reason: e.reason };
      this.waiters.splice(0).forEach((w) => w());
    });
  }

  static open(room: string, token: string, device = uid("dev")): Promise<Client> {
    const url = `${BASE.replace(/^http/, "ws")}/rooms/${room}/ws?t=${encodeURIComponent(token)}&d=${device}`;
    const ws = new WebSocket(url);
    const client = new Client(ws);
    return new Promise((resolve, reject) => {
      ws.addEventListener("open", () => resolve(client), { once: true });
      ws.addEventListener("error", () => reject(new Error("websocket failed to open")), { once: true });
    });
  }

  send(msg: ClientMsg | string) {
    this.ws.send(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  async next<T extends Msg["type"]>(type: T, timeout = 3000): Promise<Extract<Msg, { type: T }>> {
    const deadline = Date.now() + timeout;
    for (;;) {
      const i = this.queue.findIndex((m) => m.type === type);
      if (i >= 0) return this.queue.splice(i, 1)[0] as Extract<Msg, { type: T }>;
      if (this.closed) throw new Error(`closed (${this.closed.code}) while waiting for ${type}`);
      const left = deadline - Date.now();
      if (left <= 0) throw new Error(`timeout waiting for ${type}; queue: ${JSON.stringify(this.queue)}`);
      await new Promise<void>((r) => {
        const t = setTimeout(r, left);
        this.waiters.push(() => {
          clearTimeout(t);
          r();
        });
      });
    }
  }

  async waitClosed(timeout = 3000) {
    const deadline = Date.now() + timeout;
    while (!this.closed && Date.now() < deadline) await Bun.sleep(20);
    return this.closed;
  }

  drain() {
    this.queue = [];
  }

  close() {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.close(1000);
  }
}

const open: Client[] = [];
const created: string[] = [];
const connect = async (room: string, token: string, device?: string) => {
  const c = await Client.open(room, token, device);
  open.push(c);
  return c;
};
afterAll(async () => {
  open.forEach((c) => c.close());
  await Promise.all(created.map((room) => fetch(`${BASE}/admin/rooms/${room}`, { method: "DELETE", headers: auth })));
});

async function createRoom(label?: string): Promise<CreateRoomResponse> {
  const res = await fetch(`${BASE}/rooms`, { method: "POST", headers: auth, body: JSON.stringify({ label }) });
  expect(res.status).toBe(201);
  const body = (await res.json()) as CreateRoomResponse;
  created.push(body.room);
  return body;
}

async function mint(room: string, body: object): Promise<string> {
  const res = await fetch(`${BASE}/rooms/${room}/tokens`, { method: "POST", headers: auth, body: JSON.stringify(body) });
  expect(res.status).toBe(200);
  return ((await res.json()) as MintTokenResponse).token;
}

describe("http api", () => {
  test("info endpoint reports protocol version", async () => {
    const res = await fetch(`${BASE}/`);
    expect(await res.json()).toEqual({ name: "tessera-relay", protocol: 1 });
  });

  test("room creation requires the host secret", async () => {
    const res = await fetch(`${BASE}/rooms`, { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
    const bad = await fetch(`${BASE}/rooms`, { method: "POST", headers: { Authorization: "Bearer nope" }, body: "{}" });
    expect(bad.status).toBe(401);
  });

  test("token check endpoint validates without opening a socket", async () => {
    const { room, player_token } = await createRoom();
    const ok = await fetch(`${BASE}/rooms/${room}/check?t=${encodeURIComponent(player_token)}`);
    expect(await ok.json()).toEqual({ ok: true, role: "player", seat: null });
    const bad = await fetch(`${BASE}/rooms/${room}/check?t=forged.token`);
    expect(bad.status).toBe(401);
    const other = await createRoom();
    const wrong = await fetch(`${BASE}/rooms/${other.room}/check?t=${encodeURIComponent(player_token)}`);
    expect(await wrong.json()).toEqual({ ok: false, reason: "wrongroom" });
  });

  test("expired tokens are refused", async () => {
    const { room } = await createRoom();
    const token = await mint(room, { role: "player", exp: Math.floor(Date.now() / 1000) - 10 });
    const res = await fetch(`${BASE}/rooms/${room}/check?t=${encodeURIComponent(token)}`);
    expect(await res.json()).toEqual({ ok: false, reason: "expired" });
  });

  test("websocket upgrade without a valid token is refused before the room", async () => {
    const { room } = await createRoom();
    await expect(Client.open(room, "forged.token")).rejects.toThrow();
  });
});

describe("event log", () => {
  test("welcome reports head, role and seat", async () => {
    const { room, host_token } = await createRoom();
    const host = await connect(room, host_token);
    expect(await host.next("welcome")).toMatchObject({ protocol: 1, head: 0, role: "host", seat: null, lock: null });
    const seatToken = await mint(room, { role: "player", seat: "p2" });
    const guest = await connect(room, seatToken);
    expect(await guest.next("welcome")).toMatchObject({ role: "player", seat: "p2" });
  });

  test("events carry the seat of the sender's token, live and when replayed", async () => {
    const { room, host_token } = await createRoom();
    const host = await connect(room, host_token);
    await host.next("welcome");
    const guest = await connect(room, await mint(room, { role: "player", seat: "p2" }));
    await guest.next("welcome");

    guest.send({ type: "append", id: uid("evt"), base: null, data: "Z3Vlc3Q" });
    expect((await host.next("event")).event).toMatchObject({ seq: 1, seat: "p2" });
    await guest.next("event");
    host.send({ type: "append", id: uid("evt"), base: 1, data: "aG9zdA" });
    expect((await guest.next("event")).event).toMatchObject({ seq: 2, seat: null });

    host.send({ type: "since", after: 0 });
    const page = await host.next("events");
    expect(page.events.map((e: { seat: string | null }) => e.seat)).toEqual(["p2", null]);
  });

  test("append assigns increasing seq, acks the sender and broadcasts to all", async () => {
    const { room, host_token, player_token } = await createRoom();
    const a = await connect(room, host_token);
    const b = await connect(room, player_token);
    await a.next("welcome");
    await b.next("welcome");

    const id1 = uid("evt");
    a.send({ type: "append", id: id1, base: null, data: "Y2lwaGVy" });
    expect(await a.next("ack")).toEqual({ type: "ack", id: id1, seq: 1, duplicate: false });
    const ev = await b.next("event");
    expect(ev.event).toMatchObject({ seq: 1, id: id1, data: "Y2lwaGVy" });
    expect((await a.next("event")).event.seq).toBe(1);

    const id2 = uid("evt");
    b.send({ type: "append", id: id2, base: 1, data: "c2Vjb25k" });
    expect(await b.next("ack")).toMatchObject({ id: id2, seq: 2 });
  });

  test("duplicate client_event_id is acked idempotently and not re-broadcast", async () => {
    const { room, host_token, player_token } = await createRoom();
    const a = await connect(room, host_token);
    const b = await connect(room, player_token);
    await a.next("welcome");
    await b.next("welcome");
    const id = uid("evt");
    a.send({ type: "append", id, base: null, data: "eA==" });
    await a.next("ack");
    await b.next("event");
    a.send({ type: "append", id, base: null, data: "eA==" });
    expect(await a.next("ack")).toEqual({ type: "ack", id, seq: 1, duplicate: true });
    await expect(b.next("event", 300)).rejects.toThrow(/timeout/);
  });

  test("stale base is rejected with the current head", async () => {
    const { room, host_token } = await createRoom();
    const a = await connect(room, host_token);
    await a.next("welcome");
    a.send({ type: "append", id: uid("evt"), base: 0, data: "eA==" });
    await a.next("ack");
    const id = uid("evt");
    a.send({ type: "append", id, base: 0, data: "eQ==" });
    expect(await a.next("reject")).toMatchObject({ id, reason: "stale", head: 1 });
  });

  test("invalid and oversized appends are rejected", async () => {
    const { room, host_token } = await createRoom();
    const a = await connect(room, host_token);
    await a.next("welcome");
    a.send({ type: "append", id: "bad", base: null, data: "eA==" });
    expect(await a.next("reject")).toMatchObject({ reason: "invalid" });
    const id = uid("evt");
    a.send({ type: "append", id, base: null, data: "x".repeat(768 * 1024 + 1) });
    expect(await a.next("reject")).toMatchObject({ id, reason: "too_large" });
  });

  test("since returns missed events after reconnect", async () => {
    const { room, host_token, player_token } = await createRoom();
    const a = await connect(room, host_token);
    await a.next("welcome");
    const b1 = await connect(room, player_token);
    await b1.next("welcome");
    a.send({ type: "append", id: uid("evt"), base: null, data: "MQ==" });
    await b1.next("event");
    b1.close();

    for (const d of ["Mg==", "Mw=="]) {
      a.send({ type: "append", id: uid("evt"), base: null, data: d });
      await a.next("ack");
    }
    const b2 = await connect(room, player_token);
    expect((await b2.next("welcome")).head).toBe(3);
    b2.send({ type: "since", after: 1 });
    const page = await b2.next("events");
    expect(page.more).toBe(false);
    expect(page.head).toBe(3);
    expect(page.events.map((e) => [e.seq, e.data])).toEqual([
      [2, "Mg=="],
      [3, "Mw=="],
    ]);
  });

  test("ping is answered with pong", async () => {
    const { room, player_token } = await createRoom();
    const a = await connect(room, player_token);
    await a.next("welcome");
    a.send("ping");
    expect(await a.next("__raw")).toEqual({ type: "__raw", text: "pong" });
  });

  test("malformed messages produce an error, not a disconnect", async () => {
    const { room, player_token } = await createRoom();
    const a = await connect(room, player_token);
    await a.next("welcome");
    a.send("{not json");
    expect(await a.next("error")).toMatchObject({ code: "bad_message" });
    a.send({ type: "since", after: 0 });
    expect(await a.next("events")).toMatchObject({ head: 0, events: [] });
  });
});

describe("locks", () => {
  test("lock blocks other devices until released; host can force", async () => {
    const { room, host_token, player_token } = await createRoom();
    const host = await connect(room, host_token);
    const a = await connect(room, player_token);
    const b = await connect(room, player_token);
    for (const c of [host, a, b]) await c.next("welcome");

    a.send({ type: "lock", label: "combat", ttl_ms: 60_000 });
    const granted = await a.next("lock_result");
    expect(granted.granted).toBe(true);
    expect((await b.next("lock")).lock).toMatchObject({ label: "combat" });

    const id = uid("evt");
    b.send({ type: "append", id, base: null, data: "eA==" });
    expect(await b.next("reject")).toMatchObject({ id, reason: "locked" });

    a.send({ type: "append", id: uid("evt"), base: null, data: "eQ==" });
    expect((await a.next("ack")).seq).toBe(1);

    b.send({ type: "lock", label: "steal", ttl_ms: 60_000 });
    expect(await b.next("lock_result")).toMatchObject({ granted: false });
    b.send({ type: "unlock", force: true });
    expect(await b.next("lock_result")).toMatchObject({ granted: false });

    host.drain();
    host.send({ type: "unlock", force: true });
    expect((await host.next("lock")).lock).toBeNull();
    b.send({ type: "append", id: uid("evt"), base: null, data: "eg==" });
    expect((await b.next("ack")).seq).toBe(2);
  });

  test("lock expires on its own", async () => {
    const { room, player_token } = await createRoom();
    const a = await connect(room, player_token);
    const b = await connect(room, player_token);
    await a.next("welcome");
    await b.next("welcome");
    a.send({ type: "lock", label: "short", ttl_ms: 200 });
    await a.next("lock_result");
    await Bun.sleep(300);
    b.send({ type: "append", id: uid("evt"), base: null, data: "eA==" });
    expect((await b.next("ack")).seq).toBe(1);
  });

  test("welcome includes an active lock", async () => {
    const { room, player_token } = await createRoom();
    const a = await connect(room, player_token);
    await a.next("welcome");
    a.send({ type: "lock", label: "setup", ttl_ms: 60_000 });
    await a.next("lock_result");
    const b = await connect(room, player_token);
    expect((await b.next("welcome")).lock).toMatchObject({ label: "setup" });
  });
});

describe("admin", () => {
  test("usage endpoint is host-only and reports whether analytics are configured", async () => {
    expect((await fetch(`${BASE}/admin/usage`)).status).toBe(401);
    const usage = await (await fetch(`${BASE}/admin/usage`, { headers: auth })).json();
    expect(["cloudflare", "local", "none"]).toContain(usage.source);
    expect(usage.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("lists rooms with stats and deletes them", async () => {
    const label = uid("label");
    const { room, host_token, player_token } = await createRoom(label);
    const a = await connect(room, host_token);
    await a.next("welcome");
    a.send({ type: "append", id: uid("evt"), base: null, data: "eA==" });
    await a.next("ack");

    const list = (await (await fetch(`${BASE}/admin/rooms`, { headers: auth })).json()) as AdminRoomsResponse;
    const entry = list.rooms.find((r) => r.room === room);
    expect(entry).toMatchObject({ label, head: 1, connections: 1 });
    expect(entry!.size_bytes).toBeGreaterThan(0);
    expect(list.total_bytes).toBeGreaterThanOrEqual(entry!.size_bytes);

    expect((await fetch(`${BASE}/admin/rooms`)).status).toBe(401);

    const del = await fetch(`${BASE}/admin/rooms/${room}`, { method: "DELETE", headers: auth });
    expect(del.status).toBe(200);
    await a.next("deleted");
    expect((await a.waitClosed())?.code).toBe(4410);

    const after = (await (await fetch(`${BASE}/admin/rooms`, { headers: auth })).json()) as AdminRoomsResponse;
    expect(after.rooms.find((r) => r.room === room)).toBeUndefined();

    const late = await connect(room, player_token);
    expect(await late.next("error")).toMatchObject({ code: "room_not_found" });
    expect((await late.waitClosed())?.code).toBe(4404);
  });
});
