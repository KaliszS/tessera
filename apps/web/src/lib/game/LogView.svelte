<script lang="ts">
  import { i18n, t } from "../i18n/index.svelte";
  import type { GameSession } from "../sync/session.svelte";
  import Empty from "../ui/Empty.svelte";
  import Panel from "../ui/Panel.svelte";
  import LogEntry from "./LogEntry.svelte";
  import { describeEvent } from "./log-text";

  let { session }: { session: GameSession } = $props();

  const NOT_UNDOABLE = new Set(["undo", "room.init", "pack.attach"]);
  const st = $derived(session.state);
  const tr = $derived(i18n.pack(session.bundle));
  const entries = $derived([...st.log].reverse());
  const redoOf = $derived(
    new Map(st.log.flatMap((l) => (l.event.t === "undo" ? [[l.event.target, l.seq] as const] : []))),
  );

  function who(dev: string) {
    const names = st.seats.filter((s) => s.device === dev).map((s) => s.name);
    if (names.length) return names.join(", ");
    return dev === st.host ? t("log.host") : `…${dev.slice(-4)}`;
  }
</script>

<div class="tab-panel">
  <Panel>
    {#if entries.length === 0}
      <Empty>{t("log.empty")}</Empty>
    {:else}
      <ul class="list">
        {#each entries as entry (entry.seq)}
          <LogEntry
            {entry}
            text={describeEvent(entry.event, st, session.bundle, tr, t)}
            who={who(entry.dev)}
            canUndo={!NOT_UNDOABLE.has(entry.event.t)}
            redoTarget={redoOf.get(entry.seq)}
            onundo={(target) => session.submit({ t: "undo", target })}
          />
        {/each}
      </ul>
    {/if}
  </Panel>
</div>
