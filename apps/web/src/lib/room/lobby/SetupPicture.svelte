<script lang="ts">
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import type { LayoutItem, LayoutThing, PackBundle } from "@tessera/engine";
  import { ICON_TOKEN, icon, moduleIcon } from "../../core/pack-ui";
  import { i18n } from "../../i18n/index.svelte";
  import Glyph from "../../ui/Glyph.svelte";
  import IconText from "../../ui/IconText.svelte";

  let { bundle, items }: { bundle: PackBundle; items: LayoutItem[] } = $props();

  const tr = $derived(i18n.pack(bundle)!);
  const label = (key: string | null) => (key ? tr.t(`layout.${key}`, undefined, key) : "");
  const glyph = (name: string | null) => (name ? (icon(bundle, name) ?? name) : "");
  // An expansion's component carries its module's icon (or a dot) in the corner, one per expansion it comes from.
  const marker = (module: string) => moduleIcon(bundle, module) || "•";

  // Every entry is drawn the same way: things side by side, their expansion markers, then marks and a caption.
  type Entry = { kind: "arrow" } | { kind: "things"; things: LayoutThing[]; modules: string[]; marks: string[]; caption: string };
  const entries = $derived(
    items.map((item): Entry => {
      if (item.kind === "arrow") return item;
      if (item.kind === "group") {
        const modules = [...new Set([...item.modules, ...item.items.flatMap((x) => x.modules)])];
        return { kind: "things", things: item.items, modules, marks: [], caption: label(item.caption) };
      }
      const caption = label(item.caption);
      // A pile with its own symbol already shows where it comes from.
      return { kind: "things", things: [item], modules: item.symbol ? [] : item.modules, marks: item.marks, caption };
    }),
  );
</script>

{#snippet face(item: LayoutThing)}
  {#if item.label}<IconText {bundle} text={label(item.label)} />{:else}<Glyph value={glyph(item.icon)} />{/if}
{/snippet}

{#snippet thing(item: LayoutThing)}
  {#if item.kind === "pieces"}
    <span class="pic-pieces">{#each { length: 3 }, i (i)}<Glyph value={glyph(item.icon)} />{/each}</span>
  {:else if item.kind === "token" && item.shape === "board"}
    <span class="pic-board" style:--c={item.color} style:color={item.ink}>
      {@render face(item)}
      {#if item.stripes.length}
        <span class="pic-stripes">{#each item.stripes as c, i (i)}<span style:background={c}></span>{/each}</span>
      {/if}
    </span>
  {:else if item.kind === "token"}
    <span class="pic-token-wrap">
      <span class="pic-token {item.shape}" style:--c={item.color} style:color={item.ink}>{@render face(item)}</span>
      {#if item.count !== null}<span class="pic-count">{item.count}</span>{/if}
    </span>
  {:else}
    {@const text = item.kind === "pile" ? label(item.label) : ""}
    <span
      class="pic-pile"
      class:large={item.size === "large"}
      class:grid={item.pattern === "grid"}
      class:single={item.count === 1 || item.on}
      class:carrying={item.on}
      class:spot={item.kind === "spot"}
      class:outlined={item.outline}
      class:long={text.replace(ICON_TOKEN, "•").length > 4}
      style:--c={item.color}
      style:--o={item.outline}
      style:color={item.ink}
    >
      <IconText {bundle} {text} />
      {#if item.on}<span class="pic-on">{@render thing(item.on)}</span>{/if}
      {#if item.symbol}<span class="pic-symbol"><Glyph value={glyph(item.symbol)} /></span>{/if}
      {#if item.count !== null}<span class="pic-count">{item.count}</span>{/if}
    </span>
  {/if}
{/snippet}

<!-- A small picture drawn from the pack's layout: piles, boards, tokens, heaps, empty spots, groups and arrows. -->
{#if entries.length}
  <div class="setup-picture" aria-hidden="true">
    {#each entries as entry, i (i)}
      {#if entry.kind === "arrow"}
        <span class="pic-arrow"><ArrowRight size={18} /></span>
      {:else}
        <span class="pic-item">
          <span class="pic-group">
            {#each entry.things as x, j (j)}{@render thing(x)}{/each}
            {#if entry.modules.length}
              <span class="pic-modules">{#each entry.modules as m (m)}<span class="pic-module"><Glyph value={marker(m)} /></span>{/each}</span>
            {/if}
          </span>
          {#if entry.marks.length}<span class="pic-marks">{entry.marks.join(" ")}</span>{/if}
          {#if entry.caption}<span class="pic-caption">{entry.caption}</span>{/if}
        </span>
      {/if}
    {/each}
  </div>
{/if}
