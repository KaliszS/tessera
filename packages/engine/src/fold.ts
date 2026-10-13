import type { LoggedEvent, PackRef } from "./events";
import { catalogIndex } from "./pack";
import type { PackBundle } from "./schema";

export interface ZoneEntry {
  entry: string;
  item: string;
  meta: Record<string, string | number | null>;
  seq: number;
}

export interface SeatState {
  id: string;
  name: string;
  color: string | null;
  device: string | null;
  fields: Record<string, string | number | null>;
  counters: Record<string, number>;
  zones: Record<string, ZoneEntry[]>;
  adjust: Record<string, number>;
}

export interface LogEntry {
  seq: number;
  dev: string;
  ts: number;
  event: LoggedEvent["event"];
  status: "applied" | "reverted" | "rejected";
  reason?: string;
}

export interface GameState {
  initialized: boolean;
  pack: PackRef | null;
  host: string | null;
  label: string;
  modules: string[];
  allowGuestSeats: boolean;
  tracks: Record<string, number>;
  seats: SeatState[];
  setupRolls: Record<string, string[]>;
  log: LogEntry[];
  head: number;
}

const clamp = (v: number, min?: number, max?: number) =>
  Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, v));

export function emptyState(bundle: PackBundle | null): GameState {
  const tracks: Record<string, number> = {};
  for (const [k, t] of Object.entries(bundle?.game.tracks ?? {})) tracks[k] = t.initial;
  return {
    initialized: false,
    pack: null,
    host: null,
    label: "",
    modules: [],
    allowGuestSeats: true,
    tracks,
    seats: [],
    setupRolls: {},
    log: [],
    head: 0,
  };
}

function newSeat(bundle: PackBundle | null, id: string, name: string, color?: string): SeatState {
  const seat = bundle?.game.seat;
  return {
    id,
    name,
    color: color ?? null,
    device: null,
    fields: Object.fromEntries(Object.keys(seat?.fields ?? {}).map((k) => [k, null])),
    counters: Object.fromEntries(Object.entries(seat?.counters ?? {}).map(([k, c]) => [k, c.initial])),
    zones: Object.fromEntries(Object.keys(seat?.zones ?? {}).map((k) => [k, []])),
    adjust: {},
  };
}

/** Seqs neutralised by undo events; undoing an undo restores its target. */
export function revertedSeqs(events: LoggedEvent[]): Set<number> {
  const reverted = new Set<number>();
  for (let i = events.length - 1; i >= 0; i--) {
    const { seq, event } = events[i];
    if (event.t === "undo" && !reverted.has(seq) && event.target < seq) reverted.add(event.target);
  }
  return reverted;
}

/** state = fold(events). Deterministic; enforces room permissions, never game rules. */
export function fold(events: LoggedEvent[], bundle: PackBundle | null): GameState {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  const reverted = revertedSeqs(sorted);
  const state = emptyState(bundle);
  const catalogs = bundle ? catalogIndex(bundle) : {};
  const game = bundle?.game;

  for (const le of sorted) {
    state.head = Math.max(state.head, le.seq);
    const entry: LogEntry = { seq: le.seq, dev: le.dev, ts: le.ts, event: le.event, status: "applied" };
    state.log.push(entry);
    if (le.event.t === "undo") continue;
    if (reverted.has(le.seq)) {
      entry.status = "reverted";
      continue;
    }
    const reason = apply(state, le, bundle, catalogs);
    if (reason) {
      entry.status = "rejected";
      entry.reason = reason;
    }
  }
  if (game) {
    for (const seat of state.seats) {
      for (const k of Object.keys(game.seat.fields)) seat.fields[k] ??= null;
    }
  }
  return state;
}

