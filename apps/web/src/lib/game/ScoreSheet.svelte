<script lang="ts">
  import Crown from "@lucide/svelte/icons/crown";
  import { i18n, t } from "../i18n/index.svelte";
  import type { GameSession } from "../sync/session.svelte";
  import { askNumber } from "../ui/dialog.svelte";
  import Dot from "../ui/Dot.svelte";
  import Notice from "../ui/Notice.svelte";
  import { seatLabel } from "../room/seat-label";

  let { session }: { session: GameSession } = $props();

  const ev = $derived(session.evaluation);
  const st = $derived(session.state);
  const tr = $derived(i18n.pack(session.bundle));
  const adjustable = $derived(session.bundle?.game.scoring?.manual_adjust ?? true);
  const best = $derived(Math.max(0, ...st.seats.map((s) => ev?.seats[s.id]?.total ?? 0)));

  async function edit(seat: string, category: string, manual: boolean) {
    if (!manual && !adjustable) return;
    const current = st.seats.find((s) => s.id === seat)?.adjust[category] ?? 0;
    const name = tr?.t(`categories.${category}`, undefined, category) ?? category;
    const v = await askNumber(name, current, manual ? t("score.enter_value") : t("score.enter_adjust"));
    if (v !== null) session.submit({ t: "adjust.set", seat, category, value: v });
  }
</script>

{#if !ev}
  <p class="muted">{t("common.loading")}</p>
{:else}
  <div class="stack tab-panel">
    <div class="scoresheet">
      <table>
        <thead>
          <tr>
            <th class="cat"></th>
            {#each st.seats as s (s.id)}
              <th><span class="row-nowrap"><Dot color={s.color} />{seatLabel(st, s)}</span></th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each ev.categories as c (c.id)}
            <tr>
              <th class="cat" style:--c={c.color}>{tr?.t(`categories.${c.id}`, undefined, c.id)}</th>
              {#each st.seats as s (s.id)}
                {@const adj = s.adjust[c.id] ?? 0}
                <td>
                  <button type="button" class="cell" onclick={() => edit(s.id, c.id, c.manual)}>
                    {ev.seats[s.id]?.scores[c.id] ?? 0}{#if adj && !c.manual}<span class="adj">{adj > 0 ? "+" : ""}{adj}</span>{/if}
                  </button>
                </td>
              {/each}
            </tr>
          {/each}
          <tr class="total">
            <th class="cat">{t("score.total")}</th>
            {#each st.seats as s (s.id)}
              {@const total = ev.seats[s.id]?.total ?? 0}
              <td class:leader={total === best && best > 0}>
                {#if total === best && best > 0}<Crown size={14} />{/if}
                {total}
              </td>
            {/each}
          </tr>
        </tbody>
      </table>
    </div>
    <p class="small muted">{t("score.help")}</p>
    {#if ev.errors.length}
      <Notice kind="error">
        <details>
          <summary>{t("score.errors", { count: ev.errors.length })}</summary>
          {#each ev.errors as e, i (i)}<div class="mono">{e}</div>{/each}
        </details>
      </Notice>
    {/if}
  </div>
{/if}
