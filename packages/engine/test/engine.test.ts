import { beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  type GameEvent,
  type LoggedEvent,
  type PackBundle,
  assignRandom,
  assignRandomEach,
  checkPack,
  computeSetup,
  evaluate,
  fold,
  loadPack,
  localeChain,
  matches,
  normalize,
  packTranslator,
  packRef,
  moduleTree,
  widestPlayerRange,
  parseSetupKey,
  stepKey,
  playerRange,
  parseBundle,
  parseCsv,
  revertedSeqs,
  setCollection,
} from "../src";
import { readPackDir } from "../src/node";
import { TEST_PACK } from "./test-pack";
const HOST = "dev_host0001";
const GUEST = "dev_guest001";

let bundle: PackBundle;
beforeAll(async () => {
  bundle = await loadPack(TEST_PACK);
});

/** Events by the host, or `[device, event]`, or `[device, event, seat]` for a sender whose token is bound to a seat. */
function log(...events: Array<GameEvent | [string, GameEvent] | [string, GameEvent, string]>): LoggedEvent[] {
  return events.map((e, i) => {
    const [dev, event, seat] = Array.isArray(e) ? e : [HOST, e];
    return { seq: i + 1, dev, ts: 1000 + i, event, seat: seat ?? null };
  });
}

const init = (): GameEvent => ({
  t: "room.init",
  schema: 1,
  pack: { id: bundle.id, version: bundle.version, hash: bundle.hash },
  modules: [],
  allow_guest_seats: true,
});
const add = (seat: string, item: string, entry = `${seat}-${item}`): GameEvent => ({
  t: "zone.add",
  seat,
  zone: "cards",
  item,
  entry,
});
const seats = (...names: string[]): GameEvent[] => names.map((n) => ({ t: "seat.add", seat: n, name: n.toUpperCase() }));

describe("pack loading", () => {
  test("reads a pack directory from disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tessera-pack-"));
    for (const [path, content] of Object.entries(TEST_PACK)) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(join(dir, path), content);
    }
    expect(await readPackDir(dir)).toEqual(TEST_PACK);
  });

  test("loads, hashes deterministically and passes checks", async () => {
    expect(bundle.catalogs.cards).toHaveLength(10);
    expect(bundle.catalogs.cards[0]).toEqual({ id: "ruby_mine", round: 1, color: "red", players: [2, 4], gems: 1 });
    const again = await loadPack({ ...TEST_PACK });
    expect(again.hash).toBe(bundle.hash);
    expect(checkPack(bundle)).toEqual({ errors: [], warnings: [] });
  });

  test("bundle json roundtrip verifies the hash", async () => {
    const parsed = await parseBundle(JSON.stringify(bundle));
    expect(parsed.hash).toBe(bundle.hash);
    const tampered = JSON.parse(JSON.stringify(bundle));
    tampered.catalogs.cards[0].gems = 99;
    await expect(parseBundle(JSON.stringify(tampered))).rejects.toThrow(/hash mismatch/);
  });

  test("checker reports broken references, expressions and translations", async () => {
    const files = { ...TEST_PACK };
    files["game.yaml"] = files["game.yaml"]
      .replace('hoarder: { category: trade', 'hoarder: { category: nope')
      .replace('gems: "$sum(cards.gems)"', 'gems: "$sum(cards.gems"');
    files["locales/en.yaml"] = files["locales/en.yaml"].replace("  oracle: Oracle\n", "");
    const { errors } = checkPack(await loadPack(files));
    expect(errors.some((e) => e.includes('unknown category "nope"'))).toBe(true);
    expect(errors.some((e) => e.startsWith("derived.gems"))).toBe(true);
    expect(errors).toContain('locales/en: missing "cards.oracle"');
  });

  test("schema errors name the offending path", async () => {
    const files = { ...TEST_PACK };
    files["game.yaml"] = files["game.yaml"].replace("format: 1", "format: 2");
    await expect(loadPack(files)).rejects.toThrow(/format/);
  });
});

