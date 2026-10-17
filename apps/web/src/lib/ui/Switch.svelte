<script lang="ts">
  import type { Snippet } from "svelte";

  // An on/off switch with its label; `small` is the compact pill used for a module's variants.
  let {
    checked,
    disabled = false,
    title,
    small = false,
    onchange,
    children,
  }: { checked: boolean; disabled?: boolean; title?: string; small?: boolean; onchange: (on: boolean) => void; children: Snippet } =
    $props();
</script>

<button type="button" class="toggle-item" class:small role="switch" aria-checked={checked} {disabled} {title} onclick={() => onchange(!checked)}>
  <span class="switch" aria-hidden="true"></span>
  {@render children()}
</button>
