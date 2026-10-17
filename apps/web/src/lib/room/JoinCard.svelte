<script lang="ts">
  import Hand from "@lucide/svelte/icons/hand";
  import Lock from "@lucide/svelte/icons/lock";
  import UserPlus from "@lucide/svelte/icons/user-plus";
  import { NAME_MAX } from "@tessera/engine";
  import { t } from "../i18n/index.svelte";
  import type { GameSession } from "../sync/session.svelte";
  import Dot from "../ui/Dot.svelte";
  import Notice from "../ui/Notice.svelte";
  import Panel from "../ui/Panel.svelte";
  import { addSeat, canAddSeat } from "./seat-actions";
  import { seatLabel } from "./seat-label";

  let { session }: { session: GameSession } = $props();

  const st = $derived(session.state);
  const me = $derived(st.members[session.device]);
  const free = $derived(st.seats.filter((s) => !s.device));
  const bound = $derived(session.room.seat);
  const lost = $derived(st.seats.find((s) => s.id === bound && s.device && s.device !== session.device));
  const gone = $derived(!!bound && st.initialized && !st.seats.some((s) => s.id === bound));
  let name = $state("");

  function hello(e: SubmitEvent) {
    e.preventDefault();
    if (name.trim()) session.submit({ t: "member.hello", name: name.trim().slice(0, NAME_MAX) });
  }
</script>

<!-- Shown until a player sits somewhere, and to someone seated on an unnamed seat who has not said who they are. -->
{#if !session.isHost && (session.mySeats.length === 0 || (!me && session.mySeats.some((s) => !s.name)))}
  <Panel title={me ? t("join.hello", { name: me.name }) : t("join.who")} icon={Hand}>
    {#if lost}<Notice kind="warn">{t("join.seat_taken", { name: seatLabel(st, lost) })}</Notice>{/if}
    {#if gone}<Notice kind="warn">{t("join.seat_gone")}</Notice>{/if}
    {#if !me}
      <form class="row-nowrap" onsubmit={hello}>
        <input class="input grow" bind:value={name} placeholder={t("room.your_name")} aria-label={t("room.your_name")} maxlength={NAME_MAX} />
        <button type="submit" class="btn btn-primary" disabled={!name.trim()}>{t("join.join")}</button>
      </form>
    {:else if !st.allowGuestSeats}
      <Notice kind="accent"><Lock size={18} /><strong>{t("join.host_seats_info")}</strong></Notice>
    {:else}
      {#if free.length}
        <span class="small muted">{t("join.pick_seat")}</span>
        <div class="row">
          {#each free as s (s.id)}
            <button type="button" class="btn btn-s" onclick={() => session.submit({ t: "seat.claim", seat: s.id })}>
              <Dot color={s.color} />{seatLabel(st, s)}
            </button>
          {/each}
        </div>
      {/if}
      {#if canAddSeat(session)}
        <button type="button" class="btn btn-s" onclick={() => addSeat(session, true, me.name)}><UserPlus size={16} />{t("room.add_my_seat")}</button>
      {/if}
      <p class="tiny muted">{t("join.host_will_assign")}</p>
    {/if}
  </Panel>
{/if}
