<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import type { Snippet } from "svelte";
  import { t } from "../i18n/index.svelte";

  let { open = $bindable(), title, children }: { open: boolean; title: string; children: Snippet } = $props();
  let el: HTMLDialogElement | undefined = $state();

  $effect(() => {
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
  class="sheet"
  bind:this={el}
  oncancel={(e) => {
    e.preventDefault();
    open = false;
  }}
  onclick={(e) => e.target === el && (open = false)}
>
  <div class="sheet-body">
    <header class="sheet-head">
      <h2>{title}</h2>
      <button type="button" class="icon-btn" aria-label={t("common.close")} onclick={() => (open = false)}><X size={20} /></button>
    </header>
    {#if open}{@render children()}{/if}
  </div>
</dialog>
