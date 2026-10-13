<script lang="ts">
  import { href } from "../core/nav";
  import LogView from "../game/LogView.svelte";
  import ScoreSheet from "../game/ScoreSheet.svelte";
  import SetupView from "../game/SetupView.svelte";
  import { t } from "../i18n/index.svelte";
  import type { GameSession } from "../sync/session.svelte";
  import Notice from "../ui/Notice.svelte";
  import Page from "../ui/Page.svelte";
  import Tabs from "../ui/Tabs.svelte";
  import BoardTab from "./BoardTab.svelte";
  import InviteTab from "./InviteTab.svelte";
  import LockBanner from "./LockBanner.svelte";
  import RoomStatus from "./RoomStatus.svelte";
  import SeatPrompt from "./SeatPrompt.svelte";
  import TableTab from "./TableTab.svelte";

  type Tab = "board" | "table" | "score" | "setup" | "log" | "invite";

  let { session }: { session: GameSession } = $props();
  let tab = $state<Tab>("board");

  const st = $derived(session.state);
  const sync = $derived(session.sync);
  const ready = $derived(st.initialized && !!session.bundle);
  const tabs = $derived(
    (["board", "table", "score", "setup", "log", "invite"] as Tab[])
      .filter((id) => id !== "setup" || session.bundle?.game.setup)
      .map((id) => ({ id, label: t(`room.tab_${id}`) })),
  );
</script>

<Page title={st.label || session.room.label || session.room.id} back={href("/")}>
  {#snippet actions()}<RoomStatus {sync} />{/snippet}

  {#if sync.status === "deleted" || sync.status === "not_found"}
    <Notice kind="error">{t(`sync.${sync.status}_help`)}</Notice>
  {/if}
  {#if session.packError}<Notice kind="error">{session.packError}</Notice>{/if}
  <LockBanner {session} />

  {#if !ready}
    <p class="muted">{t("room.waiting")}</p>
  {:else}
    <SeatPrompt {session} />
    <Tabs items={tabs} bind:value={tab} />
    {#key tab}
      {#if tab === "board"}
        <BoardTab {session} />
      {:else if tab === "table"}
        <TableTab {session} />
      {:else if tab === "score"}
        <ScoreSheet {session} />
      {:else if tab === "setup"}
        <SetupView {session} />
      {:else if tab === "log"}
        <LogView {session} />
      {:else}
        <InviteTab {session} />
      {/if}
    {/key}
  {/if}
</Page>
