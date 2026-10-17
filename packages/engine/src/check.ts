import { syntaxError } from "./expr";
import { flattenKeys, lookup } from "./i18n";
import { moduleRefIds } from "./pack";
import type { PackBundle } from "./schema";

export interface CheckResult {
  errors: string[];
  warnings: string[];
}

/** Semantic validation beyond the schema: references, expressions, translations. */
export function checkPack(bundle: PackBundle): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const g = bundle.game;
  const moduleIds = new Set(g.modules.map((m) => m.id));
  const catIds = new Set((g.scoring?.categories ?? []).map((c) => c.id));

  const expr = (where: string, src: string | undefined) => {
    if (!src) return;
    const err = syntaxError(src);
    if (err) errors.push(`${where}: ${err}`);
  };
  const catalog = (where: string, name: string | undefined) => {
    if (name && !g.catalogs[name]) errors.push(`${where}: unknown catalog "${name}"`);
  };

  for (const [name, def] of Object.entries(g.catalogs)) {
    const rows = bundle.catalogs[name] ?? [];
    const seen = new Set<string>();
    rows.forEach((r, i) => {
      const k = r[def.key];
      if (k === null || k === undefined || k === "") errors.push(`${def.file}:${i + 2}: empty key "${def.key}"`);
      else if (seen.has(String(k))) errors.push(`${def.file}:${i + 2}: duplicate key "${k}"`);
      else seen.add(String(k));
      if (r.module && !moduleIds.has(String(r.module))) errors.push(`${def.file}:${i + 2}: unknown module "${r.module}"`);
    });
  }

  const seatKeys = new Map<string, string>();
  const claim = (key: string, what: string) => {
    if (seatKeys.has(key)) errors.push(`seat key "${key}" defined as ${seatKeys.get(key)} and ${what}`);
    seatKeys.set(key, what);
  };
  ["id", "name"].forEach((k) => seatKeys.set(k, "builtin"));
  for (const [k, f] of Object.entries(g.seat.fields)) {
    claim(k, "field");
    catalog(`seat.fields.${k}`, f.catalog);
    expr(`seat.fields.${k}.filter`, f.filter);
    if (f.type === "ref" && !f.catalog) errors.push(`seat.fields.${k}: ref needs a catalog`);
    if (f.type === "enum" && !f.values?.length) errors.push(`seat.fields.${k}: enum needs values`);
    if (f.unique_by && f.catalog && !(bundle.catalogs[f.catalog] ?? []).some((r) => f.unique_by! in r))
      errors.push(`seat.fields.${k}.unique_by: no column "${f.unique_by}" in ${f.catalog}`);
    for (const col of f.variants ?? []) {
      if (f.type !== "ref" || !f.catalog) errors.push(`seat.fields.${k}.variants: only ref fields have variants`);
      else if (!(bundle.catalogs[f.catalog] ?? []).some((r) => col in r))
        errors.push(`seat.fields.${k}.variants: no column "${col}" in ${f.catalog}`);
    }
  }
  for (const [k, c] of Object.entries(g.seat.counters)) {
    claim(k, "counter");
    if (c.module && !moduleIds.has(c.module)) errors.push(`seat.counters.${k}: unknown module "${c.module}"`);
  }
  for (const [k, z] of Object.entries(g.seat.zones)) {
    claim(k, "zone");
    catalog(`seat.zones.${k}`, z.catalog);
    expr(`seat.zones.${k}.filter`, z.filter);
    for (const t of z.capture) if (!g.tracks[t]) errors.push(`seat.zones.${k}.capture: unknown track "${t}"`);
  }
  for (const [k, src] of Object.entries(g.derived)) {
    claim(k, "derived");
    expr(`derived.${k}`, src);
  }
  for (const [cat, table] of Object.entries(g.effects)) {
    catalog(`effects.${cat}`, cat);
    const keys = new Set((bundle.catalogs[cat] ?? []).map((r) => String(r[g.catalogs[cat]?.key ?? "id"])));
    for (const [item, eff] of Object.entries(table)) {
      if (!keys.has(item)) errors.push(`effects.${cat}.${item}: no such row`);
      if (!catIds.has(eff.category)) errors.push(`effects.${cat}.${item}: unknown category "${eff.category}"`);
      expr(`effects.${cat}.${item}`, eff.points);
    }
  }
  for (const m of g.modules) {
    for (const r of m.requires ?? []) if (!moduleIds.has(r)) errors.push(`modules.${m.id}.requires: unknown module "${r}"`);
    if (m.icon?.startsWith("svg:")) warnings.push(`modules.${m.id}.icon: name a ui.icons entry instead of an inline svg`);
  }
  for (const c of g.scoring?.categories ?? []) {
    expr(`scoring.${c.id}`, c.expr);
    if (c.module && !moduleIds.has(c.module)) errors.push(`scoring.${c.id}: unknown module "${c.module}"`);
    if (!c.expr && !c.manual && !Object.values(g.effects).some((t) => Object.values(t).some((e) => e.category === c.id)))
      warnings.push(`scoring.${c.id}: no expr, not manual and no effects feed it`);
  }
  const rounds = g.setup?.rounds;
  if (rounds && !g.tracks[rounds.track]) errors.push(`setup.rounds.track: unknown track "${rounds.track}"`);
  for (const [where, list] of [["setup", g.setup?.sections ?? []], ["setup.rounds", rounds?.sections ?? []]] as const) {
    for (const s of list) {
      catalog(`${where}.${s.id}`, s.catalog);
      expr(`${where}.${s.id}.filter`, s.filter);
      expr(`${where}.${s.id}.copies`, s.copies);
      expr(`${where}.${s.id}.pick_random`, s.pick_random);
      expr(`${where}.${s.id}.when`, s.when);
      expr(`${where}.${s.id}.marks`, s.marks);
      for (const v of Object.values(s.params ?? {})) if (typeof v === "string") expr(`${where}.${s.id}.params`, v);
      if (typeof s.count === "string") expr(`${where}.${s.id}.count`, s.count);
      const piles = (s.layout ?? []).flatMap((item) =>
        item === "arrow" ? [] : "merge" in item ? [...item.merge, item.into] : "group" in item ? item.group : [item],
      ).flatMap((p) => (p.on ? [p, p.on] : [p]));
      for (const item of piles) {
        if (typeof item.count === "string") expr(`${where}.${s.id}.layout`, item.count);
        expr(`${where}.${s.id}.layout`, item.marks);
        for (const glyph of [item.icon, item.symbol])
          if (glyph && !g.ui?.icons[glyph]) warnings.push(`${where}.${s.id}.layout: no ui.icons.${glyph}`);
        for (const m of moduleRefIds(item.module))
          if (!moduleIds.has(m)) errors.push(`${where}.${s.id}.layout: unknown module "${m}"`);
      }
      for (const m of moduleRefIds(s.module))
        if (!moduleIds.has(m)) errors.push(`${where}.${s.id}: unknown module "${m}"`);
      for (const [icon, n] of Object.entries(s.per_player ?? {})) {
        if (typeof n === "string") expr(`${where}.${s.id}.per_player.${icon}`, n);
        if (!g.ui?.icons[icon]) warnings.push(`${where}.${s.id}.per_player: no ui.icons.${icon}, the name is shown instead`);
      }
    }
  }

  const def = bundle.locales[g.default_locale] ?? {};
  const need: string[] = ["name"];
  for (const m of g.modules) need.push(`modules.${m.id}`);
  for (const c of g.scoring?.categories ?? []) need.push(`categories.${c.id}`);
  for (const [name, cdef] of Object.entries(g.catalogs)) {
    const ns = cdef.names ?? name;
    for (const r of bundle.catalogs[name] ?? []) need.push(`${ns}.${r[cdef.key]}`);
  }
  for (const k of need) if (lookup(def, k) === undefined) errors.push(`locales/${g.default_locale}: missing "${k}"`);

  const defKeys = new Set(flattenKeys(def));
  for (const [loc, tree] of Object.entries(bundle.locales)) {
    if (loc === g.default_locale) continue;
    const keys = new Set(flattenKeys(tree));
    const missing = [...defKeys].filter((k) => !keys.has(k));
    if (missing.length) warnings.push(`locales/${loc}: ${missing.length} untranslated keys (e.g. ${missing.slice(0, 3).join(", ")})`);
    const extra = [...keys].filter((k) => !defKeys.has(k));
    if (extra.length) warnings.push(`locales/${loc}: ${extra.length} keys not in ${g.default_locale} (e.g. ${extra.slice(0, 3).join(", ")})`);
  }
  return { errors, warnings };
}
