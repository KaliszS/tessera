import { compile } from "./expr";
import type { GameState, SeatState } from "./fold";
import { catalogIndex, rowEnabled } from "./pack";
import type { CategoryDef, PackBundle, Row } from "./schema";

export type SeatObject = Record<string, unknown>;

export interface SeatView {
  values: Record<string, unknown>;
  effects: Record<string, number>;
  scores: Record<string, number>;
  total: number;
}

export interface Evaluation {
  categories: CategoryDef[];
  seats: Record<string, SeatView>;
  errors: string[];
}

export function activeCategories(bundle: PackBundle, modules: string[]): CategoryDef[] {
  return (bundle.game.scoring?.categories ?? []).filter((c) => !c.module || modules.includes(c.module));
}

export function gameBinding(state: GameState) {
  return { ...state.tracks, players: state.seats.length, modules: state.modules };
}

function seatObject(seat: SeatState, bundle: PackBundle, index: ReturnType<typeof catalogIndex>): SeatObject {
  const obj: SeatObject = { id: seat.id, name: seat.name, ...seat.fields, ...seat.counters };
  for (const [zone, def] of Object.entries(bundle.game.seat.zones)) {
    obj[zone] = (seat.zones[zone] ?? []).map((z) => ({
      ...(index[def.catalog]?.get(z.item) ?? {}),
      ...z.meta,
      _entry: z.entry,
      _item: z.item,
    }));
  }
  return obj;
}

const toNumber = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Computes derived values, card effects and scores for every seat. */
export async function evaluate(bundle: PackBundle, state: GameState): Promise<Evaluation> {
  const index = catalogIndex(bundle);
  const errors: string[] = [];
  const seats = state.seats;
  const objs = seats.map((s) => seatObject(s, bundle, index));
  const n = objs.length;
  const game = gameBinding(state);
  const row = (catalog: string, id: string) => index[catalog]?.get(String(id)) ?? null;

  const bindings = (i: number) => ({
    me: objs[i],
    left: n > 1 ? objs[(i - 1 + n) % n] : null,
    right: n > 1 ? objs[(i + 1) % n] : null,
    all: objs,
    game,
    row,
  });

  const run = async (src: string, input: unknown, extra: Record<string, unknown>, where: string) => {
    try {
      return await compile(src).evaluate(input, extra);
    } catch (e) {
      errors.push(`${where}: ${(e as Error).message}`);
      return undefined;
    }
  };

  for (const [key, src] of Object.entries(bundle.game.derived)) {
    for (let i = 0; i < n; i++) {
      objs[i][key] = await run(src, objs[i], bindings(i), `${seats[i].id}.${key}`);
    }
  }

  const categories = activeCategories(bundle, state.modules);
  const out: Record<string, SeatView> = {};
  for (let i = 0; i < n; i++) {
    const effects: Record<string, number> = {};
    for (const [zone, def] of Object.entries(bundle.game.seat.zones)) {
      const table = bundle.game.effects[def.catalog];
      if (!table) continue;
      for (const card of objs[i][zone] as Row[]) {
        const eff = table[String(card._item)];
        if (!eff || !rowEnabled(card, state.modules)) continue;
        const pts = await run(eff.points, objs[i], { ...bindings(i), card }, `${seats[i].id}.effect.${card._item}`);
        effects[eff.category] = (effects[eff.category] ?? 0) + toNumber(pts);
      }
    }
    const scores: Record<string, number> = {};
    for (const cat of categories) {
      let v = 0;
      if (cat.expr && !cat.manual) v += toNumber(await run(cat.expr, objs[i], bindings(i), `${seats[i].id}.score.${cat.id}`));
      v += effects[cat.id] ?? 0;
      v += seats[i].adjust[cat.id] ?? 0;
      scores[cat.id] = v;
    }
    const values = Object.fromEntries(Object.keys(bundle.game.derived).map((k) => [k, objs[i][k]]));
    out[seats[i].id] = {
      values,
      effects,
      scores,
      total: Object.values(scores).reduce((a, b) => a + b, 0),
    };
  }
  return { categories, seats: out, errors };
}
