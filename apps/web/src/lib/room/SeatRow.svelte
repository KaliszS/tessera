<script lang="ts">
  import GripVertical from "@lucide/svelte/icons/grip-vertical";
  import Link from "@lucide/svelte/icons/link";
  import LogOut from "@lucide/svelte/icons/log-out";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Trash from "@lucide/svelte/icons/trash";
  import type { SeatState } from "@tessera/engine";
  import { t } from "../i18n/index.svelte";
  import type { GameSession } from "../sync/session.svelte";
  import Avatar from "../ui/Avatar.svelte";
  import SeatEditor from "./SeatEditor.svelte";
  import { removeSeat, updateSeat } from "./seat-actions";
  import { seatInitial, seatLabel } from "./seat-label";

  let {
    session,
    seat,
    editing = $bindable(false),
    dragging = false,
    oninvite,
    ongrab,
    onkeymove,
  }: {
    session: GameSession;
    seat: SeatState;
    editing?: boolean;
    dragging?: boolean;
    oninvite?: () => void;
    ongrab?: (e: PointerEvent) => void;
    onkeymove?: (dir: -1 | 1) => void;
  } = $props();

  const mine = $derived(seat.device === session.device);
  const label = $derived(seatLabel(session.state, seat));
  const free = $derived(!seat.device);
</script>

{#if editing}
  <li class="seat-card editing" data-seat={seat.id}>
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
  <li class="seat-card" class:free class:mine class:dragging data-seat={seat.id}>
    {#if session.isHost}
      <button
        type="button"
        class="drag-handle"
        aria-label={t("room.reorder")}
        title={t("room.reorder")}
        onpointerdown={ongrab}
        onkeydown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            onkeymove?.(e.key === "ArrowUp" ? -1 : 1);
          }
        }}
      >
        <GripVertical size={18} />
      </button>
    {/if}
    <Avatar name={seatInitial(session.state, seat)} color={seat.color} {mine} empty={free} />
    <div class="seat-body">
      <strong class="truncate" class:muted={!seat.name}>{label}</strong>
      {#if mine}
        <span class="seat-status me">{t("room.me")}</span>
      {:else if free && !session.isHost && !session.state.allowGuestSeats}
        <span class="seat-status">{t("room.free")}</span>
      {:else if free}
        <button type="button" class="seat-claim" onclick={() => session.submit({ t: "seat.claim", seat: seat.id })}>{t("room.claim")}</button>
      {:else}
        <span class="seat-status">{t("room.claimed")}</span>
      {/if}
    </div>
    {#if mine}
      <button type="button" class="icon-btn" aria-label={t("room.release")} title={t("room.release")} onclick={() => session.submit({ t: "seat.release", seat: seat.id })}>
        <LogOut size={18} />
      </button>
    {:else if session.isHost && oninvite}
      <button type="button" class="icon-btn" aria-label={t("invite.seat_title")} title={t("invite.seat_title")} onclick={oninvite}><Link size={18} /></button>
    {/if}
    {#if session.isHost || mine}
      <button type="button" class="icon-btn" aria-label={t("room.rename")} title={t("room.rename")} onclick={() => (editing = true)}><Pencil size={18} /></button>
    {/if}
    {#if session.isHost}
      <button type="button" class="icon-btn danger" aria-label={t("common.remove")} title={t("common.remove")} onclick={() => removeSeat(session, seat.id, label)}>
        <Trash size={18} />
      </button>
    {/if}
  </li>
{/if}
