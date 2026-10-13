<script lang="ts">
  import { db } from "../core/db";
  import type { GameSession } from "../sync/session.svelte";

  let { session }: { session: GameSession } = $props();
  let claimed = false;

  // A seat-bound invite claims its seat once the room state is known.
  $effect(() => {
    const st = session.state;
    if (!st.initialized || claimed) return;
    const target = session.room.seat ? st.seats.find((s) => s.id === session.room.seat) : null;
    if (target && !target.device) {
      claimed = true;
      void session.submit({ t: "seat.claim", seat: target.id });
    }
  });

  let saved = "";
  $effect(() => {
    const st = session.state;
    const summary = {
      label: st.label || session.room.label,
      packId: st.pack?.id,
      seats: st.seats.map((s) => ({ name: s.name, color: s.color, mine: s.device === session.device })),
    };
    const json = JSON.stringify(summary);
    if (json !== saved) {
      saved = json;
      void db.rooms.update(session.room.id, summary);
    }
  });
</script>