describe("fold", () => {
  test("seats, counters, zones and capture of the current track", () => {
    const s = fold(
      log(
        init(),
        ...seats("a", "b"),
        add("a", "ruby_mine"),
        { t: "track.set", track: "round", value: 2 },
        add("a", "crown"),
        { t: "counter.add", seat: "a", counter: "gold", delta: -5 },
        { t: "field.set", seat: "a", field: "guild", value: "miners" },
      ),
      bundle,
    );
    const a = s.seats[0];
    expect(a.zones.cards.map((z) => [z.item, z.meta.round])).toEqual([
      ["ruby_mine", 1],
      ["crown", 2],
    ]);
    expect(a.counters.gold).toBe(0);
    expect(a.fields.guild).toBe("miners");
    expect(s.host).toBe(HOST);
  });

  test("permissions: host-only events and seat claims", () => {
    const s = fold(
      log(
        init(),
        ...seats("a", "b"),
        [GUEST, { t: "seat.claim", seat: "a" }],
        ["dev_other01", { t: "seat.claim", seat: "a" }],
        [GUEST, { t: "modules.set", modules: ["merchants"] }],
        { t: "settings.set", allow_guest_seats: false },
        [GUEST, { t: "seat.add", seat: "c", name: "C" }],
        ["dev_other01", { t: "seat.claim", seat: "b" }],
        // The legacy flag proves nothing; a token bound to another seat neither.
        ["dev_other01", { t: "seat.claim", seat: "b", link: true }],
        ["dev_other01", { t: "seat.claim", seat: "b" }, "a"],
        ["dev_other01", { t: "seat.claim", seat: "b" }, "b"],
        { t: "seat.claim", seat: "a" },
      ),
      bundle,
    );
    expect(s.log.map((l) => l.status)).toEqual([
      "applied",
      "applied",
      "applied",
      "applied",
      "rejected",
      "rejected",
      "applied",
      "rejected",
      "rejected",
      "rejected",
      "rejected",
      "applied",
      "applied",
    ]);
    expect(s.seats.map((x) => x.id)).toEqual(["a", "b"]);
    expect(s.seats[0].device).toBe(HOST);
    expect(s.seats[1].device).toBe("dev_other01");
    expect(s.modules).toEqual([]);
  });

  test("guest-created seats are claimed by their creator", () => {
    const s = fold(log(init(), [GUEST, { t: "seat.add", seat: "g", name: "Guest" }]), bundle);
    expect(s.seats[0].device).toBe(GUEST);
  });

  test("invalid values are rejected, not applied", () => {
    const s = fold(
      log(
        init(),
        ...seats("a"),
        { t: "field.set", seat: "a", field: "side", value: "dusk" },
        { t: "field.set", seat: "a", field: "guild", value: "pirates" },
        add("a", "dragon"),
      ),
      bundle,
    );
    expect(s.log.slice(2).map((l) => l.reason)).toEqual(["invalid value", "unknown ref", "unknown item"]);
  });

  test("undo is a compensating event and undo of undo restores", () => {
    const events = log(init(), ...seats("a"), add("a", "ruby_mine"), { t: "undo", target: 3 });
    expect(fold(events, bundle).seats[0].zones.cards).toHaveLength(0);
    events.push({ seq: 5, dev: HOST, ts: 0, event: { t: "undo", target: 4 } });
    expect(revertedSeqs(events)).toEqual(new Set([4]));
    expect(fold(events, bundle).seats[0].zones.cards).toHaveLength(1);
  });

  test("events before room.init are ignored and fold is order-independent", () => {
    const events = log({ t: "track.set", track: "round", value: 3 }, init(), ...seats("a"));
    const s = fold([...events].reverse(), bundle);
    expect(s.tracks.round).toBe(1);
    expect(s.log[0].status).toBe("rejected");
  });
});

