import {
  type FieldDef,
  type GameState,
  type PackBundle,
  type PackTranslator,
  type Row,
  type SeatState,
  compile,
  rowEnabled,
  variantAllowed,
} from "@tessera/engine";

export function colorFor(bundle: PackBundle, catalog: string, row: Row): string | null {
  const by = bundle.game.ui?.catalogs[catalog]?.color_by;
  return by ? (bundle.game.ui?.colors[String(row[by])] ?? null) : null;
}

/** A pack icon by name (a glyph or `svg:<path>`), or undefined when the pack has none. */
export const icon = (bundle: PackBundle, name: string): string | undefined => bundle.game.ui?.icons[name];

/** `[icon:name]` (or the older `{icon:name}`) inside pack texts; the name is the first group. */
export const ICON_TOKEN = /[{[]icon:([a-z0-9_]+)[}\]]/gi;

/** Replaces icon tokens with the pack's glyphs, for plain-text places. */
export const withIcons = (bundle: PackBundle, text: string) => text.replace(ICON_TOKEN, (_, n) => icon(bundle, n) ?? n);

/** A module's mark (a glyph or `svg:` path): the `ui.icons` entry its `icon` names, else one under its id; "" without. */
export function moduleIcon(bundle: PackBundle, module: string): string {
  const name = bundle.game.modules.find((m) => m.id === module)?.icon;
  return (name ? (icon(bundle, name) ?? name) : icon(bundle, module)) ?? "";
}

/** A value of the pack's round track for people: its `values.<track>.<n>` label, else "Track N". */
export function roundLabel(bundle: PackBundle, tr: PackTranslator, round: number): string {
  const track = bundle.game.setup?.rounds?.track;
  if (!track) return String(round);
  return tr.t(`values.${track}.${round}`, undefined, `${tr.t(`tracks.${track}`, undefined, track)} ${round}`);
}

export interface RefChoice {
  id: string;
  name: string;
  /** Marks before the name (its variants, e.g. a sun for a day side) and after it (its expansion). */
  pre: string[];
  post: string[];
}

/** The choices a ref field offers from `rows`: those the host's variants allow, plus the current value so it stays
 * visible, each with the icons that tell its variant and expansion apart. */
export function refChoices(
  bundle: PackBundle,
  tr: PackTranslator,
  state: GameState,
  field: string,
  def: FieldDef,
  rows: Row[],
  current?: unknown,
): RefChoice[] {
  const catalog = def.catalog!;
  const out: RefChoice[] = [];
  for (const row of rows) {
    const id = rowId(bundle, catalog, row);
    if (!variantAllowed(state, field, row) && id !== String(current ?? "")) continue;
    const pre = (def.variants ?? []).map((col) => icon(bundle, String(row[col] ?? "")) ?? "").filter(Boolean);
    const mark = row.module ? moduleIcon(bundle, String(row.module)) : "";
    out.push({ id, name: tr.name(catalog, id), pre, post: mark ? [mark] : [] });
  }
  return out;
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

/** What a catalog filter sees as `$seat`. */
export const seatInput = (seat: SeatState) => ({ id: seat.id, name: seat.name, ...seat.fields, ...seat.counters });

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
