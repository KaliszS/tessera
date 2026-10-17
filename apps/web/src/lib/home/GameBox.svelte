<script lang="ts">
  import Download from "@lucide/svelte/icons/download";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Users from "@lucide/svelte/icons/users";
  import { widestPlayerRange } from "@tessera/engine";
  import { t } from "../i18n/index.svelte";
  import BoxCover from "./BoxCover.svelte";
  import type { ShelfItem } from "./shelf";

  let { item, onopen }: { item: ShelfItem; onopen: () => void } = $props();

  // The widest table the game supports, expansions included.
  const players = $derived(widestPlayerRange(item.bundle.game));
</script>

<div class="shelf-item">
  <BoxCover bundle={item.bundle} faded={!item.installed} onclick={onopen}>
    {#snippet meta()}
      {#if !item.installed}<Download size={12} />{t("home.install")}
      {:else if item.dev}<RefreshCw size={12} />{t("home.update_badge")}
      {:else}<Users size={12} />{players.min}-{players.max}{/if}
    {/snippet}
  </BoxCover>
</div>
