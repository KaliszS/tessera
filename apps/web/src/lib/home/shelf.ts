import type { PackBundle } from "@tessera/engine";
import type { PackRow } from "../core/db";
import type { DevPack } from "../core/packs";

export interface ShelfItem {
  key: string;
  bundle: PackBundle;
  installed: PackRow | null;
  /** Local dev pack: installable when the game is not installed, otherwise a pending update. */
  dev: DevPack | null;
}

/** The installed version of each game: the newest one installed on purpose, else the newest one a room brought. */
export function latestInstalled(all: PackRow[]): Map<string, PackRow> {
  const latest = new Map<string, PackRow>();
  const chosen = (p: PackRow) => p.source !== "room";
  for (const p of all) {
    const cur = latest.get(p.id);
    if (!cur || (chosen(p) && !chosen(cur)) || (chosen(p) === chosen(cur) && p.installedAt > cur.installedAt)) latest.set(p.id, p);
  }
  return latest;
}

/** One box per game: its installed version, with a differing dev copy attached as an update. */
export function shelfItems(all: PackRow[], dev: DevPack[]): ShelfItem[] {
  const latest = latestInstalled(all);
  const devById = new Map(dev.filter((d) => d.bundle).map((d) => [d.bundle!.id, d]));
  const installed = [...latest.values()].map((p) => {
    const d = devById.get(p.id);
    return { key: p.hash, bundle: p.bundle, installed: p, dev: d && d.bundle!.hash !== p.hash ? d : null };
  });
  const fresh = [...devById.values()]
    .filter((d) => !latest.has(d.bundle!.id))
    .map((d) => ({ key: `dev:${d.dir}`, bundle: d.bundle!, installed: null, dev: d }));
  return [...installed, ...fresh];
}

/** Box cover colour: the pack's own `ui.cover`, else a stable hue derived from the game id. */
export function coverOf(id: string, bundle?: PackBundle | null): string {
  const own = bundle?.game.ui?.cover;
  if (own) return own;
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 42%)`;
}
