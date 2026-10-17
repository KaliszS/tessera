# Game packs

A pack is a directory:

```
games/<id>/
  game.yaml          structure, derived values, scoring, setup
  *.csv              catalogs (cards, boards, ...)
  locales/en.yaml    default locale (required)
  locales/pl.yaml    other locales (optional; fall back pl-PL -> pl -> default)
```

Put `# yaml-language-server: $schema=../../packages/engine/schema/game.schema.json` on the first line of `game.yaml` to get editor completion.
Regenerate the schema with `bun run --cwd packages/engine schema`.
Validate with `bun run pack:check games/<id>`, and build a shareable bundle with `bun run pack:build games/<id>`.

`packages/engine/test/test-pack.ts` holds a minimal complete pack used by the engine tests.

## Players and modules

```yaml
players: { min: 3, max: 7 }
modules:
  - id: cities
    players: { max: 8 }     # while this module is on, the table seats up to 8
```

Each enabled module can widen the range: the lowest `min` and the highest `max` win.
`icon: temple` names the module's mark in `ui.icons` (a glyph or an `svg:` vector): it is shown on its switch, on its components in setup pictures and next to catalog rows that belong to it (e.g. its wonder boards).
`part_of: edifice` marks content of a module's box that works without its rules, e.g. a wonder board: it is offered inside that module's tile, can be switched on alone, and comes on with the module.
`requires: [leaders]` makes a module depend on others, e.g. an expert variant of an expansion: it is only offered, and stays on, while they are on.
The app shows such a variant as a chip inside the tile of the module it requires (the last one listed), with its `ui.icons` glyph when there is one.
The lobby will not start the game outside the range, and the shelf shows the widest range across all modules.

## Catalogs

```yaml
catalogs:
  cards:
    file: cards.csv
    columns: { age: int, players: int_list, cost: string_list, vp: int }
```

Column types are `string` (the default), `int`, `number`, `bool`, `string_list` and `int_list`.
List values are separated with `;`.
Empty cells are omitted from the row, so `$sum(...)` and paths simply skip them.
Lines starting with `#` are comments.
A `module` column limits a row to games where that module is enabled.
Extra columns (notes, confidence) are allowed and ignored.

## Seats

```yaml
tracks:   { age: { min: 1, max: 3 } }                    # game-level values
seat:
  fields:   { board: { type: ref, catalog: boards } }   # ref | enum | number | text
  counters: { coins: { initial: 3, min: 0 }, debt: { module: expansion } }
  zones:
    built:  { catalog: cards, capture: [age], unique: true }
    stages: { catalog: stages, filter: "board = $seat.board", sequential: true }
```

- A `ref` field is an assignment (a board, a faction) chosen in the lobby. `unique_by: wonder` keeps that column distinct across seats when the host draws at random.
- `variants: [side]` lets the host switch values of those catalog columns on or off, for example only day sides. It limits both the choices and random draws. Each value is labelled from `values.<column>.<value>` and gets its glyph from `ui.icons.<value>`.
- A track is a value the whole table shares, such as the current age or round. It starts at `initial`, or at `min` when `initial` is left out.
- `capture` copies track values into each zone entry when it is added, for example the age in which a card was built.
- A `sequential` zone shows a single "add next" button. It takes the next row matching `filter`, in catalog order.

## Expressions (JSONata)

Every expression is evaluated with the seat as its input, so you can write `built`, `coins`, `board` and so on directly.
These bindings are available:

| Binding | Meaning |
| --- | --- |
| `$left`, `$right` | Neighbour seats, in seat order (circular). |
| `$all` | Every seat. |
| `$game` | Track values, `players` and `modules`. |
| `$row(catalog, id)` | Looks up a catalog row. |
| `$card` | In card effects: the card being scored. |
| `$setCollection(counts, wild, bonus)` | Sum of squares, plus `bonus` per complete set; wildcards are placed optimally. |
| `$sum` | Lenient: missing input counts as 0, and non-numbers are skipped. |

`derived` values are computed in the order they are listed, for all seats at once.
Later values can use earlier ones, including the neighbours': `$left.shields_by_age`.

`effects.<catalog>.<row id>` adds points to a scoring category for each owned entry.
`scoring.categories` lists the rows of the score sheet:

- `expr` gives the category's computed value.
- `manual: true` means players type the value in.
- `module` shows the row only when that module is enabled.

Every cell also accepts a manual correction.

### JSONata gotchas

- Filtering an array literal down to one element and then mapping it yields `undefined`: `[0,1,2][$ < 1].($ + 1)`. Use `$map([0..n], function($i) {...})` instead.
- Inside a path step, `$` is the current item. Use `$$` (the seat) or bind it first: `$me := $`.

## Setup

```yaml
setup:
  sections:                         # before the game, in the lobby
    - { id: coins, per_player: { coin: 3 } }
    - { id: bank }                  # a plain step: just its label and help text
  rounds:                           # before each value of a track, during the game
    track: age
    sections:
      - { id: deck, catalog: cards, filter: "age = $round", copies: "$count(players[$ <= $game.players])" }
      - { id: guilds, catalog: cards, filter: "type = 'guild'", pick_random: "$game.players + 2", when: "$round = 3" }
```

