<script lang="ts">
  import ClipboardList from "@lucide/svelte/icons/clipboard-list";
  import { roundLabel } from "../core/pack-ui";
  import { i18n, t } from "../i18n/index.svelte";
  import type { GameSession } from "../sync/session.svelte";
  import Panel from "../ui/Panel.svelte";
  import Prepare from "./lobby/Prepare.svelte";
  import { setupSections } from "./setup-sections.svelte";

  let { session }: { session: GameSession } = $props();

  const bundle = $derived(session.bundle!);
  const st = $derived(session.state);
  const tr = $derived(i18n.pack(bundle)!);
  const track = $derived(bundle.game.setup?.rounds?.track);
  const round = $derived(track ? st.tracks[track] : undefined);
  const setup = setupSections(() => session, () => round);
  const sections = $derived(track ? setup.list : []);
  const done = $derived(sections.length > 0 && sections.every((s) => st.setupChecked[s.id]));
</script>

<!-- Preparation before the current round; folds away once every step is ticked. -->
{#if round !== undefined && sections.length}
  <Panel title={t("setup.round_title", { round: roundLabel(bundle, tr, round) })} icon={ClipboardList} open={!done}>
    {#snippet actions()}
      {#if done}<span class="badge badge-accent">{t("setup.round_done")}</span>{/if}
    {/snippet}
    <Prepare {session} {sections} />
  </Panel>
{/if}