describe("evaluate", () => {
  test("derived values, neighbour effects, set collection and manual adjust", async () => {
    const events = log(
      { ...init(), modules: ["merchants"] } as GameEvent,
      ...seats("a", "b", "c"),
      add("a", "ruby_mine"),
      add("a", "trader"),
      add("a", "star_chart"),
      add("a", "moon_chart"),
      add("a", "oracle"),
      add("b", "sapphire_mine"),
      add("b", "ruby_mine"),
      add("c", "crown"),
      add("c", "hoarder"),
      { t: "counter.set", seat: "a", counter: "gold", value: 7 },
      { t: "field.set", seat: "a", field: "guild", value: "miners" },
      { t: "adjust.set", seat: "a", category: "merchants", value: 4 },
    );
    const ev = await evaluate(bundle, fold(events, bundle));
    expect(ev.errors).toEqual([]);
    const a = ev.seats.a;
    expect(a.values).toMatchObject({ gems: 1, reds: 1 });
    expect(a.scores).toEqual({ gold: 3, cards: 2, symbols: 8, trade: 2, merchants: 4 });
    expect(a.total).toBe(19);
    expect(ev.seats.b.values.more_reds_than_left).toBe(false);
    expect(ev.seats.c.scores.trade).toBe(1);
    expect(ev.categories.map((c) => c.id)).toContain("merchants");
  });

  test("module categories are hidden when the module is off", async () => {
    const ev = await evaluate(bundle, fold(log(init(), ...seats("a")), bundle));
    expect(ev.categories.map((c) => c.id)).not.toContain("merchants");
    expect(ev.seats.a.total).toBe(1);
  });

  test("setCollection places wildcards optimally", () => {
    expect(setCollection([1, 1, 1], 0, 7)).toBe(10);
    expect(setCollection([2, 1, 0], 1, 7)).toBe(13);
    expect(setCollection([3, 0, 0], 1, 7)).toBe(16);
    expect(setCollection([0, 0], 0, 3)).toBe(0);
  });
});

