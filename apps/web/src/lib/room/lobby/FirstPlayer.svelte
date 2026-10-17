<script lang="ts">
  import Dices from "@lucide/svelte/icons/dices";
  import { t } from "../../i18n/index.svelte";
  import type { GameSession } from "../../sync/session.svelte";
  import { makeFirst } from "../seat-actions";
  import { seatLabel } from "../seat-label";

  let { session }: { session: GameSession } = $props();

  const st = $derived(session.state);
  const first = $derived(st.seats[0]);

  function draw() {
    const pick = st.seats[Math.floor(Math.random() * st.seats.length)];
    makeFirst(session, pick.id);
  }
</script>

{#if st.seats.length > 1}
  <div class="row-nowrap first-player">
    <span class="field-label">{t("lobby.first_player")}</span>
    {#if session.isHost}
      <select class="select grow" value={first.id} onchange={(e) => makeFirst(session, e.currentTarget.value)} aria-label={t("lobby.first_player")}>
        {#each st.seats as s (s.id)}
          <option value={s.id}>{seatLabel(st, s)}</option>
        {/each}
      </select>
      <button type="button" class="btn btn-s" onclick={draw}><Dices size={16} />{t("lobby.draw")}</button>
    {:else}
      <strong class="truncate">{seatLabel(st, first)}</strong>
    {/if}
  </div>
{/if}
