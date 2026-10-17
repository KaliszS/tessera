import type { LoggedEvent, PackRef } from "./events";
import { catalogIndex, playerRange, trackStart, validModules } from "./pack";
import { parseSetupKey } from "./setup";
import type { GameDef, PackBundle, Row } from "./schema";

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
  /** Players may take free seats and add their own; otherwise only the host seats them (seat links still work). */
  allowGuestSeats: boolean;
  /** When set, only the host may set assignments (ref fields), even on players' own seats. */
  hostAssigns: boolean;
  /** Allowed variant values per ref field and column; a missing entry allows all. */
  variants: Record<string, Record<string, string[]>>;
  tracks: Record<string, number>;
  seats: SeatState[];
  setupRolls: Record<string, string[]>;
  setupChecked: Record<string, boolean>;
  /** Devices that introduced themselves (joined the room), by device id. */
  members: Record<string, { name: string }>;
  /** Lobby = the host prepares the game step by step; playing = the table is in play. */
  phase: "lobby" | "playing";
  log: LogEntry[];
  head: number;
}

const clamp = (v: number, min?: number, max?: number) =>
  Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, v));

export function emptyState(bundle: PackBundle | null): GameState {
  const tracks: Record<string, number> = {};
  for (const [k, t] of Object.entries(bundle?.game.tracks ?? {})) tracks[k] = trackStart(t);
  return {
    initialized: false,
    pack: null,
    host: null,
    label: "",
    modules: [],
    allowGuestSeats: true,
    hostAssigns: false,
    variants: {},
    tracks,
    seats: [],
    setupRolls: {},
    setupChecked: {},
    members: {},
    phase: "lobby",
    log: [],
    head: 0,
  };
}

/** Distinct values of a variant column, in catalog order. */
export function variantValues(bundle: PackBundle, catalog: string, column: string): string[] {
  return [...new Set((bundle.catalogs[catalog] ?? []).map((r) => String(r[column] ?? "")).filter(Boolean))];
}

/** Whether the host's variant choice for a ref field lets this catalog row in. */
export function variantAllowed(state: GameState, field: string, row: Row): boolean {
  return Object.entries(state.variants[field] ?? {}).every(([col, values]) => values.includes(String(row[col] ?? "")));
}

/** A seated player and their seat carry one name: the member's name wins when asked or when the seat has none,
 * else the seat's name becomes the member's. An unnamed seat and an unknown member stay unnamed. */
