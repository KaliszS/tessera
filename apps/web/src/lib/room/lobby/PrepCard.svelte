<script lang="ts">
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import Circle from "@lucide/svelte/icons/circle";
  import Dices from "@lucide/svelte/icons/dices";
  import { type SetupSection, drawRandom } from "@tessera/engine";
  import { icon } from "../../core/pack-ui";
  import { i18n, t } from "../../i18n/index.svelte";
  import type { GameSession } from "../../sync/session.svelte";
  import Glyph from "../../ui/Glyph.svelte";
  import IconText from "../../ui/IconText.svelte";
  import InfoTip from "../../ui/InfoTip.svelte";
  import SetupPicture from "./SetupPicture.svelte";

  // One setup section: a task to tick off, or for the table a picture of where things go.
  let { session, sec }: { session: GameSession; sec: SetupSection } = $props();

  // Longer lists (whole decks) stay folded so the steps read as a short checklist.
  const INLINE_ITEMS = 6;
  // Up to this many pieces are drawn one by one; more show as "glyph ×N".
  const INLINE_PIECES = 8;

  const bundle = $derived(session.bundle!);
  const tr = $derived(i18n.pack(bundle)!);
  const done = $derived(!!session.state.setupChecked[sec.id]);
  const label = $derived(tr.t(`setup.${sec.section}`, undefined, sec.section));
  const pieceName = (name: string) => tr.t(`pieces.${name}`, undefined, name);

  const draw = (random: NonNullable<SetupSection["random"]>) =>
    session.submit({ t: "setup.roll", section: sec.id, picks: drawRandom(random.pool, random.count) });
</script>

{#snippet info()}
  {#if tr.has(`setup_help.${sec.section}`)}
    <InfoTip label={`${label}: ${t("setup.info")}`}>
      <IconText {bundle} text={tr.t(`setup_help.${sec.section}`, sec.help)} />
    </InfoTip>
  {/if}
{/snippet}

{#snippet itemList()}
  <ul class="setup-items small">
    {#each sec.items as it (it.id)}
      <li>{tr.name(sec.catalog!, it.id)}{#if it.copies > 1} <strong>×{it.copies}</strong>{/if}</li>
    {/each}
  </ul>
{/snippet}

{#if sec.area === "table"}
  <li class="prep-card picture">
    <div class="prep-head">
      <span class="prep-title grow">{label}</span>
      {@render info()}
    </div>
    <SetupPicture {bundle} items={sec.layout} />
  </li>
{:else}
  <li class="prep-card" class:done>
    <div class="prep-head">
      <button
        type="button"
        class="toggle-item prep-toggle"
        aria-pressed={done}
        onclick={() => session.submit({ t: "setup.check", section: sec.id, done: !done })}
      >
        <span class="prep-check">{#if done}<CircleCheck size={22} />{:else}<Circle size={22} />{/if}</span>
        {#if sec.color}<span class="card-back" style:--c={sec.color} aria-hidden="true"></span>{/if}
        <span class="prep-title truncate">{label}</span>
        {#if sec.count !== null}<span class="prep-count">{sec.count}</span>{/if}
      </button>
      {@render info()}
      {#if sec.random && !done}
        {@const random = sec.random}
        {#if random.picked}
          <button type="button" class="icon-btn" aria-label={t("setup.redraw")} title={t("setup.redraw")} onclick={() => draw(random)}>
            <Dices size={18} />
          </button>
        {:else}
          <button type="button" class="btn btn-s" onclick={() => draw(random)}><Dices size={16} />{t("setup.draw", { count: random.count })}</button>
        {/if}
      {/if}
    </div>
    {#if !done}
      <div class="prep-body">
        {#if sec.marks.length}
          <div class="prep-marks">
            {#each sec.marks as m (m)}<span class="mark" style:--c={sec.color}>{m}</span>{/each}
          </div>
        {/if}
        {#if sec.pieces.length}
          <div class="prep-pieces">
            {#each sec.pieces as p (p.icon)}
              {@const g = icon(bundle, p.icon)}
              <span class="piece" title={`${pieceName(p.icon)} ×${p.count}`}>
                {#if g && p.count <= INLINE_PIECES}
                  {#each { length: p.count }, i (i)}<Glyph value={g} />{/each}
                {:else}
                  {#if g}<Glyph value={g} />{:else}{pieceName(p.icon)}{/if} ×{p.count}
                {/if}
              </span>
            {/each}
          </div>
        {/if}
        <SetupPicture {bundle} items={sec.layout} />
        {#if sec.list && sec.catalog && sec.items.length && (!sec.random || sec.random.picked)}
          {#if sec.items.length <= INLINE_ITEMS}
            {@render itemList()}
          {:else}
            <details class="prep-more">
              <summary class="tiny">{t("setup.show_items", { count: sec.items.length })}</summary>
              {@render itemList()}
            </details>
          {/if}
        {/if}
      </div>
    {/if}
  </li>
{/if}