describe("setup", () => {
  test("copies by player count, module filtering and logged random picks", async () => {
    const two = await computeSetup(bundle, 2, []);
    expect(two[0].items.map((i) => [i.id, i.copies])).toEqual([
      ["ruby_mine", 1],
      ["sapphire_mine", 1],
      ["star_chart", 1],
      ["market", 1],
    ]);
    const five = await computeSetup(bundle, 5, ["merchants"]);
    expect(five[0].items.find((i) => i.id === "sapphire_mine")?.copies).toBe(2);
    expect(five[1].items.map((i) => i.id)).toContain("caravan");
    expect(five[2].random).toEqual({ count: 5, pool: ["miners", "weavers", "smiths"], picked: null });
    const rolled = await computeSetup(bundle, 2, [], { guilds: ["smiths", "miners"] });
    expect(rolled[2].items.map((i) => i.id)).toEqual(["miners", "smiths"]);
    expect(rolled[3]).toMatchObject({ id: "purse", items: [], pieces: [{ icon: "gold", count: 2 }, { icon: "gem", count: 1 }] });
  });

  test("marks list what to take, even for a single mark", async () => {
    const two = await computeSetup(bundle, 2, []);
    expect(two[4]).toMatchObject({ id: "stack", marks: ["2+"], color: "#c0c0c0", list: false, area: "components" });
    expect(two[3]).toMatchObject({ id: "purse", area: "player", count: null });
    expect(two.find((s) => s.id === "tip")?.count).toBe(2);
    expect(two.find((s) => s.id === "tip")?.help).toMatchObject({ extra: 0, players: 2, count: 2, mod_merchants: "off" });
    expect((await computeSetup(bundle, 4, ["merchants"])).find((s) => s.id === "tip")?.help).toMatchObject({ extra: 1, mod_merchants: "on" });
    expect(two[0].count).toBe(4);
    expect(two[4].count).toBe(4);
    expect(two[4].layout).toEqual([
      { kind: "pile", color: "#c0c0c0", icon: null, symbol: null, label: "II", count: 2, marks: [], caption: null, outline: null, shape: null, ink: null, stripes: [], size: null, pattern: null, on: null, modules: [] },
      { kind: "arrow" },
      { kind: "spot", color: null, icon: null, symbol: null, label: null, count: null, marks: [], caption: null, outline: null, shape: null, ink: null, stripes: [], size: null, pattern: null, on: null, modules: [] },
      { kind: "pieces", color: null, icon: "gold", symbol: null, label: null, count: null, marks: [], caption: null, outline: null, shape: null, ink: null, stripes: [], size: null, pattern: null, on: null, modules: [] },
    ]);
    expect((await computeSetup(bundle, 4, []))[4].marks).toEqual(["2+", "3+", "4+"]);
  });

  test("modules gate sections and pictures", async () => {
    const base = await computeSetup(bundle, 3, []);
    expect(base.map((s) => s.id)).not.toContain("hall");
    expect(base[4].layout).toHaveLength(4);
    const all = await computeSetup(bundle, 3, ["merchants", "guildhall"]);
    expect(all.find((s) => s.id === "hall")?.count).toBe(3);
    expect(all[4].layout.at(-1)).toMatchObject({ kind: "pieces", modules: ["merchants"] });
    expect(all[4].layout).toHaveLength(5);
  });

  test("a merge shows one pile alone, or sources, an arrow and their total", async () => {
    const one = (await computeSetup(bundle, 3, [])).find((s) => s.id === "pool")!;
    expect(one.layout).toEqual([{ kind: "pile", color: "red", icon: null, symbol: null, label: null, count: 4, marks: ["4+"], caption: null, outline: null, shape: null, ink: null, stripes: [], size: null, pattern: null, on: null, modules: [] }]);
    expect([one.count, one.help.merged]).toEqual([4, 1]);
    const two = (await computeSetup(bundle, 3, ["merchants"])).find((s) => s.id === "pool")!;
    expect(two.layout.map((i) => (i.kind === "arrow" ? "→" : i.count))).toEqual([4, 2, "→", 6]);
    expect([two.count, two.help.merged]).toEqual([6, 2]);
  });

  test("a shaped item is a token with its label", async () => {
    const all = await computeSetup(bundle, 3, []);
    expect(all.find((s) => s.id === "medals")?.layout[0]).toMatchObject({ kind: "token", shape: "pentagon", label: "-1", color: "blue", caption: "loss" });
    const group = all.find((s) => s.id === "medals")?.layout[1];
    expect(group).toMatchObject({ kind: "group", caption: "war" });
    expect(group?.kind === "group" && group.items.map((i) => i.label)).toEqual(["+"]);
    const any = (await computeSetup(bundle, 3, ["guildhall", "merchants"])).find((s) => s.id === "medals")?.layout[2];
    expect(any).toMatchObject({ kind: "token", label: "?", modules: ["merchants", "guildhall"] });
    expect((await computeSetup(bundle, 3, [])).find((s) => s.id === "medals")?.layout).toHaveLength(2);
    const card = (await computeSetup(bundle, 3, [])).find((s) => s.id === "tableau")?.layout[0];
    expect(card).toMatchObject({ kind: "pile", count: 1, on: { kind: "token", shape: "figure", count: 2 } });
  });

  test("a module switches off when the module it requires does", () => {
    const s = fold(log(init(), { t: "modules.set", modules: ["guildhall"] }), bundle);
    expect(s.modules).toEqual([]);
    const ok = fold(log(init(), { t: "modules.set", modules: ["merchants", "guildhall"] }), bundle);
    expect(ok.modules).toEqual(["merchants", "guildhall", "stall"]);
    const part = fold(log(init(), { t: "modules.set", modules: ["stall"] }), bundle);
    expect(part.modules).toEqual(["stall"]);
  });

  test("round sections bind $round, honour when and key their state by round", async () => {
    const first = await computeSetup(bundle, 3, [], {}, 1);
    expect(first.map((s) => s.id)).toEqual(["1:deck"]);
    expect(first[0].items.every((i) => i.row.round === 1)).toBe(true);
    const second = await computeSetup(bundle, 3, [], { "2:bonus": ["weavers", "miners"] }, 2);
    expect(second.map((s) => [s.id, s.section])).toEqual([["2:deck", "deck"], ["2:bonus", "bonus"]]);
    expect(second[1].random).toMatchObject({ count: 2, picked: ["weavers", "miners"] });
    expect(parseSetupKey("2:bonus")).toEqual({ step: null, round: 2, section: "bonus" });
    expect(parseSetupKey("purse")).toEqual({ step: null, round: null, section: "purse" });
    expect(parseSetupKey(stepKey("players"))).toMatchObject({ step: "players", round: null });
  });
});

