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

/** A game-level value shared by the whole table (an age, a round, a threat level), not owned by any seat. */
export const TrackDef = z.strictObject({
  /** Starting value; defaults to `min`, else 0. */
  initial: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});

export const FieldDef = z.strictObject({
  type: z.enum(["ref", "enum", "number", "text"]),
  catalog: z.string().optional(),
  /** JSONata predicate over catalog rows, evaluated with the row as input and `$seat` bound. */
  filter: expr.optional(),
  values: z.array(z.string()).optional(),
  /** Random assignment in the lobby keeps this catalog column distinct across seats (e.g. one board per wonder). */
  unique_by: z.string().optional(),
  /** Catalog columns whose values the host switches on or off (all on by default), e.g. a board's day or night side.
   * They limit both the choices and random draws. Labels come from `values.<column>.<value>`, icons from `ui.icons`. */
  // Optional rather than defaulted: bundles saved by older versions lack it.
  variants: z.array(z.string()).optional(),
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

/** One module, all of a list, or `{ any: [...] }` for components several expansions share (e.g. debt tokens). */
export const ModuleRef = z.union([z.string(), z.array(z.string()), z.strictObject({ any: z.array(z.string()).min(1) })]);
export type ModuleRef = z.infer<typeof ModuleRef>;
const moduleRef = ModuleRef;

/** Where a setup section happens: at each player's place, among the shared components, or the final picture of the table. */
export const SETUP_AREAS = ["player", "components", "table"] as const;
export type SetupArea = (typeof SETUP_AREAS)[number];

const LayoutBaseDef = z.strictObject({
  /** Shown only with this module on (or all of these). */
  module: moduleRef.optional(),
  color: z.string().optional(),
  /** A small `ui.icons` glyph in the pile's corner, e.g. the expansion a card comes from. */
  symbol: z.string().optional(),
  /** Labels under the pile, e.g. which player-count marks to take from it: an expression returning strings. */
  marks: expr.optional(),
  /** A thin ring in this colour around a card pile, e.g. to set an expansion's cards apart. */
  outline: z.string().optional(),
  /** `large` draws a bigger card, e.g. an oversized deck. */
  size: z.enum(["large"]).optional(),
  /** A pattern on the card's face, e.g. `grid` for a blueprint, to show which side lies up. */
  pattern: z.enum(["grid"]).optional(),
  /** Draws a token of this shape in `color`, with its `label` or `icon` glyph on it; `board` is a flat player board. */
  shape: z.enum(["disc", "square", "flag", "pentagon", "shield", "board", "figure"]).optional(),
  /** Colour of the label, when the default white would not show. */
  ink: z.string().optional(),
  /** Colour bands along a board's bottom edge, e.g. its tracks. */
  stripes: z.array(z.string()).max(8).optional(),
  /** Text under the item (a key under `layout.` or literal). */
  caption: z.string().max(24).optional(),
  icon: z.string().optional(),
  /** Text on the item: a card's label or a token's face (a key under `layout.` or literal, may hold `[icon:name]`). */
  label: z.string().max(24).optional(),
  count: z.union([z.number(), expr]).optional(),
}).meta({ id: "LayoutBase" });

/** A pile, token, heap or spot; `on` draws another item lying on it, e.g. pawns on a card or a marker on a board. */
const LayoutPileDef = LayoutBaseDef.extend({ on: LayoutBaseDef.optional() }).meta({ id: "LayoutPile" });
export type LayoutPileDef = z.infer<typeof LayoutPileDef>;

/** One element of a setup picture: "arrow", a card pile (`color`), a token (`shape`), a heap of pieces (`icon`),
 * or an empty spot (none of these). `label` is written on it, `caption` under it, `count` puts a number on it. */
export const LayoutItemDef = z.union([
  z.literal("arrow"),
  /** Items drawn side by side with one caption under them, e.g. the + and − tokens of one kind. */
  z.strictObject({ group: z.array(LayoutPileDef).min(1), caption: z.string().max(24).optional(), module: moduleRef.optional() }),
  /** Piles shuffled into one: drawn as sources → arrow → `into` (counts summed), or as a single pile when only one source is on. */
  z.strictObject({ merge: z.array(LayoutPileDef).min(1), into: LayoutPileDef }),
  LayoutPileDef,
]);

export const SetupSectionDef = z.strictObject({
  id,
  /** The section applies only with this module on (or all of these). */
  module: moduleRef.optional(),
  catalog: z.string().optional(),
  filter: expr.optional(),
  copies: expr.optional(),
  pick_random: expr.optional(),
  /** Pieces every player takes, keyed by `ui.icons` name: a count or an expression (e.g. `{ coin: 3 }`). */
  per_player: z.record(z.string(), z.union([z.number(), expr])).optional(),
  /** Named numbers for the help text, e.g. `{ pawns: "[2, 3, 3, 4, 5][$game.players - 3]" }` read from a rules table. */
  params: z.record(z.string(), z.union([z.number(), expr])).optional(),
  /** The section applies when this is true (with `$round` in round sections). */
  when: expr.optional(),
  /** Labels shown as badges, e.g. which player-count marks to take: an expression returning strings. */
  marks: expr.optional(),
  /** Colour of the card back or pieces this section is about, shown as a small swatch. */
  color: z.string().optional(),
  /** `false` hides the catalog rows and keeps only their count (e.g. when the marks say what to take). */
  list: z.boolean().optional(),
  /** Where it happens: at each player's place, among the shared components, or the final picture of the table.
   * Defaults to `player` with `per_player`, else `components`. Table sections are shown as pictures, not ticked off. */
  area: z.enum(SETUP_AREAS).optional(),
  /** Number shown on the section (e.g. how many guilds to take); defaults to the catalog rows' count. Also `{count}` in help. */
  count: z.union([z.number(), expr]).optional(),
  /** A picture of what goes where, e.g. decks, an empty discard spot and heaps of tokens, or "draw 6 → into deck III". */
  layout: z.array(LayoutItemDef).optional(),
});

export const GameDef = z.strictObject({
  format: z.literal(1),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  version: z.string(),
  /** Edition of the physical game, shown next to the name (e.g. 2 -> "2ed"). */
  edition: z.number().int().positive().optional(),
  default_locale: z.string().default("en"),
  players: z.strictObject({ min: z.number().int().min(1), max: z.number().int() }),
  modules: z
    .array(
      z.strictObject({
        id,
        default: z.boolean().default(false),
        /** Modules this one needs; it is switched off whenever one of them is off (e.g. an expert variant of an expansion). */
        requires: z.array(id).optional(),
        /** Content from another module's box that can be used without that module's rules (e.g. one of its wonder boards):
         * shown inside that module's tile, and switched on with it. */
        part_of: id.optional(),
        /** The module's mark, a `ui.icons` name (or a literal glyph): shown on its switch, on its components in setup
         * pictures and next to its catalog rows. */
        icon: z.string().max(32).optional(),
        /** Widens the player range while the module is on (e.g. `{ max: 8 }` for an extra player). */
        players: z.strictObject({ min: z.number().int().min(1).optional(), max: z.number().int().optional() }).optional(),
      }),
    )
    .default([]),
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
  setup: z
    .strictObject({
      /** Done once, before the game. */
      sections: z.array(SetupSectionDef).default([]),
      /** Done before each value of a track (e.g. before every age), shown during the game. */
      rounds: z.strictObject({ track: z.string(), sections: z.array(SetupSectionDef) }).optional(),
    })
    .optional(),
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
      /** Icon name -> short glyph, used for badges and {icon:name} placeholders; `svg:<path>` is a 24×24 vector
       * drawn in the item's colour (e.g. a `figure` token such as a ship or a meeple). */
      icons: z.record(z.string(), z.string()).default({}),
      /** Box cover colour (CSS); generated from the game id when absent. */
      cover: z.string().optional(),
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
