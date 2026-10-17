<script lang="ts">
  import Undo from "@lucide/svelte/icons/undo-2";
  import { t } from "../i18n/index.svelte";
  import type { GameSession } from "../sync/session.svelte";
  import Sheet from "../ui/Sheet.svelte";
  import GameSettings from "./lobby/GameSettings.svelte";
  import Players from "./lobby/Players.svelte";

  let { session, open = $bindable() }: { session: GameSession; open: boolean } = $props();
</script>

<Sheet bind:open title={t("lobby.room_settings")}>
  <div class="stack">
    <section class="stack-s">
      <h3>{t("lobby.step_players")}</h3>
      <Players {session} />
    </section>
    <section class="stack-s">
      <h3>{t("lobby.step_game")}</h3>
      <GameSettings {session} />
    </section>
    {#if session.isHost}
      <button
        type="button"
        class="btn btn-block"
        onclick={() => {
          open = false;
          session.submit({ t: "phase.set", phase: "lobby" });
        }}
      >
        <Undo size={18} />{t("lobby.back_to_lobby")}
      </button>
    {/if}
  </div>
</Sheet>
