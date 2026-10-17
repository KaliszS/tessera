import { compile } from "./expr";
import { modulesNamed, modulesOn, rowEnabled } from "./pack";
import type { LayoutPileDef, PackBundle, Row, SetupArea, SetupSectionDef } from "./schema";

export interface SetupItem {
  id: string;
  copies: number;
  row: Row;
}

export interface SetupSection {
  /** Key for setup.check / setup.roll: the section id, or `<round>:<id>` for a round section. */
  id: string;
  /** Section id in the pack (locale key). */
  section: string;
  catalog: string | null;
  items: SetupItem[];
  /** Set when the section draws N random rows from `pool`; `picked` comes from logged setup.roll events. */
  random: { count: number; pool: string[]; picked: string[] | null } | null;
  /** Pieces each player takes, by icon name. */
  pieces: Array<{ icon: string; count: number }>;
  marks: string[];
  color: string | null;
  /** Whether to list the rows or only count them. */
  list: boolean;
  area: SetupArea;
  /** Number to show on the section, or null for none. */
  count: number | null;
  layout: LayoutItem[];
  /** Values for the help text: `players`, `count`, `merged` (piles in a merge), the section's `params`
   * and `mod_<module>` ("on"/"off") for ICU select. */
  help: Record<string, number | string>;
}

type Base = Omit<LayoutPileDef, "on">;
type Nullable<T> = { [K in keyof T]-?: Exclude<T[K], undefined> | null };

export type LayoutItem = { kind: "arrow" } | LayoutGroup | LayoutThing;
export type LayoutGroup = { kind: "group"; items: LayoutThing[]; caption: string | null; modules: string[] };
export type LayoutThing = Nullable<Pick<Base, "color" | "icon" | "symbol" | "label" | "caption" | "outline" | "shape" | "ink" | "size" | "pattern">> & {
  kind: "pile" | "token" | "pieces" | "spot";
  count: number | null;
  marks: string[];
  stripes: string[];
  /** An item lying on this one, e.g. pawns on a card. */
  on: LayoutThing | null;
  /** The expansions this item belongs to (those on, besides the section's own), so the picture can mark it. */
  modules: string[];
};

/** Where a section happens when the pack does not say: each player's place for pieces they take, else shared components. */
export const sectionArea = (def: SetupSectionDef): SetupArea => def.area ?? (def.per_player ? "player" : "components");

export const roundKey = (round: number, section: string) => `${round}:${section}`;

/** Key recording that the host confirmed a lobby step (kept in the same checklist as setup sections). */
export const stepKey = (step: string) => `lobby-${step}`;

/** Splits a setup key into a lobby step, or a round (null before the game) and section id. */
export function parseSetupKey(key: string): { step: string | null; round: number | null; section: string } {
  if (key.startsWith(stepKey(""))) return { step: key.slice(stepKey("").length), round: null, section: key };
  const m = /^(-?\d+):(.+)$/.exec(key);
  return m ? { step: null, round: Number(m[1]), section: m[2] } : { step: null, round: null, section: key };
}

/** Sections to prepare before the game, or before `round` of the pack's round track. */
export async function computeSetup(
  bundle: PackBundle,
  players: number,
  modules: string[],
  rolls: Record<string, string[]> = {},
  round?: number,
): Promise<SetupSection[]> {
  const setup = bundle.game.setup;
  const defs = round === undefined ? (setup?.sections ?? []) : (setup?.rounds?.sections ?? []);
  const vars = round === undefined ? { game: { players, modules } } : { game: { players, modules }, round };
  const num: Num = async (e, input = {}) => (typeof e === "number" ? e : Number(await compile(e).evaluate(input, vars)) || 0);
  const strings: Strings = async (e) => {
    if (!e) return [];
    // JSONata collapses one-element sequences to a bare value.
    const v = await compile(e).evaluate({}, vars);
    return (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]).map(String);
  };
  const modFlags = Object.fromEntries(bundle.game.modules.map((m) => [`mod_${m.id}`, modules.includes(m.id) ? "on" : "off"]));
  const out: SetupSection[] = [];
  for (const sec of defs) {
    if (!modulesOn(modules, sec.module)) continue;
    if (sec.when && !(await compile(sec.when).evaluate({}, vars))) continue;
    const id = round === undefined ? sec.id : roundKey(round, sec.id);
    let items: SetupItem[] = [];
    if (sec.catalog) {
      const key = bundle.game.catalogs[sec.catalog]?.key ?? "id";
      for (const row of bundle.catalogs[sec.catalog] ?? []) {
        if (!rowEnabled(row, modules)) continue;
        if (sec.filter && !(await compile(sec.filter).evaluate(row, vars))) continue;
        const copies = sec.copies ? await num(sec.copies, row) : 1;
        if (copies > 0) items.push({ id: String(row[key]), copies, row });
      }
    }
    let random: SetupSection["random"] = null;
    if (sec.pick_random) {
      const picked = rolls[id] ?? null;
      random = { count: await num(sec.pick_random), pool: items.map((it) => it.id), picked };
      if (picked) items = items.filter((it) => picked.includes(it.id));
    }
    const pieces: SetupSection["pieces"] = [];
    for (const [icon, n] of Object.entries(sec.per_player ?? {})) {
      const count = await num(n);
      if (count > 0) pieces.push({ icon, count });
    }
    // A section that belongs to an expansion as a whole needs no per-item expansion markers.
    const own = new Set(modulesNamed(modules, sec.module));
    const marked = (need: LayoutPileDef["module"]) => modulesNamed(modules, need).filter((m) => !own.has(m));
    const { layout, merged, total } = await buildLayout(sec.layout ?? [], { modules, num, strings, marked });
    // Shown next to the title: the rule's count, else the rows', the merged decks' or the single kind of piece's.
    const count =
      sec.count !== undefined
        ? await num(sec.count)
        : sec.catalog
          ? items.reduce((a, i) => a + i.copies, 0)
          : (total ?? (pieces.length === 1 ? pieces[0].count : null));
    const params = Object.fromEntries(await Promise.all(Object.entries(sec.params ?? {}).map(async ([k, v]) => [k, await num(v)] as const)));
    out.push({
      id,
      section: sec.id,
      catalog: sec.catalog ?? null,
      items,
      random,
      pieces,
      marks: await strings(sec.marks),
      color: sec.color ?? null,
      list: sec.list ?? true,
      area: sectionArea(sec),
      count,
      layout,
      help: { players, count: count ?? 0, merged, ...params, ...modFlags },
    });
  }
  return out;
}

