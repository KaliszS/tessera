<script lang="ts">
  import UserCheck from "@lucide/svelte/icons/user-check";
  import { t } from "../../i18n/index.svelte";
  import type { GameSession } from "../../sync/session.svelte";
  import Avatar from "../../ui/Avatar.svelte";
  import { choose } from "../../ui/dialog.svelte";
  import { assignMember } from "../seat-actions";
  import { seatLabel } from "../seat-label";

  let { session }: { session: GameSession } = $props();

  const st = $derived(session.state);
  // Joined devices that introduced themselves but sit nowhere yet.
  const waiting = $derived(
    Object.entries(st.members).filter(([dev]) => dev !== st.host && !st.seats.some((s) => s.device === dev)),
  );

  async function assign(device: string, name: string) {
    // Taken seats can be handed over, e.g. when a player lost their device or browser data.
    const seat = await choose(t("lobby.assign_to", { name }), [
      ...st.seats.map((s) => ({ id: s.id, label: s.device ? t("lobby.replace", { name: seatLabel(st, s) }) : seatLabel(st, s) })),
      { id: "new", label: t("lobby.new_seat_for", { name }) },
    ]);
    if (seat) await assignMember(session, device, name, seat);
  }
</script>

{#if waiting.length}
  <div class="stack-s">
    <span class="field-label">{t("lobby.waiting", { count: waiting.length })}</span>
    <ul class="seat-list">
      {#each waiting as [device, m] (device)}
        <li class="seat-card waiting">
          <Avatar name={m.name} color="var(--text-2)" />
          <strong class="grow truncate">{m.name}</strong>
          {#if session.isHost}
            <button type="button" class="btn btn-s" onclick={() => assign(device, m.name)}><UserCheck size={16} />{t("lobby.assign")}</button>
          {/if}
        </li>
      {/each}
    </ul>
  </div>
{/if}
