<script lang="ts">
  import UserPlus from "@lucide/svelte/icons/user-plus";
  import { t } from "../i18n/index.svelte";
  import type { GameSession } from "../sync/session.svelte";
  import Dot from "../ui/Dot.svelte";
  import Panel from "../ui/Panel.svelte";
  import { addSeat, canAddSeat } from "./seat-actions";

  let { session }: { session: GameSession } = $props();
  const free = $derived(session.state.seats.filter((s) => !s.device));
</script>

{#if session.mySeats.length === 0 && (free.length || canAddSeat(session))}
  <Panel title={t("room.which_seat")}>
    <div class="row">
      {#each free as s (s.id)}
        <button type="button" class="btn" onclick={() => session.submit({ t: "seat.claim", seat: s.id })}>
          <Dot color={s.color} />{s.name}
        </button>
      {/each}
      {#if canAddSeat(session)}
        <button type="button" class="btn btn-primary" onclick={() => addSeat(session)}><UserPlus size={18} />{t("room.add_my_seat")}</button>
      {/if}
    </div>
  </Panel>
{/if}