describe("text and i18n", () => {
  test("search folds Polish diacritics including ł", () => {
    expect(normalize("Łódź Żółć")).toBe("lodz zolc");
    expect(matches("Kopalnia rubinów", "rubinow kop")).toBe(true);
    expect(matches("Skład drewna", "sklad")).toBe(true);
    expect(matches("Targ", "x")).toBe(false);
  });

  test("locale fallback chain and ICU plurals", () => {
    expect(localeChain("pl-PL")).toEqual(["pl-PL", "pl", "en"]);
    const pl = packTranslator(bundle, "pl-PL");
    expect(pl.name("cards", "ruby_mine")).toBe("Kopalnia rubinów");
    expect(pl.t("ui.gems", { count: 1 })).toBe("1 klejnot");
    expect(pl.t("ui.gems", { count: 3 })).toBe("3 klejnoty");
    expect(pl.t("ui.gems", { count: 5 })).toBe("5 klejnotów");
    const de = packTranslator(bundle, "de");
    expect(de.name("cards", "crown")).toBe("Crown");
    expect(de.t("missing.key")).toBe("missing.key");
  });
});

describe("csv", () => {
  test("quotes, escaped quotes, CRLF and comments", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\n# note\n\n1,2')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["1", "2"],
    ]);
  });
});

describe("lobby", () => {
  test("phase starts in lobby and only the host may change it", () => {
    const s = fold(log(init(), [GUEST, { t: "phase.set", phase: "playing" }], { t: "setup.check", section: "round1", done: true }), bundle);
    expect(s.phase).toBe("lobby");
    expect(s.setupChecked).toEqual({ round1: true });
    expect(fold(log(init(), ...seats("a", "b"), { t: "phase.set", phase: "playing" }), bundle).phase).toBe("playing");
  });

  test("random assignment keeps a column distinct", () => {
    const rows = [
      { id: "a1", w: "a" },
      { id: "a2", w: "a" },
      { id: "b1", w: "b" },
      { id: "c1", w: "c" },
    ];
    for (let i = 0; i < 20; i++) {
      const picked = assignRandom(rows, 3, "w");
      expect(new Set(picked.map((r) => r.w)).size).toBe(3);
    }
    expect(assignRandom(rows, 9, "w")).toHaveLength(3);
    const each = assignRandomEach([rows.filter((r) => r.w === "a"), rows, rows], "w");
    expect(each[0]?.w).toBe("a");
    expect(new Set(each.map((r) => r?.w)).size).toBe(3);
  });
});

