<script lang="ts">
  import { onMount } from "svelte";
  import { joinFromInvite } from "$lib/core/join";
  import { go, hashParams, href } from "$lib/core/nav";
  import { t } from "$lib/i18n/index.svelte";
  import Notice from "$lib/ui/Notice.svelte";
  import Page from "$lib/ui/Page.svelte";

  let error = $state("");

  onMount(async () => {
    const result = await joinFromInvite(hashParams());
    if (result.ok) await go(`/room/${result.room}`, { replaceState: true });
    else error = result.reason === "bad_link" ? t("join.bad_link") : t("join.rejected", { reason: result.reason });
  });
</script>

<Page title={t("join.title")} back={href("/")}>
  {#if error}
    <Notice kind="error">{error}</Notice>
  {:else}
    <p class="muted">{t("join.joining")}</p>
  {/if}
</Page>
