<script lang="ts">
  import Info from "@lucide/svelte/icons/info";
  import type { Snippet } from "svelte";
  import { dismiss } from "./dismiss";

  // A mouse shows the text while hovering; a tap toggles it, and a tap elsewhere or Escape closes it.
  // The text is only rendered while shown.
  let { label, children }: { label: string; children: Snippet } = $props();
  let open = $state(false);
  let hover = $state(false);
</script>

<span
  class="info-tip"
  role="presentation"
  onpointerenter={(e) => (hover = e.pointerType === "mouse")}
  onpointerleave={() => (hover = false)}
  {@attach open && dismiss(() => (open = false))}
>
  <button type="button" class="info-btn" class:active={open} aria-label={label} aria-expanded={open} onclick={() => (open = !open)}>
    <Info size={17} />
  </button>
  {#if open || hover}<span class="info-pop popover" role="tooltip">{@render children()}</span>{/if}
</span>
