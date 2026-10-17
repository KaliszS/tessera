<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import type { Snippet } from "svelte";

  let {
    index,
    title,
    summary,
    done,
    current,
    open = $bindable(),
    children,
  }: { index: number; title: string; summary: string; done: boolean; current: boolean; open: boolean; children: Snippet } = $props();
</script>

<li class="step" class:done class:current class:open>
  <button type="button" class="step-head" aria-expanded={open} onclick={() => (open = !open)}>
    <span class="step-dot">{#if done}<Check size={16} strokeWidth={3} />{:else}{index}{/if}</span>
    <span class="step-text">
      <span class="step-title">{title}</span>
      {#if !open}<span class="step-summary truncate">{summary}</span>{/if}
    </span>
    <span class="chevron"><ChevronDown size={18} /></span>
  </button>
  {#if open}<div class="step-body enter">{@render children()}</div>{/if}
</li>
