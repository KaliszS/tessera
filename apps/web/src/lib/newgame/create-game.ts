import type { GameEvent, PackBundle } from "@tessera/engine";
import { generateRoomKey } from "../core/crypto";
import { db } from "../core/db";
import { type HostConfig, relay } from "../core/relay";
import { queueEvents } from "../sync/sync.svelte";

export const SEAT_COLORS = ["#e53935", "#1e88e5", "#43a047", "#fdd835", "#8e24aa", "#fb8c00", "#00acc1", "#6d4c41"];

export interface NewGame {
  bundle: PackBundle;
  label: string;
  modules: string[];
  seats: string[];
  /** Index of the host's own seat, or -1 when the host does not play. */
  me: number;
  allowGuests: boolean;
}

/** Creates the room on the relay, stores it locally and queues the opening events. Returns the room id. */
export async function createGame(host: HostConfig, g: NewGame): Promise<string> {
  const res = await relay.createRoom(host, g.label);
  await db.rooms.put({
    id: res.room,
    server: host.server,
    token: res.host_token,
    key: generateRoomKey(),
    role: "host",
    seat: null,
    label: g.label,
    joinedAt: Date.now(),
    lastSeen: Date.now(),
    hostToken: res.host_token,
    playerToken: res.player_token,
  });
  const b = g.bundle;
  const seatIds = g.seats.map((_, i) => `p${i + 1}`);
  const events: GameEvent[] = [
    {
      t: "room.init",
      schema: 1,
      pack: { id: b.id, version: b.version, hash: b.hash },
      label: g.label,
      modules: g.modules,
      allow_guest_seats: g.allowGuests,
    },
    { t: "pack.attach", bundle: b },
    ...g.seats.map((name, i): GameEvent => ({ t: "seat.add", seat: seatIds[i], name, color: SEAT_COLORS[i % SEAT_COLORS.length] })),
  ];
  if (g.me >= 0 && seatIds[g.me]) events.push({ t: "seat.claim", seat: seatIds[g.me] });
  await queueEvents(res.room, events);
  return res.room;
}
