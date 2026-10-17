import { Envelope, type GameEvent, type LoggedEvent } from "@tessera/engine";
import type { EventRecord, LockInfo, RejectReason, ServerMsg } from "@tessera/protocol";
import { open, seal } from "../core/crypto";
import { tokenClaims } from "../core/invite";
import { type EventRow, type OutboxRow, type RoomRow, db } from "../core/db";
import { wsUrl } from "../core/relay";
import { randomId } from "../core/util";
import { toasts } from "../ui/toast.svelte";

export type SyncStatus = "idle" | "connecting" | "syncing" | "online" | "offline" | "not_found" | "deleted";

/** Returns a reason to drop a queued event after the log moved on, or null to (re)send it. */
export type Revalidate = (env: Envelope, events: LoggedEvent[]) => string | null;

const PING_MS = 25_000;
const UNDECRYPTABLE = "cannot decrypt (wrong room key?)";
const PONG_TIMEOUT_MS = 8_000;

function toLogged(rows: EventRow[], device: string): LoggedEvent[] {
  return rows
    .filter((r) => r.env && (!r.env.to || r.env.to === device))
    .map((r) => ({ seq: r.seq, dev: r.dev, ts: r.ts, seat: r.seat ?? null, event: r.env!.e }));
}

export class RoomSync {
  status = $state<SyncStatus>("idle");
  events = $state.raw<LoggedEvent[]>([]);
  head = $state(0);
  serverHead = $state(0);
  pending = $state(0);
  lock = $state.raw<LockInfo | null>(null);
  lastError = $state<string | null>(null);

  private ws: WebSocket | null = null;
  private stopped = true;
  private retry = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private pongTimer: ReturnType<typeof setTimeout> | undefined;
  private inflight: OutboxRow | null = null;
  private chain: Promise<void> = Promise.resolve();
  revalidate: Revalidate | null = null;
  /** The seat this device's token is bound to; the relay stamps it on what we send, so our own copies carry it too. */
  readonly seat: string | null;

  constructor(
    readonly room: RoomRow,
    readonly device: string,
  ) {
    this.seat = tokenClaims(room.token)?.s ?? null;
  }

  async start() {
    if (!this.stopped) return;
    this.stopped = false;
    let rows = await db.events.where("room").equals(this.room.id).sortBy("seq");
    // Events an older app version could not read are fetched again, so an update heals the local log.
    // Ones that failed to decrypt would fail again, so they are left alone.
    const broken = rows.find((r) => r.error && r.error !== UNDECRYPTABLE)?.seq;
    if (broken !== undefined) {
      await db.events.where("[room+seq]").between([this.room.id, broken], [this.room.id, Infinity]).delete();
      rows = rows.filter((r) => r.seq < broken);
    }
    this.events = toLogged(rows, this.device);
    this.head = rows.at(-1)?.seq ?? 0;
    this.pending = await db.outbox.where("room").equals(this.room.id).count();
    addEventListener("visibilitychange", this.onWake);
    addEventListener("online", this.onWake);
    addEventListener("pageshow", this.onWake);
    this.connect();
  }

  stop() {
    this.stopped = true;
    removeEventListener("visibilitychange", this.onWake);
    removeEventListener("online", this.onWake);
    removeEventListener("pageshow", this.onWake);
    clearTimeout(this.retryTimer);
    this.clearTimers();
    this.ws?.close(1000);
    this.ws = null;
    this.status = "idle";
  }

  async submit(event: GameEvent, to?: string) {
    const env: Envelope = { v: 1, e: $state.snapshot(event) as GameEvent, ...(to ? { to } : {}) };
    const row: OutboxRow = { id: randomId("evt", 16), room: this.room.id, createdAt: Date.now(), env };
    await db.outbox.add(row);
    this.pending++;
    this.flush();
  }

  private notify(text: string, kind: "info" | "error" = "info") {
    toasts.show(text, kind);
  }

  private onWake = () => {
    if (this.stopped || document.visibilityState !== "visible") return;
    if (!this.ws || this.ws.readyState > WebSocket.OPEN) {
      this.retry = 0;
      clearTimeout(this.retryTimer);
      this.connect();
    } else if (this.ws.readyState === WebSocket.OPEN) {
      this.ping();
    }
  };

  private connect() {
    if (this.stopped || this.status === "deleted" || this.status === "not_found") return;
    this.clearTimers();
    this.status = "connecting";
    const ws = new WebSocket(wsUrl(this.room.server, this.room.id, this.room.token, this.device));
    this.ws = ws;
    ws.onmessage = (e) => {
      if (ws !== this.ws) return;
      const text = String(e.data);
      if (text === "pong") {
        clearTimeout(this.pongTimer);
        return;
      }
      let msg: ServerMsg;
      try {
        msg = JSON.parse(text);
      } catch {
        return;
      }
      this.enqueue(() => this.handle(msg));
    };
    ws.onclose = (e) => {
      if (ws !== this.ws) return;
      this.clearTimers();
      this.inflight = null;
      if (e.code === 4404) this.status = "not_found";
      else if (e.code === 4410) this.status = "deleted";
      else this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.stopped) return;
    this.status = "offline";
    const delay = Math.min(15_000, 500 * 2 ** this.retry++) * (0.75 + Math.random() * 0.5);
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }

