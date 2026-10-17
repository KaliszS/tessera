<script lang="ts">
  import SeatBoard from "../game/SeatBoard.svelte";
  import type { GameSession } from "../sync/session.svelte";
  import Panel from "../ui/Panel.svelte";
  import RoundPrep from "./RoundPrep.svelte";
  import SeatSwitcher from "./SeatSwitcher.svelte";
  import TrackBar from "./TrackBar.svelte";

  let { session }: { session: GameSession } = $props();

  let selected = $state<string | null>(null);
  const st = $derived(session.state);
  const seat = $derived(st.seats.find((s) => s.id === selected) ?? session.mySeats[0] ?? st.seats[0] ?? null);
  const hasTracks = $derived(Object.keys(session.bundle?.game.tracks ?? {}).length > 0);
</script>

<div class="stack">
  {#if hasTracks}
    <Panel><TrackBar {session} /></Panel>
  {/if}
  <RoundPrep {session} />
  <SeatSwitcher {session} selected={seat} onselect={(id) => (selected = id)} />
  {#if seat}
    {#key seat.id}
      <SeatBoard {session} {seat} view={session.evaluation?.seats[seat.id]} />
    {/key}
  {/if}
</div>
