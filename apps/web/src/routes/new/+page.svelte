<script lang="ts">
  import { onMount } from "svelte";
  import { type PackRow, getHostConfig } from "$lib/core/db";
  import { hashParams, href } from "$lib/core/nav";
  import { listPacks } from "$lib/core/packs";
  import type { HostConfig } from "$lib/core/relay";
  import { t } from "$lib/i18n/index.svelte";
  import NewGameForm from "$lib/newgame/NewGameForm.svelte";
  import Notice from "$lib/ui/Notice.svelte";
  import Page from "$lib/ui/Page.svelte";

  let host = $state.raw<HostConfig | null>(null);
  let packs = $state.raw<PackRow[]>([]);
  let loaded = $state(false);

  onMount(async () => {
    host = (await getHostConfig()) ?? null;
    packs = await listPacks();
    loaded = true;
  });
</script>

<Page title={t("new.title")} back={href("/")}>
  {#if !loaded}
    <p class="muted">{t("common.loading")}</p>
  {:else if !host}
    <Notice>{t("new.no_host")} <a href={href("/settings")}>{t("nav.settings")}</a></Notice>
  {:else if packs.length === 0}
    <Notice>{t("new.no_packs")}</Notice>
  {:else}
    <NewGameForm {host} {packs} initial={hashParams().get("pack")} />
  {/if}
</Page>
