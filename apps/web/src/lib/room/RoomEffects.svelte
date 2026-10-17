<script lang="ts">
  import { db } from "../core/db";
  import type { GameSession } from "../sync/session.svelte";
  import { seatLabel } from "./seat-label";

  let { session }: { session: GameSession } = $props();
  let tries = 0;
  let done = false;

  // A seat-bound invite claims its seat once the room state is known, retrying if the claim got dropped.
  // Once seated the binding is consumed, so leaving the seat later does not re-claim it.
  $effect(() => {
    const st = session.state;
    const bound = session.room.seat;
    if (!bound || done || !st.initialized || session.sync.pending) return;
    const target = st.seats.find((s) => s.id === bound);
    if (target?.device === session.device) {
      done = true;
      void db.rooms.update(session.room.id, { seat: null });
    } else if (target && !target.device && tries < 3) {
      tries++;
      void session.submit({ t: "seat.claim", seat: bound });
    }
  });

  let saved = "";
  $effect(() => {
    const st = session.state;
    const summary = {
      label: st.label || session.room.label,
      packId: st.pack?.id,
      seats: st.seats.map((s) => ({ name: seatLabel(st, s), color: s.color, mine: s.device === session.device })),
    };
    const json = JSON.stringify(summary);
    if (json !== saved) {
      saved = json;
      void db.rooms.update(session.room.id, summary);
    }
  });
</script>
