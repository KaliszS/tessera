<script lang="ts">
  import Puzzle from "@lucide/svelte/icons/puzzle";
  import { i18n, t } from "../i18n/index.svelte";
  import type { GameSession } from "../sync/session.svelte";
  import Panel from "../ui/Panel.svelte";

  let { session }: { session: GameSession } = $props();

  const modules = $derived(session.bundle?.game.modules ?? []);
  const active = $derived(session.state.modules);
  const tr = $derived(i18n.pack(session.bundle));

  function toggle(id: string) {
    const next = active.includes(id) ? active.filter((m) => m !== id) : [...active, id];
    session.submit({ t: "modules.set", modules: next });
  }
</script>

{#if modules.length}
  <Panel title={t("room.modules")} icon={Puzzle}>
    <div class="row">
      {#each modules as m (m.id)}
        <button
          type="button"
          class="chip"
          aria-pressed={active.includes(m.id)}
          disabled={!session.isHost}
          title={session.isHost ? undefined : t("room.host_only")}
          onclick={() => toggle(m.id)}
        >
          {tr?.t(`modules.${m.id}`, undefined, m.id)}
        </button>
      {/each}
    </div>
  </Panel>
{/if}
