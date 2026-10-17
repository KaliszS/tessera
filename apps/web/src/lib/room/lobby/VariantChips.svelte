<script lang="ts">
  import { type FieldDef, variantValues } from "@tessera/engine";
  import { icon } from "../../core/pack-ui";
  import { i18n } from "../../i18n/index.svelte";
  import type { GameSession } from "../../sync/session.svelte";
  import Glyph from "../../ui/Glyph.svelte";

  let { session, field, def }: { session: GameSession; field: string; def: FieldDef } = $props();

  const bundle = $derived(session.bundle!);
  const tr = $derived(i18n.pack(bundle)!);
  // A variant column's values depend only on the catalog, not on the room's state.
  const columns = $derived((def.variants ?? []).map((column) => ({ column, all: variantValues(bundle, def.catalog!, column) })));

  // The host switches variants; everyone else sees which ones are in play. The last one on stays on.
  function toggle(column: string, all: string[], on: string[], value: string) {
    const next = on.includes(value) ? on.filter((v) => v !== value) : all.filter((v) => v === value || on.includes(v));
    if (next.length) session.submit({ t: "variants.set", field, column, values: next });
  }
</script>

{#each columns as { column, all } (column)}
  {@const on = session.state.variants[field]?.[column] ?? all}
  <div class="chips">
    {#each all as v (v)}
      {@const g = icon(bundle, v)}
      <button
        type="button"
        class="chip"
        aria-pressed={on.includes(v)}
        disabled={!session.isHost || (on.length === 1 && on.includes(v))}
        onclick={() => toggle(column, all, on, v)}
      >
        {#if g}<Glyph value={g} />{/if}{tr.t(`values.${column}.${v}`, undefined, v)}
      </button>
    {/each}
  </div>
{/each}
