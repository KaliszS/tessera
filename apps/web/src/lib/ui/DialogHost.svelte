<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import { dialogs } from "./dialog.svelte";

  let el: HTMLDialogElement | undefined = $state();
  let value = $state("");
  const req = $derived(dialogs.current);

  $effect(() => {
    if (!el) return;
    if (req && !el.open) {
      value = req.input?.value ?? "";
      el.showModal();
    } else if (!req && el.open) {
      el.close();
    }
  });

  function submit(e: SubmitEvent) {
    e.preventDefault();
    dialogs.close(req?.input ? value : true);
  }
</script>

<!-- Clicks outside the inner body land on the <dialog> itself, i.e. on the backdrop.
     No onclose handler: the close event of one request arrives late and would cancel the next one. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
  class="dialog"
  bind:this={el}
  oncancel={() => dialogs.close(null)}
  onclick={(e) => e.target === el && dialogs.close(null)}
>
  {#if req}
    <form class="dialog-body" onsubmit={submit}>
      <h2>{req.title}</h2>
      {#if req.body}<p class="muted">{req.body}</p>{/if}
      {#if req.input}
        <!-- svelte-ignore a11y_autofocus -->
        <input
          class="input"
          type="text"
          inputmode={req.input.type === "number" ? "numeric" : undefined}
          aria-label={req.input.label ?? req.title}
          bind:value
          autofocus
        />
      {/if}
      {#if req.options}
        <div class="stack-s">
          {#each req.options as o (o.id)}
            <button type="button" class="btn btn-block {o.danger ? 'btn-danger' : ''}" onclick={() => dialogs.close(o.id)}>{o.label}</button>
          {/each}
        </div>
      {:else}
        <div class="dialog-actions">
          <button type="button" class="btn" onclick={() => dialogs.close(null)}>{t("common.cancel")}</button>
          <button type="submit" class="btn {req.danger ? 'btn-danger' : 'btn-primary'}">{req.confirmLabel ?? t("common.ok")}</button>
        </div>
      {/if}
    </form>
  {/if}
</dialog>
