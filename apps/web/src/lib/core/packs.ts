import { type PackBundle, PackError, checkPack, loadPack, parseBundle } from "@tessera/engine";
import { type PackRow, db } from "./db";

export interface DevPack {
  dir: string;
  bundle: PackBundle | null;
  errors: string[];
  warnings: string[];
}

export async function installPack(bundle: PackBundle, source: PackRow["source"]) {
  await db.packs.put({ hash: bundle.hash, id: bundle.id, version: bundle.version, bundle, installedAt: Date.now(), source });
}

export async function listPacks(): Promise<PackRow[]> {
  const rows = await db.packs.toArray();
  return rows.sort((a, b) => a.id.localeCompare(b.id) || b.installedAt - a.installedAt);
}

export async function fetchDevPacks(): Promise<DevPack[]> {
  if (!import.meta.env.DEV) return [];
  const res = await fetch("/__dev/packs");
  return res.ok ? res.json() : [];
}

/** Accepts a built .tessera.json or a selected pack folder (webkitdirectory). */
export async function importPackFiles(files: FileList): Promise<{ bundle: PackBundle; errors: string[]; warnings: string[] }> {
  if (files.length === 1 && files[0].name.endsWith(".json")) {
    const bundle = await parseBundle(await files[0].text());
    return { bundle, ...checkPack(bundle) };
  }
  const map: Record<string, string> = {};
  for (const f of Array.from(files)) {
    const rel = (f.webkitRelativePath || f.name).split("/").slice(1).join("/") || f.name;
    if (/\.(ya?ml|csv|json)$/.test(rel)) map[rel] = await f.text();
  }
  const bundle = await loadPack(map);
  return { bundle, ...checkPack(bundle) };
}

export function describeError(e: unknown): string[] {
  return e instanceof PackError ? e.issues : [(e as Error).message];
}
