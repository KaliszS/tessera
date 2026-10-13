<script lang="ts" generics="T extends string | number">
  let {
    options,
    value,
    onchange,
    compact = false,
    label,
  }: {
    options: Array<{ value: T; label: string }>;
    value: T | null;
    onchange: (value: T) => void;
    compact?: boolean;
    label?: string;
  } = $props();
</script>

<div class="segmented" class:compact role="group" aria-label={label}>
  {#each options as o (o.value)}
    <button type="button" aria-pressed={o.value === value} onclick={() => onchange(o.value)}>{o.label}</button>
  {/each}
</div>
