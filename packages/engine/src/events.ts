import { z } from "zod";

const seatId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
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
  z.strictObject({ t: z.literal("settings.set"), allow_guest_seats: z.boolean().optional(), label: z.string().max(128).optional() }),
  z.strictObject({ t: z.literal("modules.set"), modules: z.array(key) }),
  z.strictObject({ t: z.literal("seat.add"), seat: seatId, name: z.string().min(1).max(40), color: z.string().max(16).optional() }),
  z.strictObject({ t: z.literal("seat.update"), seat: seatId, name: z.string().min(1).max(40).optional(), color: z.string().max(16).optional() }),
  z.strictObject({ t: z.literal("seat.remove"), seat: seatId }),
  z.strictObject({ t: z.literal("seat.order"), order: z.array(seatId) }),
  z.strictObject({ t: z.literal("seat.claim"), seat: seatId }),
  z.strictObject({ t: z.literal("seat.release"), seat: seatId }),
  z.strictObject({ t: z.literal("track.set"), track: key, value: z.number() }),
  z.strictObject({ t: z.literal("field.set"), seat: seatId, field: key, value: scalar }),
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
}
