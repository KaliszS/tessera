<script lang="ts">
  import PenLine from "@lucide/svelte/icons/pen-line";
  import type { PackRow } from "../core/db";
  import { go } from "../core/nav";
  import type { HostConfig } from "../core/relay";
  import { i18n, t } from "../i18n/index.svelte";
  import Notice from "../ui/Notice.svelte";
  import { createGame } from "./create-game";
  import GamePicker from "./GamePicker.svelte";

  let { host, packs }: { host: HostConfig; packs: PackRow[] } = $props();

  let label = $state("");
  let busy = $state(false);
  let error = $state("");

  // Picking a game creates the room right away; an empty name becomes "game · weekday".
  async function create(pack: PackRow) {
    busy = true;
    error = "";
    const weekday = new Date().toLocaleDateString(i18n.locale, { weekday: "long" });
    try {
      const room = await createGame(host, pack.bundle, label.trim() || `${i18n.packName(pack.bundle)} · ${weekday}`);
      await go(`/room/${room}`);
    } catch (err) {
      error = (err as Error).message;
      busy = false;
    }
  }
</script>

<div class="new-room">
  <div class="input-icon">
    <PenLine size={18} />
    <!-- svelte-ignore a11y_autofocus -->
    <input class="input input-l" bind:value={label} placeholder={t("new.label")} aria-label={t("new.label")} maxlength="128" autofocus />
  </div>
  <p class="small muted">{t("new.pick_game")}</p>
  <GamePicker {packs} disabled={busy} onpick={create} />
  {#if error}<Notice kind="error">{error}</Notice>{/if}
</div>
