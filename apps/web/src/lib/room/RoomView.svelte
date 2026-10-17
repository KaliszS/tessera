<script lang="ts">
  import Settings from "@lucide/svelte/icons/settings-2";
  import { href } from "../core/nav";
  import LogView from "../game/LogView.svelte";
  import ScoreSheet from "../game/ScoreSheet.svelte";
  import { t } from "../i18n/index.svelte";
  import type { GameSession } from "../sync/session.svelte";
  import Notice from "../ui/Notice.svelte";
  import Page from "../ui/Page.svelte";
  import Tabs from "../ui/Tabs.svelte";
  import BoardTab from "./BoardTab.svelte";
  import Lobby from "./lobby/Lobby.svelte";
  import LockBanner from "./LockBanner.svelte";
  import RoomSheet from "./RoomSheet.svelte";
  import RoomStatus from "./RoomStatus.svelte";
  import JoinCard from "./JoinCard.svelte";

  type Tab = "board" | "score" | "log";

  let { session }: { session: GameSession } = $props();
  let tab = $state<Tab>("board");
  let settingsOpen = $state(false);

  const st = $derived(session.state);
  const sync = $derived(session.sync);
  const ready = $derived(st.initialized && !!session.bundle);
  const playing = $derived(st.phase === "playing");
  const tabs = $derived((["board", "score", "log"] as Tab[]).map((id) => ({ id, label: t(`room.tab_${id}`) })));
</script>

<Page title={st.label || session.room.label || session.room.id} back={href("/")}>
  {#snippet actions()}
    <RoomStatus {sync} />
    {#if ready && playing}
      <button type="button" class="icon-btn" aria-label={t("lobby.room_settings")} title={t("lobby.room_settings")} onclick={() => (settingsOpen = true)}>
        <Settings size={20} />
      </button>
    {/if}
  {/snippet}

  {#if sync.status === "deleted" || sync.status === "not_found"}
    <Notice kind="error">{t(`sync.${sync.status}_help`)}</Notice>
  {/if}
  {#if session.packError}<Notice kind="error">{session.packError}</Notice>{/if}
  <LockBanner {session} />

  {#if !ready}
    <p class="muted">{t("room.waiting")}</p>
  {:else if !playing}
    <Lobby {session} />
  {:else}
    <JoinCard {session} />
    <Tabs items={tabs} bind:value={tab} />
    {#key tab}
      {#if tab === "board"}
        <BoardTab {session} />
      {:else if tab === "score"}
        <ScoreSheet {session} />
      {:else}
        <LogView {session} />
      {/if}
    {/key}
    <RoomSheet {session} bind:open={settingsOpen} />
  {/if}
</Page>
