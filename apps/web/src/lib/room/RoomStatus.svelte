<script lang="ts">
  import { t } from "../i18n/index.svelte";
  import type { RoomSync } from "../sync/sync.svelte";

  let { sync }: { sync: RoomSync } = $props();

  const tone = $derived(
    sync.status === "online" ? "ok" : sync.status === "offline" || sync.status === "deleted" || sync.status === "not_found" ? "danger" : "warn",
  );
</script>

<span class="pill {tone}" role="status">
  {t(`sync.${sync.status}`)}{#if sync.pending} · {sync.pending}{/if}
</span>
