import { db } from "./db";
import { parseInvite, tokenClaims } from "./invite";
import { relay } from "./relay";

export type JoinResult = { ok: true; room: string } | { ok: false; reason: string };

/** Validates an invite with the relay and stores the room locally (keeping host credentials if present). */
export async function joinFromInvite(params: URLSearchParams): Promise<JoinResult> {
  const inv = parseInvite(params);
  if (!inv) return { ok: false, reason: "bad_link" };
  const check = await relay.check(inv.server, inv.room, inv.token);
  if (!check.ok) return { ok: false, reason: check.reason ?? "?" };
  const claims = tokenClaims(inv.token);
  const existing = await db.rooms.get(inv.room);
  const isHost = existing?.role === "host" || claims?.role === "host";
  await db.rooms.put({
    ...existing,
    id: inv.room,
    server: inv.server,
    token: existing?.role === "host" ? existing.token : inv.token,
    key: inv.key,
    role: isHost ? "host" : "player",
    seat: claims?.s ?? existing?.seat ?? null,
    label: existing?.label ?? "",
    joinedAt: existing?.joinedAt ?? Date.now(),
    lastSeen: Date.now(),
  });
  return { ok: true, room: inv.room };
}
