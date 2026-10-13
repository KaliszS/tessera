<script lang="ts">
  import type { Snippet } from "svelte";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import { t } from "../i18n/index.svelte";

  let { title, back, actions, children }: { title: string; back?: string; actions?: Snippet; children: Snippet } = $props();
</script>

<section class="page">
  <header class="page-head">
    {#if back}
      <a class="icon-btn" href={back} aria-label={t("common.back")}><ArrowLeft size={22} /></a>
    {/if}
    <h1 class="truncate">{title}</h1>
    {@render actions?.()}
  </header>
  {@render children()}
</section>
