<script lang="ts">
  import type { FieldDef, PackBundle } from "@tessera/engine";
  import type { RefChoice } from "../core/pack-ui";
  import RefSelect from "./RefSelect.svelte";
  import { i18n } from "../i18n/index.svelte";
  import Segmented from "../ui/Segmented.svelte";

  let {
    bundle,
    name,
    def,
    value,
    choices,
    locked = false,
    onset,
  }: {
    bundle: PackBundle;
    name: string;
    def: FieldDef;
    value: string | number | null;
    /** For a ref field: what it can take. */
    choices: RefChoice[];
    locked?: boolean;
    onset: (value: string | number | null) => void;
  } = $props();

  const tr = $derived(i18n.pack(bundle)!);
</script>

<div class="field">
  <span class="field-label">{tr.t(`fields.${name}`, undefined, name)}</span>
  {#if def.type === "ref" && def.catalog}
    <RefSelect
      label={tr.t(`fields.${name}`, undefined, name)}
      disabled={locked}
      value={value === null ? null : String(value)}
      {choices}
      onchange={(v) => onset(v)}
    />
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
