<script lang="ts">
  let { name, color, mine = false, empty = false }: { name: string; color: string | null | undefined; mine?: boolean; empty?: boolean } =
    $props();
</script>

<span class="avatar-disc" class:mine class:vacant={empty} style:--c={color ?? "var(--border-strong)"} title={name}>
  {name.charAt(0)}
</span>
