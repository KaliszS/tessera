<script lang="ts">
  import type { PackBundle } from "@tessera/engine";
  import { i18n } from "../i18n/index.svelte";
  import Panel from "../ui/Panel.svelte";

  let { bundle, values }: { bundle: PackBundle; values: Record<string, unknown> } = $props();

  const tr = $derived(i18n.pack(bundle)!);
  const shown = $derived(
    Object.entries(values).filter(([k, v]) => tr.has(`derived.${k}`) && (typeof v === "number" || typeof v === "boolean")),
  );
</script>

{#if shown.length}
  <Panel>
    <div class="grid-2">
      {#each shown as [k, v] (k)}
        <div class="stat">
          <span class="small muted">{tr.t(`derived.${k}`)}</span>
          <span class="stat-value">{typeof v === "boolean" ? (v ? "✓" : "—") : v}</span>
        </div>
      {/each}
    </div>
  </Panel>
{/if}