describe("assignments", () => {
  test("only the host or the seat owner may set a ref field", () => {
    const s = fold(
      log(
        init(),
        ...seats("a", "b"),
        [GUEST, { t: "seat.claim", seat: "a" }],
        [GUEST, { t: "field.set", seat: "a", field: "guild", value: "miners" }],
        [GUEST, { t: "field.set", seat: "b", field: "guild", value: "smiths" }],
        { t: "field.set", seat: "b", field: "guild", value: "weavers" },
      ),
      bundle,
    );
    expect(s.log.slice(-3).map((l) => l.status)).toEqual(["applied", "rejected", "applied"]);
    expect(s.seats.map((x) => x.fields.guild)).toEqual(["miners", "weavers"]);
  });

  test("host can take assignments away from players entirely", () => {
    const s = fold(
      log(
        init(),
        ...seats("a"),
        [GUEST, { t: "seat.claim", seat: "a" }],
        { t: "settings.set", host_assigns: true },
        [GUEST, { t: "field.set", seat: "a", field: "guild", value: "miners" }],
        { t: "field.set", seat: "a", field: "guild", value: "smiths" },
      ),
      bundle,
    );
    expect(s.log.slice(-2).map((l) => l.status)).toEqual(["rejected", "applied"]);
    expect(s.seats[0].fields.guild).toBe("smiths");
  });
});

