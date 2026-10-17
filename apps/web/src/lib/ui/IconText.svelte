<script lang="ts">
  import type { PackBundle } from "@tessera/engine";
  import { ICON_TOKEN, icon } from "../core/pack-ui";
  import Glyph from "./Glyph.svelte";

  // A pack text with its icon tokens drawn as the pack's icons (glyphs or vectors), e.g. in help texts and card labels.
  let { bundle, text }: { bundle: PackBundle; text: string } = $props();
  // Splitting on a pattern with one group alternates text and icon names.
  const parts = $derived(text.split(ICON_TOKEN));
</script>

{#each parts as part, i (i)}{#if i % 2}<Glyph value={icon(bundle, part) ?? part} />{:else}{part}{/if}{/each}
