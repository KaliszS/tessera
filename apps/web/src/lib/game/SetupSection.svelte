<script lang="ts">
  import Dices from "@lucide/svelte/icons/dices";
  import type { PackBundle, SetupSection } from "@tessera/engine";
  import { i18n, t } from "../i18n/index.svelte";
  import Panel from "../ui/Panel.svelte";

  let { bundle, section, catalog, ondraw }: { bundle: PackBundle; section: SetupSection; catalog: string; ondraw: () => void } =
    $props();

  const tr = $derived(i18n.pack(bundle)!);
  const total = $derived(section.items.reduce((a, i) => a + i.copies, 0));
  const hint = $derived(tr.has(`setup_help.${section.id}`) ? tr.t(`setup_help.${section.id}`) : undefined);
</script>

<Panel title="{tr.t(`setup.${section.id}`, undefined, section.id)} · {total}" {hint}>
  {#snippet actions()}
    {#if section.random}
      <button type="button" class="btn btn-s" onclick={ondraw}>
        <Dices size={16} />{section.random.picked ? t("setup.redraw") : t("setup.draw", { count: section.random.count })}
      </button>
    {/if}
  {/snippet}
  {#if !section.random || section.random.picked}
    <ul class="setup-items">
      {#each section.items as it (it.id)}
        <li>{tr.name(catalog, it.id)}{#if it.copies > 1} <strong>×{it.copies}</strong>{/if}</li>
      {/each}
    </ul>
  {/if}
</Panel>
