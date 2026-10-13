<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";
  import { flip } from "svelte/animate";
  import type { PackBundle, Row, ZoneDef, ZoneEntry } from "@tessera/engine";
  import { findRow, rowId } from "../core/pack-ui";
  import { i18n, t } from "../i18n/index.svelte";
  import Empty from "../ui/Empty.svelte";
  import Panel from "../ui/Panel.svelte";
  import CardPicker from "./CardPicker.svelte";
  import GameCard from "./GameCard.svelte";

  let {
    bundle,
    name,
    def,
    entries,
    options,
    tracks,
    onadd,
    onremove,
  }: {
    bundle: PackBundle;
    name: string;
    def: ZoneDef;
    entries: ZoneEntry[];
    options: Row[];
    tracks: Record<string, number>;
    onadd: (item: string) => void;
    onremove: (entry: string) => void;
  } = $props();

  const tr = $derived(i18n.pack(bundle)!);
  const owned = $derived(new Set(entries.map((e) => e.item)));
  const next = $derived(def.sequential ? options.find((r) => !owned.has(rowId(bundle, def.catalog, r))) : undefined);
  const newestFirst = $derived([...entries].reverse());
  let picking = $state(false);

  const metaText = (meta: ZoneEntry["meta"]) =>
    Object.entries(meta)
      .filter(([, v]) => v !== null)
      .map(([k, v]) => `${tr.t(`tracks.${k}`, undefined, k)} ${v}`)
      .join(", ");
</script>

<Panel title="{tr.t(`zones.${name}`, undefined, name)} · {entries.length}">
  {#snippet actions()}
    {#if def.sequential}
      {#if next}
        <button type="button" class="btn btn-primary btn-s" onclick={() => onadd(rowId(bundle, def.catalog, next))}>
          <Plus size={16} />{tr.name(def.catalog, rowId(bundle, def.catalog, next))}
        </button>
      {/if}
    {:else if !picking}
      <button type="button" class="btn btn-primary btn-s" onclick={() => (picking = true)}><Plus size={16} />{t("board.add")}</button>
    {/if}
  {/snippet}

  {#if picking}
    <CardPicker
      {bundle}
      catalog={def.catalog}
      rows={options}
      {tracks}
      {owned}
      unique={def.unique}
      onpick={onadd}
      onclose={() => (picking = false)}
    />
  {/if}

  {#if entries.length === 0}
    <Empty>{t("board.empty_zone")}</Empty>
  {:else}
    <div class="card-list">
      {#each newestFirst as e (e.entry)}
        {@const row = findRow(bundle, def.catalog, e.item)}
        <div animate:flip={{ duration: 200 }}>
          {#if row}
            <GameCard {bundle} catalog={def.catalog} {row} meta={metaText(e.meta)}>
              {#snippet trailing()}
                <button type="button" class="icon-btn" aria-label={t("common.remove")} onclick={() => onremove(e.entry)}><X size={18} /></button>
              {/snippet}
            </GameCard>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</Panel>
