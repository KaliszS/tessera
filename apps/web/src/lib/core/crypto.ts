import { b64Decode, b64Encode, b64urlDecode, b64urlEncode } from "./util";

/** Room key: 256-bit AES-GCM, shared only via the invite URL fragment. */
export function generateRoomKey(): string {
  return b64urlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

const keys = new Map<string, Promise<CryptoKey>>();

function importKey(k: string): Promise<CryptoKey> {
  let p = keys.get(k);
  if (!p) {
    p = crypto.subtle.importKey("raw", b64urlDecode(k) as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
    keys.set(k, p);
  }
  return p;
}

/** base64(iv || ciphertext); the room id is bound as additional data. */
export async function seal(k: string, room: string, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(room) },
    await importKey(k),
    new TextEncoder().encode(JSON.stringify(value)),
  );
  const out = new Uint8Array(12 + ct.byteLength);
  out.set(iv);
  out.set(new Uint8Array(ct), 12);
  return b64Encode(out);
}

export async function open(k: string, room: string, data: string): Promise<unknown> {
  const raw = b64Decode(data);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: raw.subarray(0, 12) as BufferSource, additionalData: new TextEncoder().encode(room) },
    await importKey(k),
    raw.subarray(12) as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(pt));
}
