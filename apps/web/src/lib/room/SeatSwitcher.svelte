<script lang="ts">
  import type { SeatState } from "@tessera/engine";
  import { t } from "../i18n/index.svelte";
  import type { GameSession } from "../sync/session.svelte";
  import Dot from "../ui/Dot.svelte";

  let { session, selected, onselect }: { session: GameSession; selected: SeatState | null; onselect: (id: string) => void } = $props();
</script>

<div class="chips">
  {#each session.state.seats as s (s.id)}
    <button type="button" class="chip" aria-pressed={selected?.id === s.id} onclick={() => onselect(s.id)}>
      <Dot color={s.color} />
      {s.name}{#if s.device === session.device}<span class="tiny">({t("room.me")})</span>{/if}
      <span class="num">{session.evaluation?.seats[s.id]?.total ?? 0}</span>
    </button>
  {/each}
</div>
