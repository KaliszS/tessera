<script lang="ts">
  import type { Snippet } from "svelte";

  let { label, hint, children }: { label: string; hint?: string; children: Snippet } = $props();
</script>

<label class="field">
  <span class="field-label">{label}</span>
  {@render children()}
  {#if hint}<span class="field-hint">{hint}</span>{/if}
</label>
