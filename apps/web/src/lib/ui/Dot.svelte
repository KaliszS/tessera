<script lang="ts">
  let { color }: { color: string | null | undefined } = $props();
</script>

<span class="dot" style:background={color ?? "var(--border-strong)"}></span>
