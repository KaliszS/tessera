export interface Invite {
  server: string;
  room: string;
  token: string;
  key: string;
}

/** Everything after # stays in the browser, so the token and key never reach a server. */
export function inviteUrl(inv: Invite, base = `${location.origin}${location.pathname}`): string {
  const q = new URLSearchParams({ s: inv.server, r: inv.room, t: inv.token, k: inv.key });
  return `${base}#/join?${q}`;
}

export function parseInvite(input: string | URLSearchParams): Invite | null {
  let q: URLSearchParams;
  if (typeof input === "string") {
    const i = input.indexOf("?", input.indexOf("#"));
    q = new URLSearchParams(i >= 0 ? input.slice(i + 1) : input);
  } else {
    q = input;
  }
  const inv = { server: q.get("s") ?? "", room: q.get("r") ?? "", token: q.get("t") ?? "", key: q.get("k") ?? "" };
  return inv.server && inv.room && inv.token && inv.key ? inv : null;
}

export function tokenClaims(token: string): { r: string; role: "host" | "player"; s?: string; exp?: number } | null {
  try {
    const payload = token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload + "===".slice((payload.length + 3) % 4)));
  } catch {
    return null;
  }
}
