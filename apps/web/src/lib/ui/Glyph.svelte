<script lang="ts">
  // A pack icon: a short glyph, or `svg:<path>` on a 24×24 grid drawn in the current text colour.
  let { value }: { value: string } = $props();
</script>

{#if value.startsWith("svg:")}
  <svg class="glyph-svg" viewBox="0 0 24 24" aria-hidden="true"><path d={value.slice(4)} /></svg>
{:else}
  <span aria-hidden="true">{value}</span>
{/if}
