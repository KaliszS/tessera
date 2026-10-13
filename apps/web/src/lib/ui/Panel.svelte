<script lang="ts">
  import type { Component, Snippet } from "svelte";

  let {
    title,
    icon: Icon,
    hint,
    actions,
    children,
  }: { title?: string; icon?: Component<{ size?: number }>; hint?: string; actions?: Snippet; children?: Snippet } = $props();
</script>

<section class="panel">
  {#if title || actions}
    <div class="panel-head">
      {#if Icon}<span class="panel-icon"><Icon size={18} /></span>{/if}
      {#if title}<h2>{title}</h2>{/if}
      {@render actions?.()}
    </div>
  {/if}
  {#if hint}<p class="panel-hint">{hint}</p>{/if}
  {@render children?.()}
</section>
