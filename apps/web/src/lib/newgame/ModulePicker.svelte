<script lang="ts">
  import type { PackBundle } from "@tessera/engine";
  import { i18n } from "../i18n/index.svelte";

  let { bundle, selected = $bindable() }: { bundle: PackBundle; selected: string[] } = $props();
  const tr = $derived(i18n.pack(bundle)!);

  const toggle = (id: string) => (selected = selected.includes(id) ? selected.filter((m) => m !== id) : [...selected, id]);
</script>

<div class="row">
  {#each bundle.game.modules as m (m.id)}
    <button type="button" class="chip" aria-pressed={selected.includes(m.id)} onclick={() => toggle(m.id)}>
      {tr.t(`modules.${m.id}`, undefined, m.id)}
    </button>
  {/each}
</div>
