<script lang="ts">
  let { color, large = false }: { color: string | null | undefined; large?: boolean } = $props();
</script>

<span class="dot" class:dot-l={large} style:background={color ?? "var(--border-strong)"}></span>
