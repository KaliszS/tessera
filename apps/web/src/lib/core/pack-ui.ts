import { type PackBundle, type Row, compile, rowEnabled } from "@tessera/engine";

export function colorFor(bundle: PackBundle, catalog: string, row: Row): string | null {
  const by = bundle.game.ui?.catalogs[catalog]?.color_by;
  return by ? (bundle.game.ui?.colors[String(row[by])] ?? null) : null;
}

const icon = (bundle: PackBundle, name: string) => bundle.game.ui?.icons[name];

/** Replaces {icon:name} placeholders with the pack's glyphs. */
export function withIcons(bundle: PackBundle, text: string): string {
  return text.replace(/\{icon:([a-z0-9_]+)\}/gi, (_, n) => icon(bundle, n) ?? n);
}

export function badgesFor(bundle: PackBundle, catalog: string, row: Row): Array<{ text: string; title: string }> {
  const cols = bundle.game.ui?.catalogs[catalog]?.badges ?? [];
  const out: Array<{ text: string; title: string }> = [];
  for (const col of cols) {
    const v = row[col];
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    const glyph = icon(bundle, col);
    if (typeof v === "number") out.push({ text: `${glyph ?? `${col} `}${v}`, title: col });
    else if (Array.isArray(v)) out.push({ text: v.map((x) => icon(bundle, String(x)) ?? String(x)).join(""), title: col });
    else {
      const parts = String(v).split("/").map((x) => icon(bundle, x) ?? x);
      out.push({ text: `${glyph ?? ""}${parts.join("/")}`, title: col });
    }
  }
  return out;
}

export function filterValues(bundle: PackBundle, catalog: string, rows: Row[]): Record<string, string[]> {
  const cols = bundle.game.ui?.catalogs[catalog]?.filter_by ?? [];
  const out: Record<string, string[]> = {};
  for (const c of cols) {
    const vals = new Set<string>();
    for (const r of rows) if (r[c] !== undefined && r[c] !== null) vals.add(String(r[c]));
    out[c] = [...vals].sort((a, b) => (Number(a) - Number(b)) || a.localeCompare(b));
  }
  return out;
}

export const keyOf = (bundle: PackBundle, catalog: string) => bundle.game.catalogs[catalog]?.key ?? "id";

export const rowId = (bundle: PackBundle, catalog: string, row: Row) => String(row[keyOf(bundle, catalog)]);

export function findRow(bundle: PackBundle, catalog: string, id: string): Row | undefined {
  const key = keyOf(bundle, catalog);
  return bundle.catalogs[catalog]?.find((r) => String(r[key]) === id);
}

/** Catalog rows enabled by the active modules and matching an optional JSONata predicate (with `$seat`). */
export async function selectRows(
  bundle: PackBundle,
  catalog: string,
  modules: string[],
  filter?: string,
  seat?: Record<string, unknown>,
): Promise<Row[]> {
  const rows = (bundle.catalogs[catalog] ?? []).filter((r) => rowEnabled(r, modules));
  if (!filter) return rows;
  const expr = compile(filter);
  const keep: Row[] = [];
  for (const r of rows) if (await expr.evaluate(r, { seat })) keep.push(r);
  return keep;
}
