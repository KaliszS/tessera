import type {
  AdminRoomsResponse,
  CreateRoomResponse,
  MintTokenRequest,
  MintTokenResponse,
  UsageResponse,
} from "@tessera/protocol";

export interface HostConfig {
  server: string;
  secret: string;
}

export class RelayError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const base = (server: string) => server.replace(/\/+$/, "");

async function call<T>(server: string, path: string, init: RequestInit = {}, secret?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers.Authorization = `Bearer ${secret}`;
  let res: Response;
  try {
    res = await fetch(`${base(server)}${path}`, { ...init, headers });
  } catch (e) {
    throw new RelayError(0, `network: ${(e as Error).message}`);
  }
  const text = await res.text();
  if (!res.ok) throw new RelayError(res.status, text || res.statusText);
  return JSON.parse(text) as T;
}

export const relay = {
  info: (server: string) => call<{ name: string; protocol: number }>(server, "/"),
  createRoom: (h: HostConfig, label?: string) =>
    call<CreateRoomResponse>(h.server, "/rooms", { method: "POST", body: JSON.stringify({ label }) }, h.secret),
  mintToken: (h: HostConfig, room: string, req: MintTokenRequest) =>
    call<MintTokenResponse>(h.server, `/rooms/${room}/tokens`, { method: "POST", body: JSON.stringify(req) }, h.secret),
  check: (server: string, room: string, token: string) =>
    call<{ ok: boolean; role?: string; seat?: string | null; reason?: string }>(
      server,
      `/rooms/${room}/check?t=${encodeURIComponent(token)}`,
    ).catch((e: RelayError) => ({ ok: false, reason: e.status === 401 ? "invalid token" : e.message })),
  adminRooms: (h: HostConfig) => call<AdminRoomsResponse>(h.server, "/admin/rooms", {}, h.secret),
  adminUsage: (h: HostConfig) => call<UsageResponse>(h.server, "/admin/usage", {}, h.secret),
  adminDelete: (h: HostConfig, room: string) =>
    call<{ ok: boolean }>(h.server, `/admin/rooms/${room}`, { method: "DELETE" }, h.secret),
};

export function wsUrl(server: string, room: string, token: string, device: string): string {
  const u = new URL(`${base(server)}/rooms/${room}/ws`, location.href);
  u.protocol = u.protocol === "http:" ? "ws:" : "wss:";
  u.searchParams.set("t", token);
  u.searchParams.set("d", device);
  return u.toString();
}
