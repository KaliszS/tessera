<script lang="ts">
  import Download from "@lucide/svelte/icons/download";
  import Users from "@lucide/svelte/icons/users";
  import { i18n, t } from "../i18n/index.svelte";
  import { type ShelfItem, hueOf } from "./shelf";

  let { item, onopen }: { item: ShelfItem; onopen: () => void } = $props();

  const players = $derived(item.bundle.game.players);
</script>

<div class="shelf-item">
  <button
    type="button"
    class="game-box"
    class:available={!item.installed}
    style:--hue={hueOf(item.bundle.id)}
    title={i18n.packName(item.bundle)}
    aria-label={i18n.packName(item.bundle)}
    onclick={onopen}
  >
    <span class="game-box-title">{i18n.packName(item.bundle)}</span>
    <span class="game-box-meta">
      {#if item.installed}<Users size={12} />{players.min}–{players.max}{:else}<Download size={12} />{t("home.install")}{/if}
    </span>
  </button>
</div>
