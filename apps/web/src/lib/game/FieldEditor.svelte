<script lang="ts">
  import type { FieldDef, PackBundle, Row } from "@tessera/engine";
  import { rowId } from "../core/pack-ui";
  import { i18n } from "../i18n/index.svelte";
  import Segmented from "../ui/Segmented.svelte";

  let {
    bundle,
    name,
    def,
    value,
    options,
    onset,
  }: {
    bundle: PackBundle;
    name: string;
    def: FieldDef;
    value: string | number | null;
    options: Row[];
    onset: (value: string | number | null) => void;
  } = $props();

  const tr = $derived(i18n.pack(bundle)!);
</script>

<div class="field">
  <span class="field-label">{tr.t(`fields.${name}`, undefined, name)}</span>
  {#if def.type === "ref" && def.catalog}
    <select class="select" value={String(value ?? "")} onchange={(e) => onset(e.currentTarget.value || null)}>
      <option value="">—</option>
      {#each options as r (rowId(bundle, def.catalog, r))}
        {@const id = rowId(bundle, def.catalog, r)}
        <option value={id}>{tr.name(def.catalog, id)}</option>
      {/each}
    </select>
  {:else if def.type === "enum"}
    <Segmented
      options={(def.values ?? []).map((v) => ({ value: v, label: tr.t(`values.${name}.${v}`, undefined, v) }))}
      value={value === null ? null : String(value)}
      onchange={(v) => onset(v)}
    />
  {:else}
    <input
      class="input"
      value={value ?? ""}
      inputmode={def.type === "number" ? "numeric" : undefined}
      onchange={(e) => onset(def.type === "number" ? Number(e.currentTarget.value) : e.currentTarget.value)}
    />
  {/if}
</div>
