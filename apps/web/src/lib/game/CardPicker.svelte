<script lang="ts">
  import Search from "@lucide/svelte/icons/search";
  import X from "@lucide/svelte/icons/x";
  import { type PackBundle, type Row, matches } from "@tessera/engine";
  import { filterValues, rowId } from "../core/pack-ui";
  import { i18n, t } from "../i18n/index.svelte";
  import GameCard from "./GameCard.svelte";

  let {
    bundle,
    catalog,
    rows,
    tracks,
    owned,
    unique,
    onpick,
    onclose,
  }: {
    bundle: PackBundle;
    catalog: string;
    rows: Row[];
    tracks: Record<string, number>;
    owned: Set<string>;
    unique: boolean;
    onpick: (item: string) => void;
    onclose: () => void;
  } = $props();

  const tr = $derived(i18n.pack(bundle)!);
  const facets = $derived(filterValues(bundle, catalog, rows));
  let query = $state("");
  let active = $state<Record<string, string | null>>({});

  $effect(() => {
    active = Object.fromEntries(
      Object.entries(facets).map(([col, values]) => {
        const track = tracks[col];
        return [col, track !== undefined && values.includes(String(track)) ? String(track) : null];
      }),
    );
  });

  const valueLabel = (col: string, v: string) => (tr.has(`values.${col}.${v}`) ? tr.t(`values.${col}.${v}`) : v);

  const visible = $derived(
    rows.filter((r) => {
      for (const [col, v] of Object.entries(active)) if (v !== null && String(r[col]) !== v) return false;
      const id = rowId(bundle, catalog, r);
      return !query || matches(`${tr.name(catalog, id)} ${id}`, query);
    }),
  );
</script>

<div class="picker enter">
  <div class="row-nowrap">
    <div class="search grow">
      <Search size={18} />
      <!-- svelte-ignore a11y_autofocus -->
      <input class="input" type="search" bind:value={query} placeholder={t("board.search")} autofocus />
    </div>
    <button type="button" class="icon-btn" aria-label={t("common.close")} onclick={onclose}><X size={20} /></button>
  </div>
  {#each Object.entries(facets) as [col, values] (col)}
    <div class="chips">
      <button type="button" class="chip" aria-pressed={active[col] === null} onclick={() => (active[col] = null)}>{t("board.all")}</button>
      {#each values as v (v)}
        <button type="button" class="chip" aria-pressed={active[col] === v} onclick={() => (active[col] = active[col] === v ? null : v)}>
          {valueLabel(col, v)}
        </button>
      {/each}
    </div>
  {/each}
  <div class="picker-results">
    {#each visible as r (rowId(bundle, catalog, r))}
      {@const id = rowId(bundle, catalog, r)}
      <GameCard {bundle} {catalog} row={r} disabled={unique && owned.has(id)} onclick={() => onpick(id)} />
    {:else}
      <p class="muted">{t("board.no_matches")}</p>
    {/each}
  </div>
</div>
