<script lang="ts">
  import type { Snippet } from "svelte";
  import type { PackBundle, Row } from "@tessera/engine";
  import { badgesFor, colorFor, rowId, withIcons } from "../core/pack-ui";
  import { i18n } from "../i18n/index.svelte";

  let {
    bundle,
    catalog,
    row,
    meta = "",
    onclick,
    disabled = false,
    trailing,
  }: {
    bundle: PackBundle;
    catalog: string;
    row: Row;
    meta?: string;
    onclick?: () => void;
    disabled?: boolean;
    trailing?: Snippet;
  } = $props();

  const tr = $derived(i18n.pack(bundle)!);
  const id = $derived(rowId(bundle, catalog, row));
  const effect = $derived(tr.has(`effects.${id}`) ? withIcons(bundle, tr.t(`effects.${id}`)) : "");
  const badges = $derived(badgesFor(bundle, catalog, row));
</script>

{#snippet body()}
  <span class="game-card-body">
    <span class="game-card-name">{tr.name(catalog, id)}{#if meta}<span class="game-card-meta">{meta}</span>{/if}</span>
    {#if effect}<span class="game-card-effect">{effect}</span>{/if}
    {#if badges.length}
      <span class="game-card-badges">{#each badges as b, i (i)}<span class="badge" title={b.title}>{b.text}</span>{/each}</span>
    {/if}
  </span>
{/snippet}

{#if onclick}
  <button type="button" class="game-card" style:--c={colorFor(bundle, catalog, row)} {onclick} {disabled}>
    {@render body()}
    {@render trailing?.()}
  </button>
{:else}
  <div class="game-card" style:--c={colorFor(bundle, catalog, row)}>
    {@render body()}
    {@render trailing?.()}
  </div>
{/if}
