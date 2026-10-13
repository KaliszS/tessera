<script lang="ts">
  import { toasts } from "./toast.svelte";
</script>

<div class="toasts" aria-live="polite">
  {#each toasts.items as toast (toast.id)}
    <button type="button" class="toast {toast.kind}" onclick={() => toasts.dismiss(toast.id)}>{toast.text}</button>
  {/each}
</div>
