<script lang="ts">
  import Download from "@lucide/svelte/icons/download";
  import Users from "@lucide/svelte/icons/users";
  import { t } from "../i18n/index.svelte";
  import BoxCover from "./BoxCover.svelte";
  import type { ShelfItem } from "./shelf";

  let { item, onopen }: { item: ShelfItem; onopen: () => void } = $props();

  const players = $derived(item.bundle.game.players);
</script>

<div class="shelf-item">
  <BoxCover bundle={item.bundle} faded={!item.installed} onclick={onopen}>
    {#snippet meta()}
      {#if item.installed}<Users size={12} />{players.min}–{players.max}{:else}<Download size={12} />{t("home.install")}{/if}
    {/snippet}
  </BoxCover>
</div>
