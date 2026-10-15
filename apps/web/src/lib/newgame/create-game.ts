import type { PackBundle } from "@tessera/engine";
import { generateRoomKey } from "../core/crypto";
import { db } from "../core/db";
import { type HostConfig, relay } from "../core/relay";
import { queueEvents } from "../sync/sync.svelte";

/** Creates the room on the relay, stores it locally and queues the opening events. Seats are added in the room. */
export async function createGame(host: HostConfig, bundle: PackBundle, label: string): Promise<string> {
  const res = await relay.createRoom(host, label);
  await db.rooms.put({
    id: res.room,
    server: host.server,
    token: res.host_token,
    key: generateRoomKey(),
    role: "host",
    seat: null,
    label,
    joinedAt: Date.now(),
    lastSeen: Date.now(),
    hostToken: res.host_token,
    playerToken: res.player_token,
    packId: bundle.id,
  });
  await queueEvents(res.room, [
    {
      t: "room.init",
      schema: 1,
      pack: { id: bundle.id, version: bundle.version, hash: bundle.hash },
      label,
      modules: bundle.game.modules.filter((m) => m.default).map((m) => m.id),
      allow_guest_seats: true,
    },
    { t: "pack.attach", bundle },
  ]);
  return res.room;
}
