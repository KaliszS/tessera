<script lang="ts">
  import "../styles/index.css";
  import { onMount } from "svelte";
  import { onNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import { getHostConfig, setHostConfig } from "$lib/core/db";
  import { i18n } from "$lib/i18n/index.svelte";
  import AppHeader from "$lib/shell/AppHeader.svelte";
  import DialogHost from "$lib/ui/DialogHost.svelte";
  import ToastHost from "$lib/ui/ToastHost.svelte";

  let { children } = $props();
  let ready = $state(false);

  const route = $derived(page.route.id ?? "/");

  onMount(async () => {
    await i18n.load();
    if (import.meta.env.DEV && !(await getHostConfig())) {
      await setHostConfig({ server: `${location.origin}/relay`, secret: "dev-secret" });
    }
    ready = true;
  });

  onNavigate((navigation) => {
    if (!document.startViewTransition) return;
    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });
</script>

<div class="app">
  <AppHeader current={route} />
  <main class="app-main">
    {#if ready}{@render children()}{/if}
  </main>
  <ToastHost />
  <DialogHost />
</div>
