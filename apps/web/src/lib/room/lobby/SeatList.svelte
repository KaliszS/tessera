<script lang="ts">
  import { flip } from "svelte/animate";
  import type { GameSession } from "../../sync/session.svelte";
  import SeatRow from "../SeatRow.svelte";
  import { moveSeat } from "../seat-actions";
  import { seatLabel } from "../seat-label";

  let {
    session,
    editing = $bindable(null),
    oninvite,
  }: { session: GameSession; editing: string | null; oninvite: (seat: string, name: string) => void } = $props();

  const st = $derived(session.state);
  // Local order while dragging, kept until the reorder event comes back from the relay.
  let order = $state<string[] | null>(null);
  let dragged = $state<string | null>(null);
  let listEl: HTMLUListElement | undefined = $state();

  const ids = $derived(st.seats.map((s) => s.id));
  const shown = $derived(order ? order.map((id) => st.seats.find((s) => s.id === id)).filter((s) => !!s) : st.seats);

  $effect(() => {
    if (order && !dragged && order.join() === ids.join()) order = null;
  });

  function grab(e: PointerEvent, id: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    order = [...ids];
    dragged = id;
    const move = (ev: PointerEvent) => {
      const others = [...(listEl?.querySelectorAll<HTMLElement>("[data-seat]") ?? [])].filter((r) => r.dataset.seat !== id);
      const index = others.filter((r) => {
        const b = r.getBoundingClientRect();
        return b.top + b.height / 2 < ev.clientY;
      }).length;
      const next = order!.filter((x) => x !== id);
      next.splice(index, 0, id);
      if (next.join() !== order!.join()) order = next;
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      dragged = null;
      if (order && order.join() !== ids.join()) session.submit({ t: "seat.order", order: [...order] });
      else order = null;
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  }
</script>

<ul class="seat-list" bind:this={listEl}>
  {#each shown as seat (seat.id)}
    <div animate:flip={{ duration: 180 }}>
      <SeatRow
        {session}
        {seat}
        dragging={dragged === seat.id}
        bind:editing={() => editing === seat.id, (v) => (editing = v ? seat.id : null)}
        oninvite={() => oninvite(seat.id, seatLabel(st, seat))}
        ongrab={(e) => grab(e, seat.id)}
        onkeymove={(dir) => moveSeat(session, st, seat.id, dir)}
      />
    </div>
  {/each}
</ul>
