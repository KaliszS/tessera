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

/** Installed packs first; dev packs whose exact version is not installed are shown as installable. */
export function shelfItems(installed: PackRow[], dev: DevPack[]): ShelfItem[] {
  const hashes = new Set(installed.map((p) => p.hash));
  return [
    ...installed.map((p) => ({ key: p.hash, bundle: p.bundle, installed: p, dev: null })),
    ...dev
      .filter((d): d is DevPack & { bundle: PackBundle } => !!d.bundle && !hashes.has(d.bundle.hash))
      .map((d) => ({ key: `dev:${d.dir}`, bundle: d.bundle, installed: null, dev: d })),
  ];
}

/** Stable cover hue per game id. */
export function hueOf(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
