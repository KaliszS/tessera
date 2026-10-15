import type { PackBundle } from "@tessera/engine";
import type { PackRow } from "../core/db";
import type { DevPack } from "../core/packs";

export interface ShelfItem {
  key: string;
  bundle: PackBundle;
  installed: PackRow | null;
  /** A local dev pack that is not installed (or differs from the installed one). */
  dev: DevPack | null;
}

/** Newest installed version per game first; dev packs whose exact version is not installed are installable. */
export function shelfItems(all: PackRow[], dev: DevPack[]): ShelfItem[] {
  const latest = new Map<string, PackRow>();
  for (const p of all) if ((latest.get(p.id)?.installedAt ?? -1) < p.installedAt) latest.set(p.id, p);
  const installed = [...latest.values()];
  const hashes = new Set(installed.map((p) => p.hash));
  return [
    ...installed.map((p) => ({ key: p.hash, bundle: p.bundle, installed: p, dev: null })),
    ...dev
      .filter((d): d is DevPack & { bundle: PackBundle } => !!d.bundle && !hashes.has(d.bundle.hash))
      .map((d) => ({ key: `dev:${d.dir}`, bundle: d.bundle, installed: null, dev: d })),
  ];
}

/** Box cover colour: the pack's own `ui.cover`, else a stable hue derived from the game id. */
export function coverOf(id: string, bundle?: PackBundle | null): string {
  const own = bundle?.game.ui?.cover;
  if (own) return own;
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 42%)`;
}
