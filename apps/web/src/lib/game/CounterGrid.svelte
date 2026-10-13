<script lang="ts">
  import type { CounterDef, PackBundle } from "@tessera/engine";
  import { i18n } from "../i18n/index.svelte";
  import { askNumber } from "../ui/dialog.svelte";
  import Panel from "../ui/Panel.svelte";
  import Stepper from "../ui/Stepper.svelte";

  let {
    bundle,
    counters,
    values,
    onadd,
    onset,
  }: {
    bundle: PackBundle;
    counters: Array<[string, CounterDef]>;
    values: Record<string, number>;
    onadd: (counter: string, delta: number) => void;
    onset: (counter: string, value: number) => void;
  } = $props();

  const tr = $derived(i18n.pack(bundle)!);

  async function edit(name: string) {
    const label = tr.t(`counters.${name}`, undefined, name);
    const v = await askNumber(label, values[name] ?? 0);
    if (v !== null) onset(name, v);
  }
</script>

<Panel>
  <div class="grid-2">
    {#each counters as [name, def] (name)}
      <div class="counter-tile">
        <span class="field-label">{tr.t(`counters.${name}`, undefined, name)}</span>
        <Stepper
          label={tr.t(`counters.${name}`, undefined, name)}
          value={values[name] ?? def.initial}
          step={def.step}
          onadd={(d) => onadd(name, d)}
          onedit={() => edit(name)}
        />
      </div>
    {/each}
  </div>
</Panel>
