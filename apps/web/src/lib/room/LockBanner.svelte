<script lang="ts">
  import Lock from "@lucide/svelte/icons/lock";
  import { t } from "../i18n/index.svelte";
  import type { GameSession } from "../sync/session.svelte";
  import Notice from "../ui/Notice.svelte";

  let { session }: { session: GameSession } = $props();
  const lock = $derived(session.sync.lock);
</script>

{#if lock}
  <Notice kind="warn">
    <Lock size={18} />
    <span class="grow">{t("room.locked", { label: lock.label })}</span>
    {#if session.isHost}
      <button type="button" class="btn btn-s" onclick={() => session.sync.releaseLock(true)}>{t("room.force_unlock")}</button>
    {/if}
  </Notice>
{/if}