describe("members", () => {
  test("guests introduce themselves and the host assigns them to a seat", () => {
    const s = fold(
      log(
        init(),
        ...seats("a"),
        [GUEST, { t: "member.hello", name: "Ola" }],
        [GUEST, { t: "seat.assign", seat: "a", device: GUEST }],
        { t: "seat.assign", seat: "a", device: GUEST },
      ),
      bundle,
    );
    expect(s.members).toEqual({ [GUEST]: { name: "Ola" } });
    expect(s.log.map((l) => l.status).slice(-2)).toEqual(["rejected", "applied"]);
    expect(s.seats[0].device).toBe(GUEST);
    expect(s.seats[0].name).toBe("Ola");
  });

  test("host variants limit a player's choices", () => {
    const s = fold(
      log(
        init(),
        ...seats("a"),
        [GUEST, { t: "seat.claim", seat: "a" }],
        [GUEST, { t: "variants.set", field: "guild", column: "tier", values: ["gold"] }],
        { t: "variants.set", field: "guild", column: "tier", values: ["gold"] },
        { t: "variants.set", field: "guild", column: "tier", values: ["nope"] },
        [GUEST, { t: "field.set", seat: "a", field: "guild", value: "weavers" }],
        [GUEST, { t: "field.set", seat: "a", field: "guild", value: "smiths" }],
      ),
      bundle,
    );
    expect(s.log.slice(-5).map((l) => l.status)).toEqual(["rejected", "applied", "rejected", "rejected", "applied"]);
    expect(s.variants).toEqual({ guild: { tier: ["gold"] } });
    expect(s.seats[0].fields.guild).toBe("smiths");
    const reset = fold(log(init(), { t: "variants.set", field: "guild", column: "tier", values: ["silver", "gold"] }), bundle);
    expect(reset.variants).toEqual({ guild: {} });
  });

  test("the host moves the room to another version of its pack", () => {
    const ref = { id: bundle.id, version: "9.9.9", hash: "abc" };
    const s = fold(
      log(init(), [GUEST, { t: "pack.set", pack: ref }], { t: "pack.set", pack: { ...ref, id: "other" } }, { t: "pack.set", pack: ref }),
      bundle,
    );
    expect(s.log.slice(-3).map((l) => l.status)).toEqual(["rejected", "rejected", "applied"]);
    expect(s.pack).toEqual(ref);
  });

  test("expansions widen the player range and tracks start at their minimum", () => {
    expect(playerRange(bundle.game, [])).toEqual({ min: 2, max: 5 });
    expect(playerRange(bundle.game, ["merchants"])).toEqual({ min: 2, max: 6 });
    const six = ["a", "b", "c", "d", "e", "f"];
    const base = fold(log(init(), ...seats(...six)), bundle);
    expect(base.seats).toHaveLength(5);
    expect(base.tracks.round).toBe(1);
    const wide = fold(log(init(), { t: "modules.set", modules: ["merchants"] }, ...seats(...six)), bundle);
    expect(wide.seats).toHaveLength(6);
    const shrunk = fold(log(init(), { t: "modules.set", modules: ["merchants"] }, ...seats(...six), { t: "modules.set", modules: [] }, { t: "phase.set", phase: "playing" }), bundle);
    expect(shrunk.log.at(-1)?.reason).toBe("too many players");
  });

  test("fields.set applies every change or none", () => {
    const ok = fold(
      log(init(), ...seats("a", "b"), { t: "fields.set", changes: [{ seat: "a", field: "guild", value: "miners" }, { seat: "b", field: "guild", value: "smiths" }] }),
      bundle,
    );
    expect(ok.seats.map((x) => x.fields.guild)).toEqual(["miners", "smiths"]);
    const bad = fold(
      log(init(), ...seats("a", "b"), { t: "fields.set", changes: [{ seat: "a", field: "guild", value: "miners" }, { seat: "b", field: "guild", value: "nope" }] }),
      bundle,
    );
    expect(bad.log.at(-1)?.status).toBe("rejected");
    expect(bad.seats[0].fields.guild).not.toBe("miners");
  });

  test("only the host confirms lobby steps, while anyone ticks off setup tasks", () => {
    const s = fold(
      log(init(), [GUEST, { t: "setup.check", section: stepKey("players"), done: true }], [GUEST, { t: "setup.check", section: "round1", done: true }]),
      bundle,
    );
    expect(s.log.slice(-2).map((l) => l.status)).toEqual(["rejected", "applied"]);
  });

  test("the room's pack follows the host's pack.set unless it was undone", () => {
    const ref = { id: bundle.id, version: "9.9.9", hash: "abc" };
    const events = log(init(), { t: "pack.set", pack: ref });
    expect(packRef(events)).toEqual(ref);
    const undone = log(init(), { t: "pack.set", pack: ref }, { t: "undo", target: 2 });
    expect(packRef(undone)?.hash).not.toBe("abc");
  });

  test("modules form a tree of variants and parts", () => {
    const tree = moduleTree(bundle.game);
    expect(tree.map((n) => [n.def.id, n.variants.map((v) => v.id), n.parts.map((p) => p.id)])).toEqual([["merchants", ["guildhall"], ["stall"]]]);
    expect(widestPlayerRange(bundle.game)).toEqual({ min: 2, max: 6 });
  });

  test("the game cannot start below the minimum player count", () => {
    const s = fold(log(init(), ...seats("a"), { t: "phase.set", phase: "playing" }, ...seats("b"), { t: "phase.set", phase: "playing" }), bundle);
    expect(s.log.map((l) => l.status).filter((x, i) => s.log[i].event.t === "phase.set")).toEqual(["rejected", "applied"]);
    expect(s.phase).toBe("playing");
  });

  test("unnamed seats take the name of the player who joins them", () => {
    const s = fold(
      log(
        init(),
        { t: "seat.add", seat: "a", name: "" },
        { t: "seat.add", seat: "b", name: "" },
        [GUEST, { t: "seat.claim", seat: "a" }, "a"],
        [GUEST, { t: "member.hello", name: "Ola" }],
        ["dev_other01", { t: "member.hello", name: "Jan" }],
        ["dev_other01", { t: "seat.claim", seat: "b" }, "b"],
      ),
      bundle,
    );
    expect(s.seats.map((x) => x.name)).toEqual(["Ola", "Jan"]);
    expect(s.members[GUEST].name).toBe("Ola");
  });

  test("a seated player and their seat share one name", () => {
    const s = fold(
      log(
        init(),
        ...seats("a", "b"),
        [GUEST, { t: "member.hello", name: "Ola" }],
        [GUEST, { t: "seat.claim", seat: "a" }, "a"],
        [GUEST, { t: "seat.update", seat: "a", name: "Olka" }],
        [GUEST, { t: "seat.release", seat: "a" }],
        ["dev_other01", { t: "member.hello", name: "Jan" }],
        ["dev_other01", { t: "seat.claim", seat: "b" }],
      ),
      bundle,
    );
    expect(s.members[GUEST].name).toBe("Olka");
    expect(s.seats.map((x) => x.name)).toEqual(["Olka", "Jan"]);
  });
});
