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
tracks:   { age: { initial: 1, min: 1, max: 3 } }        # game-level values
seat:
  fields:   { board: { type: ref, catalog: boards } }   # ref | enum | number | text
  counters: { coins: { initial: 3, min: 0 }, debt: { module: expansion } }
  zones:
    built:  { catalog: cards, capture: [age], unique: true }
    stages: { catalog: stages, filter: "board = $seat.board", sequential: true }
```

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
  sections:
    - { id: age1, catalog: cards, filter: "age = 1", copies: "$count(players[$ <= $game.players])" }
    - { id: guilds, catalog: cards, filter: "type = 'guild'", pick_random: "$game.players + 2" }
```

Random picks are logged as events, so every device sees the same draw.

## Locales

Keys looked up by the app:

- `name`
- `modules.<id>`, `categories.<id>`, `tracks.<id>`, `fields.<id>`, `counters.<id>`, `zones.<id>`, `derived.<id>`
- `<catalog>.<row id>` (row names), `effects.<row id>` (short effect label), `values.<column>.<value>` (filter chips)
- `setup.<section>`, `setup_help.<section>`

Only derived values that have a `derived.<id>` label are shown to players.
Messages use ICU MessageFormat, including plurals.
`{icon:name}` is replaced with the glyph from `ui.icons`.

## Content rules

Packs may contain numbers, structure, ids and your own short labels.
Do not commit publisher text, art or scans.
`games/` is gitignored; keep packs in a private repository or import them in the app.
