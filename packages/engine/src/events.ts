import { z } from "zod";

const seatId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
/** Longest player or seat name. */
export const NAME_MAX = 40;
const name = z.string().max(NAME_MAX);
const key = z.string().min(1).max(64);
const scalar = z.union([z.string().max(256), z.number(), z.null()]);

export const PackRef = z.strictObject({ id: z.string(), version: z.string(), hash: z.string() });
export type PackRef = z.infer<typeof PackRef>;

/** Generic, game-agnostic event vocabulary. Payloads arrive decrypted but untrusted. */
export const GameEvent = z.discriminatedUnion("t", [
  z.strictObject({
    t: z.literal("room.init"),
    schema: z.literal(1),
    pack: PackRef,
    label: z.string().max(128).optional(),
    modules: z.array(key).default([]),
    allow_guest_seats: z.boolean().default(true),
  }),
  z.strictObject({ t: z.literal("pack.attach"), bundle: z.unknown() }),
  /** Host moves the room to another version of the same pack; the whole log is then folded with it. */
  z.strictObject({ t: z.literal("pack.set"), pack: PackRef }),
  z.strictObject({
    t: z.literal("settings.set"),
    allow_guest_seats: z.boolean().optional(),
    host_assigns: z.boolean().optional(),
    label: z.string().max(128).optional(),
  }),
  z.strictObject({ t: z.literal("modules.set"), modules: z.array(key) }),
  /** Host limits a ref field to some values of one variant column; all values means no limit. */
  z.strictObject({ t: z.literal("variants.set"), field: key, column: key, values: z.array(z.string().max(64)).min(1) }),
  /** An empty name leaves the seat unnamed until its player introduces themselves. */
  z.strictObject({ t: z.literal("seat.add"), seat: seatId, name, color: z.string().max(16).optional() }),
  z.strictObject({ t: z.literal("seat.update"), seat: seatId, name: name.min(1).optional(), color: z.string().max(16).optional() }),
  z.strictObject({ t: z.literal("seat.remove"), seat: seatId }),
  z.strictObject({ t: z.literal("seat.order"), order: z.array(seatId) }),
  /** A seat invite's token lets its holder claim that seat even when only the host seats players; the relay stamps
   * the token's seat on the logged event. `link` is a legacy flag that older clients sent and the fold ignores. */
  z.strictObject({ t: z.literal("seat.claim"), seat: seatId, link: z.boolean().optional() }),
  z.strictObject({ t: z.literal("seat.assign"), seat: seatId, device: z.string().min(8).max(64).nullable() }),
  z.strictObject({ t: z.literal("member.hello"), name: name.min(1) }),
  z.strictObject({ t: z.literal("seat.release"), seat: seatId }),
  z.strictObject({ t: z.literal("track.set"), track: key, value: z.number() }),
  z.strictObject({ t: z.literal("field.set"), seat: seatId, field: key, value: scalar }),
  /** Several field values at once (e.g. a random draw of boards for every seat), applied all together or not at all. */
  z.strictObject({
    t: z.literal("fields.set"),
    changes: z.array(z.strictObject({ seat: seatId, field: key, value: scalar })).min(1).max(64),
  }),
  z.strictObject({ t: z.literal("counter.add"), seat: seatId, counter: key, delta: z.number() }),
  z.strictObject({ t: z.literal("counter.set"), seat: seatId, counter: key, value: z.number() }),
  z.strictObject({
    t: z.literal("zone.add"),
    seat: seatId,
    zone: key,
    item: key,
    entry: z.string().min(4).max(64),
    meta: z.record(key, scalar).optional(),
  }),
  z.strictObject({ t: z.literal("zone.remove"), seat: seatId, zone: key, entry: z.string() }),
  z.strictObject({ t: z.literal("adjust.set"), seat: seatId, category: key, value: z.number() }),
  z.strictObject({ t: z.literal("setup.roll"), section: key, picks: z.array(key) }),
  z.strictObject({ t: z.literal("setup.check"), section: key, done: z.boolean() }),
  z.strictObject({ t: z.literal("phase.set"), phase: z.enum(["lobby", "playing"]) }),
  z.strictObject({ t: z.literal("undo"), target: z.number().int().positive() }),
]);
export type GameEvent = z.infer<typeof GameEvent>;

/** Plaintext inside the encrypted envelope. `to` is reserved for device-private events. */
export const Envelope = z.strictObject({
  v: z.literal(1),
  e: GameEvent,
  to: z.string().optional(),
});
export type Envelope = z.infer<typeof Envelope>;

export interface LoggedEvent {
  seq: number;
  dev: string;
  ts: number;
  event: GameEvent;
  /** The seat the sender's token is bound to, as stamped by the relay (from the signed token). */
  seat?: string | null;
}
