<script lang="ts">
  import UserPlus from "@lucide/svelte/icons/user-plus";
  import { t } from "../i18n/index.svelte";
  import type { GameSession } from "../sync/session.svelte";
  import Panel from "../ui/Panel.svelte";
  import SeatRow from "./SeatRow.svelte";
  import { addSeat, canAddSeat } from "./seat-actions";

  let { session }: { session: GameSession } = $props();
</script>

<div class="stack tab-panel">
  <Panel hint={t("room.order_help")}>
    <ul class="list">
      {#each session.state.seats as seat, index (seat.id)}
        <SeatRow {session} {seat} {index} />
      {/each}
    </ul>
    {#if canAddSeat(session)}
      <button type="button" class="btn" onclick={() => addSeat(session, false)}><UserPlus size={18} />{t("room.add_seat")}</button>
    {/if}
  </Panel>
</div>
