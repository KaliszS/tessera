<script lang="ts">
  import Dices from "@lucide/svelte/icons/dices";
  import Lock from "@lucide/svelte/icons/lock";
  import { type FieldDef, type Row, assignRandomEach, rowEnabled, variantAllowed } from "@tessera/engine";
  import { findRow, refChoices, rowId, seatInput, selectRows } from "../../core/pack-ui";
  import RefSelect from "../../game/RefSelect.svelte";
  import { i18n, t } from "../../i18n/index.svelte";
  import type { GameSession } from "../../sync/session.svelte";
  import Dot from "../../ui/Dot.svelte";
  import Notice from "../../ui/Notice.svelte";
  import Switch from "../../ui/Switch.svelte";
  import { canAssign } from "../seat-actions";
  import { seatLabel } from "../seat-label";
  import { refFields } from "./status";
  import VariantChips from "./VariantChips.svelte";

  let { session }: { session: GameSession } = $props();

  const bundle = $derived(session.bundle!);
  const st = $derived(session.state);
  const tr = $derived(i18n.pack(bundle)!);
  const fields = $derived(refFields(bundle));
  const rowsOf = (catalog: string) => (bundle.catalogs[catalog] ?? []).filter((r) => rowEnabled(r, st.modules));
  // The choices every seat shares, per field; a seat only adds its current value when the variants now hide it.
  const shared = $derived(Object.fromEntries(fields.map(([name, def]) => [name, refChoices(bundle, tr, st, name, def, rowsOf(def.catalog!))])));

  // Fields with a per-seat filter (`$seat`) narrow each seat's choices, as on the seat's board.
  let narrowed = $state.raw<Record<string, Record<string, Set<string>>>>({});
  $effect(() => {
    const filtered = fields.filter(([, def]) => def.filter);
    const seats = st.seats;
    const modules = st.modules;
    if (!filtered.length) return;
    void (async () => {
      const out: Record<string, Record<string, Set<string>>> = {};
      for (const [name, def] of filtered) {
        out[name] = {};
        for (const seat of seats) {
          const rows = await selectRows(bundle, def.catalog!, modules, def.filter, seatInput(seat));
          out[name][seat.id] = new Set(rows.map((r) => rowId(bundle, def.catalog!, r)));
        }
      }
      narrowed = out;
    })();
  });
  const allowedFor = (name: string, seat: string) => narrowed[name]?.[seat];

  function choicesFor(name: string, def: FieldDef, seat: string, current: unknown) {
    const allowed = allowedFor(name, seat);
    const base = allowed ? shared[name].filter((c) => allowed.has(c.id)) : shared[name];
    const row = current == null || base.some((c) => c.id === String(current)) ? undefined : findRow(bundle, def.catalog!, String(current));
    return row ? [...base, ...refChoices(bundle, tr, st, name, def, [row], current)] : base;
  }

  // One event deals every seat a distinct value, so the draw lands at once (or not at all).
  function draw(name: string, def: FieldDef) {
    const rows = rowsOf(def.catalog!).filter((r) => variantAllowed(st, name, r));
    const pools: Row[][] = st.seats.map((seat) => {
      const allowed = allowedFor(name, seat.id);
      return allowed ? rows.filter((r) => allowed.has(rowId(bundle, def.catalog!, r))) : rows;
    });
    const picked = assignRandomEach(pools, def.unique_by);
    const changes = st.seats.flatMap((seat, i) =>
      picked[i] ? [{ seat: seat.id, field: name, value: rowId(bundle, def.catalog!, picked[i]!) }] : [],
    );
    if (changes.length) session.submit({ t: "fields.set", changes });
  }
</script>

<div class="stack-s">
  {#if session.isHost}
    <Switch checked={st.hostAssigns} onchange={(on) => session.submit({ t: "settings.set", host_assigns: on })}>
      <span>{t("lobby.host_assigns")}</span>
    </Switch>
  {:else if st.hostAssigns}
    <Notice kind="accent"><Lock size={18} /><strong>{t("lobby.host_assigns_info")}</strong></Notice>
  {/if}
  {#each fields as [name, def] (name)}
    <div class="row spread">
      <span class="field-label">{tr.t(`fields.${name}`, undefined, name)}</span>
      {#if session.isHost}<button type="button" class="btn btn-s" onclick={() => draw(name, def)}><Dices size={16} />{t("lobby.draw")}</button>{/if}
    </div>
    <VariantChips {session} field={name} {def} />
    <ul class="list">
      {#each st.seats as seat (seat.id)}
        {@const who = seatLabel(st, seat)}
        {@const allowed = canAssign(session, seat)}
        <li class="assign-row">
          <Dot color={seat.color} />
          <span class="assign-name truncate">{who}</span>
          <RefSelect
            label={`${who}: ${tr.t(`fields.${name}`, undefined, name)}`}
            disabled={!allowed}
            title={allowed ? undefined : t(st.hostAssigns ? "lobby.host_assigns" : "lobby.assign_locked")}
            value={seat.fields[name] == null ? null : String(seat.fields[name])}
            choices={choicesFor(name, def, seat.id, seat.fields[name])}
            onchange={(value) => session.submit({ t: "field.set", seat: seat.id, field: name, value })}
          />
        </li>
      {/each}
    </ul>
  {/each}
</div>
