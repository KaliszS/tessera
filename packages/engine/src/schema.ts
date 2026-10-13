import { z } from "zod";

const id = z.string().regex(/^[a-z][a-z0-9_]*$/, "lower_snake_case id");
const expr = z.string().min(1);

export const ColumnType = z.enum(["string", "int", "number", "bool", "string_list", "int_list"]);
export type ColumnType = z.infer<typeof ColumnType>;

export const CatalogDef = z.strictObject({
  file: z.string(),
  key: z.string().default("id"),
  columns: z.record(z.string(), ColumnType).default({}),
  /** Locale namespace for row names; defaults to the catalog id. */
  names: z.string().optional(),
});

export const TrackDef = z.strictObject({
  initial: z.number().default(0),
  min: z.number().optional(),
  max: z.number().optional(),
});

export const FieldDef = z.strictObject({
  type: z.enum(["ref", "enum", "number", "text"]),
  catalog: z.string().optional(),
  /** JSONata predicate over catalog rows, evaluated with the row as input and `$seat` bound. */
  filter: expr.optional(),
  values: z.array(z.string()).optional(),
});

export const CounterDef = z.strictObject({
  initial: z.number().default(0),
  /** Only shown when this module is enabled. */
  module: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().default(1),
});

export const ZoneDef = z.strictObject({
  catalog: z.string(),
  /** Track values copied into each entry when it is added (e.g. the current age). */
  capture: z.array(z.string()).default([]),
  unique: z.boolean().default(false),
  /** Entries come from catalog rows matching this predicate, taken in catalog order. */
  filter: expr.optional(),
  sequential: z.boolean().default(false),
});

export const CategoryDef = z.strictObject({
  id,
  expr: expr.optional(),
  module: z.string().optional(),
  manual: z.boolean().default(false),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const EffectDef = z.strictObject({
  category: z.string(),
  points: expr,
});

export const SetupSectionDef = z.strictObject({
  id,
  catalog: z.string().optional(),
  filter: expr.optional(),
  copies: expr.optional(),
  pick_random: expr.optional(),
  group_by: z.string().optional(),
});

export const GameDef = z.strictObject({
  format: z.literal(1),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  version: z.string(),
  default_locale: z.string().default("en"),
  players: z.strictObject({ min: z.number().int().min(1), max: z.number().int() }),
  modules: z.array(z.strictObject({ id, default: z.boolean().default(false) })).default([]),
  catalogs: z.record(id, CatalogDef).default({}),
  tracks: z.record(id, TrackDef).default({}),
  seat: z
    .strictObject({
      fields: z.record(id, FieldDef).default({}),
      counters: z.record(id, CounterDef).default({}),
      zones: z.record(id, ZoneDef).default({}),
    })
    .default({ fields: {}, counters: {}, zones: {} }),
  derived: z.record(id, expr).default({}),
  effects: z.record(z.string(), z.record(z.string(), EffectDef)).default({}),
  scoring: z
    .strictObject({
      categories: z.array(CategoryDef),
      manual_adjust: z.boolean().default(true),
    })
    .optional(),
  setup: z.strictObject({ sections: z.array(SetupSectionDef) }).optional(),
  ui: z
    .strictObject({
      catalogs: z
        .record(
          z.string(),
          z.strictObject({
            color_by: z.string().optional(),
            badges: z.array(z.string()).default([]),
            filter_by: z.array(z.string()).default([]),
          }),
        )
        .default({}),
      /** Column value -> CSS color, e.g. card type -> colour of the card. */
      colors: z.record(z.string(), z.string()).default({}),
      /** Icon name -> short glyph, used for badges and {icon:name} placeholders. */
      icons: z.record(z.string(), z.string()).default({}),
    })
    .optional(),
});

export type GameDef = z.infer<typeof GameDef>;
export type CatalogDef = z.infer<typeof CatalogDef>;
export type ZoneDef = z.infer<typeof ZoneDef>;
export type FieldDef = z.infer<typeof FieldDef>;
export type CounterDef = z.infer<typeof CounterDef>;
export type CategoryDef = z.infer<typeof CategoryDef>;
export type SetupSectionDef = z.infer<typeof SetupSectionDef>;

export type LocaleTree = { [key: string]: string | LocaleTree };
export const LocaleTree: z.ZodType<LocaleTree> = z.lazy(() =>
  z.record(z.string(), z.union([z.string(), LocaleTree])),
);

export type Row = Record<string, string | number | boolean | string[] | number[] | null>;

export interface PackBundle {
  format: 1;
  id: string;
  version: string;
  hash: string;
  game: GameDef;
  catalogs: Record<string, Row[]>;
  locales: Record<string, LocaleTree>;
}
