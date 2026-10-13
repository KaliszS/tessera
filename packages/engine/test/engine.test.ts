import { beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  type GameEvent,
  type LoggedEvent,
  type PackBundle,
  checkPack,
  computeSetup,
  evaluate,
  fold,
  loadPack,
  localeChain,
  matches,
  normalize,
  packTranslator,
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

function log(...events: Array<GameEvent | [string, GameEvent]>): LoggedEvent[] {
  return events.map((e, i) => {
    const [dev, event] = Array.isArray(e) ? e : [HOST, e];
    return { seq: i + 1, dev, ts: 1000 + i, event };
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
      "applied",
    ]);
    expect(s.seats.map((x) => x.id)).toEqual(["a", "b"]);
    expect(s.seats[0].device).toBe(HOST);
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
    expect(five[2].random).toEqual({ count: 5, picked: null });
    const rolled = await computeSetup(bundle, 2, [], { guilds: ["smiths", "miners"] });
    expect(rolled[2].items.map((i) => i.id)).toEqual(["miners", "smiths"]);
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
