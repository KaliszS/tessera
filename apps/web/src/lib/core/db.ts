import Dexie, { type EntityTable, type Table } from "dexie";
import type { Envelope, PackBundle } from "@tessera/engine";
import type { HostConfig } from "./relay";
import { randomId } from "./util";

export interface RoomRow {
  id: string;
  server: string;
  token: string;
  key: string;
  role: "host" | "player";
  seat: string | null;
  label: string;
  joinedAt: number;
  lastSeen: number;
  hostToken?: string;
  playerToken?: string;
  /** Cached summary for the room list, refreshed whenever the room is open. */
  packId?: string;
  seats?: Array<{ name: string; color: string | null; mine: boolean }>;
}

export interface EventRow {
  room: string;
  seq: number;
  id: string;
  dev: string;
  ts: number;
  env: Envelope | null;
  error?: string;
}

export interface OutboxRow {
  id: string;
  room: string;
  createdAt: number;
  env: Envelope;
}

export interface PackRow {
  hash: string;
  id: string;
  version: string;
  bundle: PackBundle;
  installedAt: number;
  source: "dev" | "import" | "room";
}

export interface KvRow {
  key: string;
  value: unknown;
}

export const db = new Dexie("tessera") as Dexie & {
  kv: EntityTable<KvRow, "key">;
  rooms: EntityTable<RoomRow, "id">;
  events: Table<EventRow, [string, number]>;
  outbox: EntityTable<OutboxRow, "id">;
  packs: EntityTable<PackRow, "hash">;
};

db.version(1).stores({
  kv: "key",
  rooms: "id, lastSeen",
  events: "[room+seq], room",
  outbox: "id, room, createdAt",
  packs: "hash, id",
});

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await db.kv.get(key))?.value as T | undefined;
}

export async function kvSet(key: string, value: unknown) {
  await db.kv.put({ key, value });
}

let deviceId: Promise<string> | null = null;
export function getDeviceId(): Promise<string> {
  deviceId ??= (async () => {
    const existing = await kvGet<string>("deviceId");
    if (existing) return existing;
    const id = randomId("dev", 16);
    await kvSet("deviceId", id);
    return id;
  })();
  return deviceId;
}

export const getHostConfig = () => kvGet<HostConfig>("host");
export const setHostConfig = (h: HostConfig | null) => (h ? kvSet("host", h) : db.kv.delete("host"));

export interface SettingsExport {
  format: "tessera-settings";
  version: 1;
  deviceId: string;
  host: HostConfig | null;
  rooms: RoomRow[];
  packs: PackRow[];
}

export async function exportSettings(includePacks: boolean): Promise<SettingsExport> {
  return {
    format: "tessera-settings",
    version: 1,
    deviceId: await getDeviceId(),
    host: (await getHostConfig()) ?? null,
    rooms: await db.rooms.toArray(),
    packs: includePacks ? await db.packs.toArray() : [],
  };
}

export async function importSettings(data: SettingsExport) {
  if (data.format !== "tessera-settings") throw new Error("not a Tessera settings file");
  await db.transaction("rw", [db.kv, db.rooms, db.packs], async () => {
    await kvSet("deviceId", data.deviceId);
    if (data.host) await kvSet("host", data.host);
    await db.rooms.bulkPut(data.rooms);
    await db.packs.bulkPut(data.packs);
  });
  deviceId = null;
}
