<script lang="ts">
  import type { GameEvent, Row, SeatState, SeatView } from "@tessera/engine";
  import { selectRows } from "../core/pack-ui";
  import { randomId } from "../core/util";
  import type { GameSession } from "../sync/session.svelte";
  import Panel from "../ui/Panel.svelte";
  import CounterGrid from "./CounterGrid.svelte";
  import DerivedStats from "./DerivedStats.svelte";
  import FieldEditor from "./FieldEditor.svelte";
  import ZoneSection from "./ZoneSection.svelte";

  let { session, seat, view }: { session: GameSession; seat: SeatState; view: SeatView | undefined } = $props();

  const bundle = $derived(session.bundle!);
  const def = $derived(bundle.game.seat);
  const st = $derived(session.state);
  const counters = $derived(Object.entries(def.counters).filter(([, c]) => !c.module || st.modules.includes(c.module)));
  let options = $state.raw<Record<string, Row[]>>({});

  $effect(() => {
    const seatInput = { id: seat.id, name: seat.name, ...seat.fields, ...seat.counters };
    const modules = st.modules;
    void (async () => {
      const out: Record<string, Row[]> = {};
      for (const [k, f] of Object.entries(def.fields)) {
        if (f.type === "ref" && f.catalog) out[`field:${k}`] = await selectRows(bundle, f.catalog, modules, f.filter, seatInput);
      }
      for (const [k, z] of Object.entries(def.zones)) out[`zone:${k}`] = await selectRows(bundle, z.catalog, modules, z.filter, seatInput);
      options = out;
    })();
  });

  const submit = (e: GameEvent) => session.submit(e);
</script>

<div class="stack tab-panel">
  {#if Object.keys(def.fields).length}
    <Panel>
      {#each Object.entries(def.fields) as [name, f] (name)}
        <FieldEditor
          {bundle}
          {name}
          def={f}
          value={seat.fields[name] ?? null}
          options={options[`field:${name}`] ?? []}
          onset={(value) => submit({ t: "field.set", seat: seat.id, field: name, value })}
        />
      {/each}
    </Panel>
  {/if}

  {#if counters.length}
    <CounterGrid
      {bundle}
      {counters}
      values={seat.counters}
      onadd={(counter, delta) => submit({ t: "counter.add", seat: seat.id, counter, delta })}
      onset={(counter, value) => submit({ t: "counter.set", seat: seat.id, counter, value })}
    />
  {/if}

  {#each Object.entries(def.zones) as [name, z] (name)}
    <ZoneSection
      {bundle}
      {name}
      def={z}
      entries={seat.zones[name] ?? []}
      options={options[`zone:${name}`] ?? []}
      tracks={st.tracks}
      onadd={(item) => submit({ t: "zone.add", seat: seat.id, zone: name, item, entry: randomId("e", 10) })}
      onremove={(entry) => submit({ t: "zone.remove", seat: seat.id, zone: name, entry })}
    />
  {/each}

  <DerivedStats {bundle} values={view?.values ?? {}} />
</div>