function shareName(s: GameState, seat: SeatState, memberWins: boolean) {
  const dev = seat.device;
  if (!dev || dev === s.host) return;
  const member = s.members[dev];
  if (member && (memberWins || !seat.name)) seat.name = member.name;
  else if (seat.name) s.members[dev] = { name: seat.name };
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
/** Assignments (boards, factions…) are chosen by the host, or by the seat's own player unless the host assigns. */
export const mayAssign = (s: GameState, dev: string, seat: SeatState) =>
  dev === s.host || (!s.hostAssigns && seat.device === dev);

/** Whether this device may add a seat now: the host, or anyone while players pick seats, below the table's maximum. */
export const mayAddSeat = (s: GameState, game: GameDef, dev: string) =>
  (dev === s.host || s.allowGuestSeats) && s.seats.length < playerRange(game, s.modules).max;

/** Why `dev` may not set this seat's field to `value`, or undefined when it may. */
function fieldRejection(
  s: GameState,
  game: GameDef | undefined,
  catalogs: ReturnType<typeof catalogIndex>,
  dev: string,
  seat: SeatState,
  field: string,
  value: string | number | null,
): string | undefined {
  const def = game?.seat.fields[field];
  if (!def) return "unknown field";
  if (def.type === "enum" && value !== null && !def.values?.includes(String(value))) return "invalid value";
  if (def.type !== "ref") return;
  if (value !== null && def.catalog && !catalogs[def.catalog]?.has(String(value))) return "unknown ref";
  // Assignments (boards, factions…) are chosen by the host or by the seat's own player.
  if (!mayAssign(s, dev, seat)) return "host only";
  if (dev !== s.host && value !== null && !variantAllowed(s, field, catalogs[def.catalog!].get(String(value))!)) return "variant off";
}

/** The pack the room uses: room.init's, or the host's latest pack.set for the same game that was not undone. */
export function packRef(events: LoggedEvent[]): PackRef | null {
  const init = events.find((e) => e.event.t === "room.init");
  if (!init || init.event.t !== "room.init") return null;
  const first = init.event.pack;
  const reverted = revertedSeqs(events);
  const set = events.findLast(
    (e) => e.event.t === "pack.set" && e.dev === init.dev && e.event.pack.id === first.id && !reverted.has(e.seq),
  );
  return set?.event.t === "pack.set" ? set.event.pack : first;
}

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
  { event: e, dev, seq, seat: tokenSeat }: LoggedEvent,
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
    case "pack.set":
      if (!isHost) return "host only";
      if (e.pack.id !== s.pack?.id) return "different game";
      s.pack = e.pack;
      return;
    case "settings.set":
      if (!isHost) return "host only";
      if (e.allow_guest_seats !== undefined) s.allowGuestSeats = e.allow_guest_seats;
      if (e.host_assigns !== undefined) s.hostAssigns = e.host_assigns;
      if (e.label !== undefined) s.label = e.label;
      return;
    case "modules.set":
      if (!isHost) return "host only";
      s.modules = game ? validModules(game, e.modules) : e.modules;
      return;
    case "variants.set": {
      if (!isHost) return "host only";
      const def = game?.seat.fields[e.field];
      if (!def?.catalog || !def.variants?.includes(e.column)) return "unknown variant";
      const all = variantValues(bundle!, def.catalog, e.column);
      const values = all.filter((v) => e.values.includes(v));
      if (!values.length) return "no variant left";
      const field = { ...s.variants[e.field] };
      if (values.length === all.length) delete field[e.column];
      else field[e.column] = values;
      s.variants = { ...s.variants, [e.field]: field };
      return;
    }
    case "seat.add": {
      if (!isHost && !s.allowGuestSeats) return "host seats players";
      if (s.seats.some((x) => x.id === e.seat)) return "seat exists";
      if (game && s.seats.length >= playerRange(game, s.modules).max) return "table full";
      const added = newSeat(bundle, e.seat, e.name, e.color);
      s.seats.push(added);
      if (!isHost) {
        added.device = dev;
        shareName(s, added, false);
      }
      return;
    }
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
  if (e.t === "setup.check") {
    // Anyone may tick off setup tasks, but only the host confirms the lobby's steps.
    if (parseSetupKey(e.section).step !== null && !isHost) return "host only";
    s.setupChecked[e.section] = e.done;
    return;
  }
  if (e.t === "member.hello") {
    s.members[dev] = { name: e.name };
    // One name per player: introducing yourself also names the seat you sit on.
    for (const x of s.seats) if (x.device === dev) shareName(s, x, true);
    return;
  }
  if (e.t === "phase.set") {
    if (!isHost) return "host only";
    if (e.phase === "playing" && game) {
      const range = playerRange(game, s.modules);
      if (s.seats.length < range.min) return "not enough players";
      if (s.seats.length > range.max) return "too many players";
    }
    s.phase = e.phase;
    return;
  }
  if (e.t === "fields.set") {
    const targets = e.changes.map((c) => s.seats.find((x) => x.id === c.seat));
    for (const [i, c] of e.changes.entries()) {
      const target = targets[i];
      if (!target) return "unknown seat";
      const why = fieldRejection(s, game, catalogs, dev, target, c.field, c.value);
      if (why) return why;
    }
    e.changes.forEach((c, i) => (targets[i]!.fields[c.field] = c.value));
    return;
  }
  if (!seat) return "unknown seat";

  switch (e.t) {
    case "seat.update":
      if (seat.device && seat.device !== dev && !isHost) return "not your seat";
      if (e.name) seat.name = e.name;
      if (e.color) seat.color = e.color;
      if (e.name) shareName(s, seat, false);
      return;
    case "seat.remove":
      if (!isHost) return "host only";
      s.seats = s.seats.filter((x) => x !== seat);
      return;
    case "seat.claim": {
      // A seat invite (its token bound to this seat) works even when only the host seats players.
      const invited = tokenSeat === seat.id;
      if (seat.device && seat.device !== dev && !isHost) return "seat taken";
      if (!isHost && !s.allowGuestSeats && !invited) return "host seats players";
      seat.device = dev;
      // An invite means the host named the seat for this player; picking a seat yourself brings your name to it.
      shareName(s, seat, !invited);
      return;
    }
    case "seat.assign":
      if (!isHost) return "host only";
      seat.device = e.device;
      shareName(s, seat, true);
      return;
    case "seat.release":
      if (seat.device !== dev && !isHost) return "not your seat";
      seat.device = null;
      return;
    case "field.set": {
      const why = fieldRejection(s, game, catalogs, dev, seat, e.field, e.value);
      if (why) return why;
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
