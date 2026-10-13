<script lang="ts">
  import Redo from "@lucide/svelte/icons/redo-2";
  import Undo from "@lucide/svelte/icons/undo-2";
  import type { LogEntry } from "@tessera/engine";
  import { t } from "../i18n/index.svelte";

  let {
    entry,
    text,
    who,
    canUndo,
    redoTarget,
    onundo,
  }: { entry: LogEntry; text: string; who: string; canUndo: boolean; redoTarget: number | undefined; onundo: (seq: number) => void } =
    $props();
</script>

<li class="log-entry" class:dim={entry.status !== "applied"} class:reverted={entry.status === "reverted"}>
  <span class="log-seq">#{entry.seq}</span>
  <div class="grow">
    <div class="log-text">{text}</div>
    <div class="tiny muted">
      {who} · {new Date(entry.ts).toLocaleTimeString()}
      {#if entry.status === "rejected"} · <span class="text-danger">{entry.reason}</span>{/if}
      {#if entry.status === "reverted"} · {t("log.reverted")}{/if}
    </div>
  </div>
  {#if canUndo && entry.status === "applied"}
    <button type="button" class="icon-btn" aria-label={t("log.undo_btn")} title={t("log.undo_btn")} onclick={() => onundo(entry.seq)}>
      <Undo size={18} />
    </button>
  {:else if canUndo && entry.status === "reverted" && redoTarget}
    <button type="button" class="icon-btn" aria-label={t("log.redo_btn")} title={t("log.redo_btn")} onclick={() => onundo(redoTarget)}>
      <Redo size={18} />
    </button>
  {/if}
</li>
