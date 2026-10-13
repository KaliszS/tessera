<script lang="ts">
  import type { Component } from "svelte";

  let {
    icon: Icon,
    label,
    title,
    value,
    used,
    limit,
  }: { icon: Component<{ size?: number }>; label: string; title?: string; value: string; used: number | null; limit: number } = $props();

  const pct = $derived(used === null ? 0 : (100 * used) / limit);
</script>

<div class="meter-row" title={title ?? label}>
  <span class="meter-icon"><Icon size={16} /></span>
  <span class="truncate">{label}</span>
  <span class="num strong">{value}</span>
  <div class="meter" class:meter-high={pct >= 80}><div style:width="{Math.min(100, Math.max(used ? 0.5 : 0, pct))}%"></div></div>
</div>