  private clearTimers() {
    clearInterval(this.pingTimer);
    clearTimeout(this.pongTimer);
  }

  private ping() {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send("ping");
    clearTimeout(this.pongTimer);
    this.pongTimer = setTimeout(() => this.ws?.close(4000, "pong timeout"), PONG_TIMEOUT_MS);
  }

  private send(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private enqueue(task: () => Promise<void>) {
    this.chain = this.chain.then(task).catch((e) => {
      this.lastError = String(e);
      console.error(e);
    });
  }

  private async handle(msg: ServerMsg) {
    switch (msg.type) {
      case "welcome":
        this.retry = 0;
        this.serverHead = msg.head;
        this.lock = msg.lock;
        this.status = "syncing";
        this.pingTimer = setInterval(() => this.ping(), PING_MS);
        this.send({ type: "since", after: this.head });
        return;
      case "events":
        this.serverHead = msg.head;
        await this.ingest(msg.events);
        if (msg.more) {
          this.send({ type: "since", after: this.head });
        } else {
          this.status = "online";
          this.flush();
        }
        return;
      case "event":
        this.serverHead = Math.max(this.serverHead, msg.event.seq);
        if (msg.event.seq <= this.head) return;
        if (msg.event.seq === this.head + 1) await this.ingest([msg.event]);
        else this.send({ type: "since", after: this.head });
        return;
      case "ack":
        await this.acked(msg.id, msg.seq);
        return;
      case "reject":
        await this.rejected(msg.id, msg.reason);
        this.lock = msg.lock;
        return;
      case "lock":
        this.lock = msg.lock;
        if (!msg.lock) this.flush();
        return;
      case "lock_result":
        this.lock = msg.lock;
        return;
      case "deleted":
        this.status = "deleted";
        return;
      case "error":
        if (msg.code === "room_not_found") this.status = "not_found";
        else this.lastError = `${msg.code}: ${msg.message}`;
        return;
    }
  }

  private async ingest(records: EventRecord[]) {
    const rows: EventRow[] = [];
    for (const r of records) {
      if (r.seq <= this.head) continue;
      const row: EventRow = { room: this.room.id, seq: r.seq, id: r.id, dev: r.dev, ts: r.ts, seat: r.seat ?? null, env: null };
      try {
        const parsed = Envelope.safeParse(await open(this.room.key, this.room.id, r.data));
        if (parsed.success) row.env = parsed.data;
        else row.error = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      } catch {
        row.error = UNDECRYPTABLE;
      }
      rows.push(row);
      this.head = r.seq;
    }
    if (!rows.length) return;
    await db.events.bulkPut(rows);
    this.events = [...this.events, ...toLogged(rows, this.device)];
  }

  private async acked(id: string, seq: number) {
    const item = this.inflight?.id === id ? this.inflight : await db.outbox.get(id);
    this.inflight = null;
    await db.outbox.delete(id);
    this.pending = Math.max(0, this.pending - 1);
    if (item && seq === this.head + 1) {
      const row: EventRow = { room: this.room.id, seq, id, dev: this.device, ts: Date.now(), seat: this.seat, env: item.env };
      await db.events.put(row);
      this.head = seq;
      this.events = [...this.events, ...toLogged([row], this.device)];
    } else if (seq > this.head) {
      this.send({ type: "since", after: this.head });
    }
    this.flush();
  }

  private async rejected(id: string, reason: RejectReason) {
    this.inflight = null;
    if (reason === "stale") {
      this.status = "syncing";
      this.send({ type: "since", after: this.head });
      return;
    }
    if (reason === "locked") return;
    await db.outbox.delete(id);
    this.pending = Math.max(0, this.pending - 1);
    this.notify(`event dropped by relay: ${reason}`, "error");
    this.flush();
  }

  private flush() {
    this.enqueue(async () => {
      if (this.inflight || this.status !== "online" || this.ws?.readyState !== WebSocket.OPEN) return;
      if (this.lock && this.lock.device !== this.device && this.lock.expires > Date.now()) return;
      for (;;) {
        const next = await db.outbox.where("room").equals(this.room.id).sortBy("createdAt");
        const item = next[0];
        if (!item) return;
        const reason = this.revalidate?.(item.env, this.events) ?? null;
        if (reason) {
          await db.outbox.delete(item.id);
          this.pending = Math.max(0, this.pending - 1);
          this.notify(reason);
          continue;
        }
        this.inflight = item;
        const data = await seal(this.room.key, this.room.id, item.env);
        this.send({ type: "append", id: item.id, base: this.head, data });
        return;
      }
    });
  }

  requestLock(label: string, ttlMs: number) {
    this.send({ type: "lock", label, ttl_ms: ttlMs });
  }

  releaseLock(force = false) {
    this.send({ type: "unlock", force });
  }
}

/** Queues events for a room that is not open yet; they are sent when its session connects. */
export async function queueEvents(room: string, events: GameEvent[]) {
  const now = Date.now();
  await db.outbox.bulkAdd(
    events.map((e, i) => ({
      id: randomId("evt", 16),
      room,
      createdAt: now + i,
      env: { v: 1 as const, e: $state.snapshot(e) as GameEvent },
    })),
  );
}
