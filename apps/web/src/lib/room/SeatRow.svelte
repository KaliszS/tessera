<script lang="ts">
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import LogOut from "@lucide/svelte/icons/log-out";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Trash from "@lucide/svelte/icons/trash";
  import type { SeatState } from "@tessera/engine";
  import { t } from "../i18n/index.svelte";
  import type { GameSession } from "../sync/session.svelte";
  import Dot from "../ui/Dot.svelte";
  import SeatEditor from "./SeatEditor.svelte";
  import { moveSeat, removeSeat, updateSeat } from "./seat-actions";

  let { session, seat, index }: { session: GameSession; seat: SeatState; index: number } = $props();

  const mine = $derived(seat.device === session.device);
  const status = $derived(mine ? t("room.me") : seat.device ? t("room.claimed") : t("room.free"));
  const last = $derived(session.state.seats.length - 1);
  let editing = $state(false);
</script>

{#if editing}
  <li>
    <SeatEditor
      {seat}
      oncancel={() => (editing = false)}
      onsave={(name, color) => {
        editing = false;
        void updateSeat(session, seat.id, name, color);
      }}
    />
  </li>
{:else}
<li class="seat-row">
  <Dot color={seat.color} large />
  <div class="grow">
    <strong class="truncate">{seat.name}</strong>
    <div class="tiny muted">{status}</div>
  </div>
  <span class="seat-total">{session.evaluation?.seats[seat.id]?.total ?? 0}</span>
  {#if mine}
    <button type="button" class="icon-btn" aria-label={t("room.release")} title={t("room.release")} onclick={() => session.submit({ t: "seat.release", seat: seat.id })}>
      <LogOut size={18} />
    </button>
  {:else if !seat.device}
    <button type="button" class="btn btn-s" onclick={() => session.submit({ t: "seat.claim", seat: seat.id })}>{t("room.claim")}</button>
  {/if}
  {#if session.isHost || mine}
    <button type="button" class="icon-btn" aria-label={t("room.rename")} onclick={() => (editing = true)}><Pencil size={18} /></button>
  {/if}
  {#if session.isHost}
    <button type="button" class="icon-btn" disabled={index === 0} aria-label={t("room.move_up")} onclick={() => moveSeat(session, session.state, seat.id, -1)}>
      <ArrowUp size={18} />
    </button>
    <button type="button" class="icon-btn" disabled={index === last} aria-label={t("room.move_down")} onclick={() => moveSeat(session, session.state, seat.id, 1)}>
      <ArrowDown size={18} />
    </button>
    <button type="button" class="icon-btn danger" aria-label={t("common.remove")} onclick={() => removeSeat(session, seat.id, seat.name)}>
      <Trash size={18} />
    </button>
  {/if}
</li>
{/if}
