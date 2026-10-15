<script lang="ts">
  import Users from "@lucide/svelte/icons/users";
  import type { PackRow } from "../core/db";
  import BoxCover from "../home/BoxCover.svelte";
  import { t } from "../i18n/index.svelte";

  let { packs, disabled = false, onpick }: { packs: PackRow[]; disabled?: boolean; onpick: (pack: PackRow) => void } = $props();
</script>

<div class="shelf" role="group" aria-label={t("new.game")}>
  <div class="shelf-row">
    {#each packs as p (p.hash)}
      {@const players = p.bundle.game.players}
      <div class="shelf-item">
        <BoxCover bundle={p.bundle} {disabled} onclick={() => onpick(p)}>
          {#snippet meta()}<Users size={12} />{players.min}–{players.max}{/snippet}
        </BoxCover>
      </div>
    {/each}
  </div>
  <div class="shelf-plank"></div>
</div>
