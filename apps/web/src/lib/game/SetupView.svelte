<script lang="ts">
  import { type SetupSection as Section, computeSetup, drawRandom } from "@tessera/engine";
  import { rowId } from "../core/pack-ui";
  import { t } from "../i18n/index.svelte";
  import type { GameSession } from "../sync/session.svelte";
  import ModulesPanel from "./ModulesPanel.svelte";
  import SetupSection from "./SetupSection.svelte";

  let { session }: { session: GameSession } = $props();

  const bundle = $derived(session.bundle!);
  const st = $derived(session.state);
  let sections = $state.raw<Section[]>([]);

  $effect(() => {
    const players = st.seats.length;
    const modules = st.modules;
    const rolls = st.setupRolls;
    void computeSetup(bundle, players, modules, rolls).then((s) => (sections = s));
  });

  const catalogOf = (id: string) => bundle.game.setup?.sections.find((s) => s.id === id)?.catalog ?? "";

  async function draw(sec: Section) {
    if (!sec.random) return;
    const all = await computeSetup(bundle, st.seats.length, st.modules, {});
    const pool = all.find((s) => s.id === sec.id)?.items.map((i) => rowId(bundle, catalogOf(sec.id), i.row)) ?? [];
    session.submit({ t: "setup.roll", section: sec.id, picks: drawRandom(pool, sec.random.count) });
  }
</script>

<div class="stack tab-panel">
  <ModulesPanel {session} />
  <p class="small muted">{t("setup.help", { players: st.seats.length })}</p>
  {#each sections as section (section.id)}
    <SetupSection {bundle} {section} catalog={catalogOf(section.id)} ondraw={() => draw(section)} />
  {/each}
</div>
