<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import type { Component, Snippet } from "svelte";

  // With `open` set the panel folds: its head toggles the body (a <details>), e.g. a checklist that closes when done.
  let {
    title,
    icon: Icon,
    hint,
    open,
    actions,
    children,
  }: {
    title?: string;
    icon?: Component<{ size?: number }>;
    hint?: string;
    open?: boolean;
    actions?: Snippet;
    children?: Snippet;
  } = $props();
</script>

{#snippet head(foldable: boolean)}
  {#if Icon}<span class="panel-icon"><Icon size={18} /></span>{/if}
  {#if title}<h2>{title}</h2>{/if}
  {@render actions?.()}
  {#if foldable}<span class="chevron"><ChevronDown size={18} /></span>{/if}
{/snippet}

{#if open === undefined}
  <section class="panel">
    {#if title || actions}<div class="panel-head">{@render head(false)}</div>{/if}
    {#if hint}<p class="panel-hint">{hint}</p>{/if}
    {@render children?.()}
  </section>
{:else}
  <details class="panel foldable" {open}>
    <summary class="panel-head">{@render head(true)}</summary>
    {#if hint}<p class="panel-hint">{hint}</p>{/if}
    {@render children?.()}
  </details>
{/if}
