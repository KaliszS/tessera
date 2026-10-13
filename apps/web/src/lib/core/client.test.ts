import { describe, expect, test } from "bun:test";
import { generateRoomKey, open, seal } from "./crypto";
import { inviteUrl, parseInvite, tokenClaims } from "./invite";

describe("room crypto", () => {
  test("seal/open roundtrip, bound to the room id", async () => {
    const k = generateRoomKey();
    const data = await seal(k, "room_0001", { v: 1, e: { t: "undo", target: 3 } });
    expect(await open(k, "room_0001", data)).toEqual({ v: 1, e: { t: "undo", target: 3 } });
    await expect(open(k, "room_0002", data)).rejects.toThrow();
    await expect(open(generateRoomKey(), "room_0001", data)).rejects.toThrow();
  });
});

describe("invites", () => {
  test("link roundtrip keeps secrets in the fragment", () => {
    const inv = { server: "https://relay.example.workers.dev", room: "AbCd1234efGH5678", token: "eyJy.c2ln", key: "k-_y" };
    const url = inviteUrl(inv, "https://player.example/tessera/");
    expect(url.split("#")[0]).toBe("https://player.example/tessera/");
    expect(parseInvite(url)).toEqual(inv);
    expect(parseInvite("https://player.example/#/join?r=x")).toBeNull();
  });

  test("token claims are readable without the secret", () => {
    const payload = btoa(JSON.stringify({ r: "room_0001", role: "player", s: "p2" })).replace(/=+$/, "");
    expect(tokenClaims(`${payload}.sig`)).toEqual({ r: "room_0001", role: "player", s: "p2" });
    expect(tokenClaims("garbage")).toBeNull();
  });
});
