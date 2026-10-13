import { compile } from "./expr";
import { rowEnabled } from "./pack";
import type { PackBundle, Row } from "./schema";

export interface SetupItem {
  id: string;
  copies: number;
  row: Row;
}

export interface SetupSection {
  id: string;
  items: SetupItem[];
  groups: Record<string, SetupItem[]> | null;
  /** Set when the section draws N random rows; `picked` comes from logged setup.roll events. */
  random: { count: number; picked: string[] | null } | null;
}

export async function computeSetup(
  bundle: PackBundle,
  players: number,
  modules: string[],
  rolls: Record<string, string[]> = {},
): Promise<SetupSection[]> {
  const game = { players, modules };
  const out: SetupSection[] = [];
  for (const sec of bundle.game.setup?.sections ?? []) {
    let items: SetupItem[] = [];
    if (sec.catalog) {
      const key = bundle.game.catalogs[sec.catalog]?.key ?? "id";
      for (const row of bundle.catalogs[sec.catalog] ?? []) {
        if (!rowEnabled(row, modules)) continue;
        if (sec.filter && !(await compile(sec.filter).evaluate(row, { game }))) continue;
        const copies = sec.copies ? Number(await compile(sec.copies).evaluate(row, { game })) || 0 : 1;
        if (copies > 0) items.push({ id: String(row[key]), copies, row });
      }
    }
    let random: SetupSection["random"] = null;
    if (sec.pick_random) {
      const count = Number(await compile(sec.pick_random).evaluate({}, { game })) || 0;
      const picked = rolls[sec.id] ?? null;
      random = { count, picked };
      if (picked) items = items.filter((it) => picked.includes(it.id));
    }
    let groups: SetupSection["groups"] = null;
    if (sec.group_by) {
      groups = {};
      for (const it of items) (groups[String(it.row[sec.group_by])] ??= []).push(it);
    }
    out.push({ id: sec.id, items, groups, random });
  }
  return out;
}

export function drawRandom(ids: string[], count: number, rand: () => number = Math.random): string[] {
  const pool = [...ids];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