type Num = (e: string | number, input?: unknown) => Promise<number>;
type Strings = (e: string | undefined) => Promise<string[]>;
type Ctx = { modules: string[]; num: Num; strings: Strings; marked: (need: LayoutPileDef["module"]) => string[] };

async function pile(p: Base & { on?: Base }, ctx: Ctx, count?: number): Promise<LayoutThing> {
  return {
    kind: p.shape ? "token" : p.icon ? "pieces" : p.color ? "pile" : "spot",
    color: p.color ?? null,
    icon: p.icon ?? null,
    symbol: p.symbol ?? null,
    label: p.label ?? null,
    caption: p.caption ?? null,
    outline: p.outline ?? null,
    shape: p.shape ?? null,
    ink: p.ink ?? null,
    stripes: p.stripes ?? [],
    size: p.size ?? null,
    pattern: p.pattern ?? null,
    on: p.on && modulesOn(ctx.modules, p.on.module) ? await pile(p.on, ctx) : null,
    modules: ctx.marked(p.module),
    count: count ?? (p.count !== undefined ? await ctx.num(p.count) : null),
    marks: await ctx.strings(p.marks),
  };
}

/** Turns the pack's picture into items for the enabled modules; a merge also yields its total for the section. */
async function buildLayout(defs: NonNullable<SetupSectionDef["layout"]>, ctx: Ctx) {
  const layout: LayoutItem[] = [];
  const on = (p: { module?: LayoutPileDef["module"] }) => modulesOn(ctx.modules, p.module);
  let merged = 0;
  let total: number | null = null;
  for (const d of defs) {
    if (d === "arrow") {
      layout.push({ kind: "arrow" });
    } else if ("group" in d) {
      if (!on(d)) continue;
      const items = await Promise.all(d.group.filter(on).map((p) => pile(p, ctx)));
      if (items.length) layout.push({ kind: "group", items, caption: d.caption ?? null, modules: ctx.marked(d.module) });
    } else if ("merge" in d) {
      const sources = await Promise.all(d.merge.filter(on).map((p) => pile(p, ctx)));
      merged = sources.length;
      total = d.into.count !== undefined ? await ctx.num(d.into.count) : sources.reduce((a, p) => a + (p.count ?? 0), 0);
      if (sources.length === 1) layout.push({ ...sources[0], count: total });
      else if (sources.length > 1) layout.push(...sources, { kind: "arrow" }, await pile(d.into, ctx, total));
    } else if (on(d)) {
      layout.push(await pile(d, ctx));
    }
  }
  return { layout, merged, total };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

export const drawRandom = (ids: string[], count: number, rand: () => number = Math.random) => shuffle(ids, rand).slice(0, count);

/** Random distinct rows for each seat; `uniqueBy` keeps a column distinct (e.g. one side per wonder). */
export const assignRandom = <T extends Record<string, unknown>>(rows: T[], seats: number, uniqueBy?: string, rand: () => number = Math.random) =>
  assignRandomEach(Array.from({ length: seats }, () => rows), uniqueBy, rand).filter((r): r is T => r !== undefined);

/** A random distinct row for each seat from that seat's own pool (e.g. after a per-seat filter); a seat whose pool
 * runs out gets undefined. Seats with the fewest options pick first, ties in random order, so no seat is favoured. */
export function assignRandomEach<T extends Record<string, unknown>>(pools: T[][], uniqueBy?: string, rand: () => number = Math.random): Array<T | undefined> {
  const out: Array<T | undefined> = pools.map(() => undefined);
  const used = new Set<unknown>();
  for (const i of shuffle([...pools.keys()], rand).sort((a, b) => pools[a].length - pools[b].length)) {
    out[i] = shuffle(pools[i], rand).find((r) => !used.has(uniqueBy ? r[uniqueBy] : r));
    if (out[i]) used.add(uniqueBy ? out[i]![uniqueBy] : out[i]);
  }
  return out;
}