A section can combine:

- `catalog` with `filter` and `copies`: the rows to lay out. Long lists start folded.
- `pick_random`: draw that many of those rows. Random picks are logged as events, so every device sees the same draw.
- `per_player`: pieces every player takes, by `ui.icons` name. A count or an expression.
- `module`: the section applies only with this module on (or all modules of a list, or any of `{ any: [cities, edifice] }` for components several expansions share). Layout items take `module` too. `when` (an expression) is the general form.
- `marks`: an expression returning labels shown as badges, for example which player-count marks to take: `"[3..$game.players].($string($) & '+')"`. Piles in a `layout` take `marks` too, written small under the pile, which keeps several decks' marks apart.
- `color`: the colour of the card back or pieces, shown as a small swatch.
- `list: false`: hide the rows and keep only their count, when `marks` already say what to take.
- `count`: the number shown next to the section's title. Without it the app shows the rows' count, the merged decks' total, or the count of the only kind of `per_player` piece. Set it to override, e.g. `"$game.players + 2"` cards to draw. Help texts get it as `{count}`, along with `{players}`.
- `area`: `player` (at each player's place), `components` (shared components to prepare) or `table` (the final picture of the table). It defaults to `player` for sections with `per_player`, else `components`. In the lobby each area used is its own step; `table` sections are pictures, not tasks to tick off.
- A pile's `symbol` (a `ui.icons` name) sits in its corner, e.g. the expansion its cards come from, so the label stays centred.
- A pile's `outline` draws a thin ring in that colour, e.g. to set an expansion's cards apart.
- `shape: disc | flag | pentagon | shield` draws a token in `color` with its `label` (short text) or the `icon` glyph on it, e.g. `{ shape: pentagon, color: "#1f6fd1", label: "−" }`.
- `shape: figure` draws the item's `icon` as a silhouette in its `color`, e.g. a ship or a meeple. An icon may be a vector: `ui.icons.ship: "svg:<path d on a 24×24 grid>"`.
- `size: large` draws a bigger card, e.g. an oversized deck.
- `pattern: grid` draws a blueprint grid on the card's face, e.g. to show it lies project side up.
- A pile with `count: 1` is drawn as a single card (still marked 1), e.g. one drawn card lying face up.
- `on: { ... }` draws another item lying on a pile or board, e.g. participation pawns on a card.
- `shape: board` is a flat player board (taller than a card) with `stripes`, colour bands along its bottom edge; `square` is a square token. `ink` sets the colour of a label.
- `{ group: [items], caption }` draws items side by side with one caption, e.g. the + and − tokens of one kind.
- Items with a `module` get that module's `ui.icons` glyph (or a dot) in their corner, so expansion components stand out.
- `label` is written on an item (a card's label, a token's face) and `caption` under it; both are keys under `layout.` or literal text.
- `layout` items may also be `{ merge: [piles], into: pile }`: decks shuffled into one. With one source on, only that pile is drawn; with more, the sources, an arrow and `into` with their summed count, which is also the section's count.
- `params: { pawns: "[2, 3, 3, 4, 5][$game.players - 3]" }` adds named numbers for the help text, e.g. read from a rules table.
- Help texts receive `{players}`, `{count}`, `{merged}` (piles in the merge) and `{mod_<module>}` (`on`/`off`), so ICU `plural` and `select` can describe exactly what is on the table.
- `layout`: a picture made of `arrow`, card piles (`color`), heaps of pieces (`icon` from `ui.icons`) and empty spots (neither). Each may have a `label` (a key under `layout.` in the locales, or literal text) and a `count` (number or expression), e.g. `[{ color: "#8e24aa", count: "$game.players + 2" }, arrow, { color: "#d4a72c", label: III }]`.

`rounds` sections are shown on the board for the current value of `track`, and `$round` holds that value in every expression.
`when` limits a round section to some rounds.
Players tick each section off; round sections are ticked per round.

## Locales

Keys looked up by the app:

- `name`
- `modules.<id>`, `categories.<id>`, `tracks.<id>`, `fields.<id>`, `counters.<id>`, `zones.<id>`, `derived.<id>`
- `<catalog>.<row id>` (row names), `effects.<row id>` (short effect label), `values.<column>.<value>` (filter chips)
- `setup.<section>`, `setup_help.<section>`, `pieces.<icon>` (name of a `per_player` piece), `layout.<label>` (captions in setup pictures)

Only derived values that have a `derived.<id>` label are shown to players.
Messages use ICU MessageFormat, including plurals.
`[icon:name]` is replaced with the icon from `ui.icons`, vector icons included (the older `{icon:name}` still works where a text has no ICU placeholders). Use the square-bracket form in texts with `{count}` and similar ICU parameters.

## Content rules

Packs may contain numbers, structure, ids and your own short labels.
Do not commit publisher text, art or scans.
`games/` is gitignored; keep packs in a private repository or import them in the app.
