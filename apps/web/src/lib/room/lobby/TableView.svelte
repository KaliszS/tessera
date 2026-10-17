<script lang="ts">
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import { t } from "../../i18n/index.svelte";
  import type { GameSession } from "../../sync/session.svelte";
  import Avatar from "../../ui/Avatar.svelte";
  import { seatInitial, seatLabel } from "../seat-label";

  let { session, onpick }: { session: GameSession; onpick: (seat: string) => void } = $props();

  const st = $derived(session.state);
  const seats = $derived(st.seats);
  // Seats go clockwise from the top along an oval, matching seat order (left/right neighbours).
  const spot = (i: number) => {
    const a = ((-90 + (360 * i) / Math.max(1, seats.length)) * Math.PI) / 180;
    return { x: 50 + 41 * Math.cos(a), y: 50 + 39 * Math.sin(a) };
  };
</script>

{#if seats.length}
  <div class="table-view" aria-hidden="true">
    <div class="table-top">
      <span class="table-center">
        <RotateCw size={14} />
        <span class="truncate">{t("lobby.first_player")}: {seatLabel(st, seats[0])}</span>
      </span>
    </div>
    {#each seats as seat, i (seat.id)}
      {@const p = spot(i)}
      <button
        type="button"
        class="table-seat"
        class:first={i === 0}
        tabindex="-1"
        style:left="{p.x}%"
        style:top="{p.y}%"
        onclick={() => onpick(seat.id)}
      >
        <Avatar name={seatInitial(st, seat)} color={seat.color} mine={seat.device === session.device} empty={!seat.device} />
      </button>
    {/each}
  </div>
{/if}
