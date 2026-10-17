<script lang="ts">
  import QrCode from "@lucide/svelte/icons/qr-code";
  import UserPlus from "@lucide/svelte/icons/user-plus";
  import { tick } from "svelte";
  import { copyText } from "../../core/clipboard";
  import { t } from "../../i18n/index.svelte";
  import type { GameSession } from "../../sync/session.svelte";
  import { confirmAction } from "../../ui/dialog.svelte";
  import { toasts } from "../../ui/toast.svelte";
  import InviteShare from "../InviteShare.svelte";
  import { roomInvite, seatInvite } from "../invite-links";
  import FirstPlayer from "./FirstPlayer.svelte";
  import SeatList from "./SeatList.svelte";
  import Switch from "../../ui/Switch.svelte";
  import TableView from "./TableView.svelte";
  import { addSeat, canAddSeat } from "../seat-actions";
  import Waiting from "./Waiting.svelte";

  let { session }: { session: GameSession } = $props();

  const st = $derived(session.state);
  const isMe = $derived(session.mySeats.length > 0);
  let shown = $state<{ title: string; url: string } | null>(null);
  let editing = $state<string | null>(null);
  let shareEl = $state<HTMLElement>();

  // Tapping a seat at the table opens it for editing when allowed, and brings it into view.
  function pick(id: string) {
    const seat = st.seats.find((s) => s.id === id);
    if (seat && (session.isHost || seat.device === session.device)) editing = id;
    requestAnimationFrame(() => document.querySelector(`[data-seat="${id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }

  async function show(title: string, url: string) {
    shown = { title, url };
    await tick();
    shareEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  /** Copies a link for one seat; a taken seat is released first so the link can hand it to a new device.
   * The panel opens only when the browser refuses the clipboard. */
  async function inviteSeat(seat: string, name: string) {
    const taken = st.seats.find((s) => s.id === seat)?.device;
    if (taken) {
      if (!(await confirmAction(t("invite.takeover_title"), t("invite.takeover_body", { name }), t("invite.takeover")))) return;
      await session.submit({ t: "seat.release", seat });
    }
    const url = seatInvite(session.room, seat);
    const copied = await copyText(url).then(
      () => true,
      () => false,
    );
    try {
      if (copied) toasts.show(t("invite.copied_for", { name }));
      else await show(t("invite.for_seat", { name }), await url);
    } catch (e) {
      toasts.show((e as Error).message, "error");
    }
  }
</script>

<div class="stack-s">
  {#if session.isHost}
    <Switch checked={!st.allowGuestSeats} onchange={(on) => session.submit({ t: "settings.set", allow_guest_seats: !on })}>
      <span>{t("lobby.host_seats")}</span>
    </Switch>
  {/if}
  {#if st.seats.length}
    <TableView {session} onpick={pick} />
    <SeatList {session} bind:editing oninvite={inviteSeat} />
    <FirstPlayer {session} />
    <p class="tiny muted">{t("room.order_help")}</p>
  {/if}
  <Waiting {session} />
  <div class="row">
    {#if !isMe && session.isHost && canAddSeat(session)}
      <button type="button" class="btn btn-primary btn-s" onclick={() => addSeat(session, true)}><UserPlus size={16} />{t("room.add_my_seat")}</button>
    {/if}
    {#if session.isHost && canAddSeat(session)}
      <button type="button" class="btn btn-s" onclick={() => addSeat(session, false)}><UserPlus size={16} />{t("room.add_seat")}</button>
    {/if}
    <button type="button" class="btn btn-s" onclick={() => show(t("invite.room_title"), roomInvite(session.room))}>
      <QrCode size={16} />{t("lobby.invite")}
    </button>
  </div>
  {#if shown}
    <div bind:this={shareEl}><InviteShare title={shown.title} url={shown.url} onclose={() => (shown = null)} /></div>
  {/if}
</div>