function apply(
  s: GameState,
  { event: e, dev, seq }: LoggedEvent,
  bundle: PackBundle | null,
  catalogs: ReturnType<typeof catalogIndex>,
): string | undefined {
  const isHost = s.host === dev;
  const seat = "seat" in e && e.t !== "seat.add" ? s.seats.find((x) => x.id === e.seat) : undefined;
  const game = bundle?.game;

  if (e.t !== "room.init" && !s.initialized) return "room not initialised";

  switch (e.t) {
    case "room.init":
      if (s.initialized) return "already initialised";
      s.initialized = true;
      s.host = dev;
      s.pack = e.pack;
      s.label = e.label ?? "";
      s.modules = e.modules;
      s.allowGuestSeats = e.allow_guest_seats;
      return;
    case "pack.attach":
      return;
    case "settings.set":
      if (!isHost) return "host only";
      if (e.allow_guest_seats !== undefined) s.allowGuestSeats = e.allow_guest_seats;
      if (e.label !== undefined) s.label = e.label;
      return;
    case "modules.set":
      if (!isHost) return "host only";
      s.modules = e.modules;
      return;
    case "seat.add":
      if (!isHost && !s.allowGuestSeats) return "guests may not add seats";
      if (s.seats.some((x) => x.id === e.seat)) return "seat exists";
      if (game && s.seats.length >= game.players.max) return "table full";
      s.seats.push(newSeat(bundle, e.seat, e.name, e.color));
      if (!isHost) s.seats[s.seats.length - 1].device = dev;
      return;
    case "seat.order": {
      if (!isHost) return "host only";
      const byId = new Map(s.seats.map((x) => [x.id, x]));
      const ordered = e.order.map((id) => byId.get(id)).filter((x): x is SeatState => !!x);
      s.seats = [...ordered, ...s.seats.filter((x) => !e.order.includes(x.id))];
      return;
    }
  }

  if (e.t === "track.set") {
    const def = game?.tracks[e.track];
    if (!def) return "unknown track";
    s.tracks[e.track] = clamp(e.value, def.min, def.max);
    return;
  }
  if (e.t === "setup.roll") {
    s.setupRolls[e.section] = e.picks;
    return;
  }
  if (!seat) return "unknown seat";

  switch (e.t) {
    case "seat.update":
      if (seat.device && seat.device !== dev && !isHost) return "not your seat";
      if (e.name) seat.name = e.name;
      if (e.color) seat.color = e.color;
      return;
    case "seat.remove":
      if (!isHost) return "host only";
      s.seats = s.seats.filter((x) => x !== seat);
      return;
    case "seat.claim":
      if (seat.device && seat.device !== dev && !isHost) return "seat taken";
      seat.device = dev;
      return;
    case "seat.release":
      if (seat.device !== dev && !isHost) return "not your seat";
      seat.device = null;
      return;
    case "field.set": {
      const def = game?.seat.fields[e.field];
      if (!def) return "unknown field";
      if (def.type === "enum" && e.value !== null && !def.values?.includes(String(e.value))) return "invalid value";
      if (def.type === "ref" && e.value !== null && def.catalog && !catalogs[def.catalog]?.has(String(e.value)))
        return "unknown ref";
      seat.fields[e.field] = e.value;
      return;
    }
    case "counter.add":
    case "counter.set": {
      const def = game?.seat.counters[e.counter];
      if (!def) return "unknown counter";
      const next = e.t === "counter.add" ? (seat.counters[e.counter] ?? def.initial) + e.delta : e.value;
      seat.counters[e.counter] = clamp(next, def.min, def.max);
      return;
    }
    case "zone.add": {
      const def = game?.seat.zones[e.zone];
      if (!def) return "unknown zone";
      if (!catalogs[def.catalog]?.has(e.item)) return "unknown item";
      const zone = (seat.zones[e.zone] ??= []);
      if (def.unique && zone.some((z) => z.item === e.item)) return "already in zone";
      if (zone.some((z) => z.entry === e.entry)) return "duplicate entry";
      const meta: ZoneEntry["meta"] = {};
      for (const t of def.capture) meta[t] = s.tracks[t] ?? null;
      Object.assign(meta, e.meta ?? {});
      zone.push({ entry: e.entry, item: e.item, meta, seq });
      return;
    }
    case "zone.remove": {
      const zone = seat.zones[e.zone];
      const before = zone?.length ?? 0;
      if (zone) seat.zones[e.zone] = zone.filter((z) => z.entry !== e.entry);
      return before === (seat.zones[e.zone]?.length ?? 0) ? "no such entry" : undefined;
    }
    case "adjust.set":
      seat.adjust[e.category] = e.value;
      return;
  }
  return "unhandled event";
}
