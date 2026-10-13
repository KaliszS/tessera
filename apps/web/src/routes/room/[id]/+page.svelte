<script lang="ts">
  import { page } from "$app/state";
  import { href } from "$lib/core/nav";
  import { t } from "$lib/i18n/index.svelte";
  import RoomEffects from "$lib/room/RoomEffects.svelte";
  import RoomView from "$lib/room/RoomView.svelte";
  import { useRoom } from "$lib/room/use-room.svelte";
  import Notice from "$lib/ui/Notice.svelte";
  import Page from "$lib/ui/Page.svelte";

  const room = useRoom(() => page.params.id ?? "");
</script>

{#if room.missing}
  <Page title={t("room.unknown_title")} back={href("/")}>
    <Notice>{t("room.unknown")}</Notice>
  </Page>
{:else if !room.session}
  <p class="muted">{t("common.loading")}</p>
{:else}
  <RoomEffects session={room.session} />
  <RoomView session={room.session} />
{/if}
