import { parse as parseYaml } from "yaml";
import { csvToRows } from "./csv";
import { GameDef, LocaleTree, type PackBundle, type Row } from "./schema";

export type PackFiles = Record<string, string>;

export class PackError extends Error {
  constructor(readonly issues: string[]) {
    super(issues.join("\n"));
  }
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, stable((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPack(game: GameDef, catalogs: Record<string, Row[]>, locales: Record<string, LocaleTree>) {
  return sha256Hex(JSON.stringify(stable({ game, catalogs, locales })));
}

function parseYamlFile(path: string, src: string): unknown {
  try {
    return parseYaml(src);
  } catch (e) {
    throw new PackError([`${path}: ${(e as Error).message}`]);
  }
}

/** Builds a validated bundle from pack source files keyed by path relative to the pack root. */
export async function loadPack(files: PackFiles): Promise<PackBundle> {
  const issues: string[] = [];
  const gameSrc = files["game.yaml"] ?? files["game.yml"] ?? files["game.json"];
  if (!gameSrc) throw new PackError(["missing game.yaml"]);

  const parsed = GameDef.safeParse(parseYamlFile("game.yaml", gameSrc));
  if (!parsed.success) {
    throw new PackError(parsed.error.issues.map((i) => `game.yaml: ${i.path.join(".")}: ${i.message}`));
  }
  const game = parsed.data;

  const catalogs: Record<string, Row[]> = {};
  for (const [name, def] of Object.entries(game.catalogs)) {
    const src = files[def.file];
    if (src === undefined) {
      issues.push(`catalog ${name}: missing file ${def.file}`);
      continue;
    }
    try {
      catalogs[name] = csvToRows(src, def.columns, def.file);
    } catch (e) {
      issues.push((e as Error).message);
    }
  }

  const locales: Record<string, LocaleTree> = {};
  for (const [path, src] of Object.entries(files)) {
    const m = path.match(/^locales\/([A-Za-z-]+)\.ya?ml$/);
    if (!m) continue;
    const tree = LocaleTree.safeParse(parseYamlFile(path, src) ?? {});
    if (!tree.success) issues.push(`${path}: values must be strings or nested maps`);
    else locales[m[1]] = tree.data;
  }
  if (!locales[game.default_locale]) issues.push(`missing default locale locales/${game.default_locale}.yaml`);

  if (issues.length) throw new PackError(issues);
  return {
    format: 1,
    id: game.id,
    version: game.version,
    hash: await hashPack(game, catalogs, locales),
    game,
    catalogs,
    locales,
  };
}

export async function verifyBundle(bundle: PackBundle): Promise<boolean> {
  return (await hashPack(bundle.game, bundle.catalogs, bundle.locales)) === bundle.hash;
}

/** Parses a built bundle (e.g. an imported .tessera.json) and checks its hash. */
export async function parseBundle(json: string): Promise<PackBundle> {
  const raw = JSON.parse(json);
  if (raw?.format !== 1) throw new PackError(["not a Tessera pack bundle"]);
  const game = GameDef.safeParse(raw.game);
  if (!game.success) throw new PackError(game.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  const bundle: PackBundle = { ...raw, game: game.data };
  if (!(await verifyBundle(bundle))) throw new PackError(["bundle hash mismatch"]);
  return bundle;
}

export function catalogIndex(bundle: PackBundle): Record<string, Map<string, Row>> {
  const out: Record<string, Map<string, Row>> = {};
  for (const [name, rows] of Object.entries(bundle.catalogs)) {
    const key = bundle.game.catalogs[name]?.key ?? "id";
    out[name] = new Map(rows.map((r) => [String(r[key]), r]));
  }
  return out;
}

export function rowEnabled(row: Row, modules: string[]): boolean {
  const m = row.module;
  return m === undefined || m === null || m === "" || modules.includes(String(m));
}
