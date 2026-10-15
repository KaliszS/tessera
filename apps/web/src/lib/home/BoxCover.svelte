<script lang="ts">
  import type { Snippet } from "svelte";
  import type { PackBundle } from "@tessera/engine";
  import { i18n, t } from "../i18n/index.svelte";
  import { coverOf } from "./shelf";

  let {
    bundle,
    faded = false,
    disabled = false,
    onclick,
    meta,
  }: { bundle: PackBundle; faded?: boolean; disabled?: boolean; onclick: () => void; meta: Snippet } = $props();

  const name = $derived(i18n.packName(bundle));
  const edition = $derived(bundle.game.edition);
</script>

<button
  type="button"
  class="box3d game-box"
  class:faded
  style:--cover={coverOf(bundle.id, bundle)}
  title={edition ? `${name} · ${t("common.edition", { n: edition })}` : name}
  aria-label={name}
  {disabled}
  {onclick}
>
  <span class="game-box-title">{name}</span>
  {#if edition}<span class="box-edition">{t("common.edition", { n: edition })}</span>{/if}
  <span class="game-box-meta">{@render meta()}</span>
</button>
