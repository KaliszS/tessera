<script lang="ts">
  import type { RefChoice } from "../core/pack-ui";
  import Glyph from "../ui/Glyph.svelte";
  import { dismiss } from "../ui/dismiss";

  // A dropdown for catalog choices that, unlike a native select, can draw the pack's vector icons.
  let {
    choices,
    value,
    label,
    disabled = false,
    title,
    onchange,
  }: {
    choices: RefChoice[];
    value: string | null;
    label: string;
    disabled?: boolean;
    title?: string;
    onchange: (id: string | null) => void;
  } = $props();

  let open = $state(false);
  const current = $derived(choices.find((c) => c.id === value) ?? null);

  function pick(id: string | null) {
    open = false;
    if (id !== value) onchange(id);
  }
</script>

{#snippet choice(c: RefChoice)}
  <span class="ref-choice">
    {#each c.pre as g, i (i)}<Glyph value={g} />{/each}
    <span class="truncate">{c.name}</span>
    {#each c.post as g, i (i)}<span class="ref-post"><Glyph value={g} /></span>{/each}
  </span>
{/snippet}

<div class="ref-select" {@attach open && dismiss(() => (open = false))}>
  <button
    type="button"
    class="select ref-select-btn"
    {disabled}
    {title}
    aria-label={label}
    aria-haspopup="listbox"
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    {#if current}{@render choice(current)}{:else}<span class="muted">-</span>{/if}
  </button>
  {#if open}
    <ul class="ref-select-list popover" role="listbox" aria-label={label}>
      <li><button type="button" role="option" aria-selected={!current} onclick={() => pick(null)}>-</button></li>
      {#each choices as c (c.id)}
        <li>
          <button type="button" role="option" aria-selected={c.id === value} onclick={() => pick(c.id)}>{@render choice(c)}</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
