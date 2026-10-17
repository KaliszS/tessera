<script lang="ts">
  import { SETUP_AREAS, type SetupSection } from "@tessera/engine";
  import { t } from "../../i18n/index.svelte";
  import type { GameSession } from "../../sync/session.svelte";
  import PrepCard from "./PrepCard.svelte";

  let { session, sections }: { session: GameSession; sections: SetupSection[] } = $props();

  // Players' places first, then shared components, then the picture of the table; headings only when areas mix.
  const groups = $derived(
    SETUP_AREAS.map((area) => ({ area, sections: sections.filter((s) => s.area === area) })).filter((g) => g.sections.length),
  );
</script>

<div class="stack-s">
  {#if sections.some((s) => s.count !== null || s.marks.length)}
    <p class="tiny muted">{t("setup.help", { players: session.state.seats.length })}</p>
  {/if}
  {#each groups as g (g.area)}
    {#if groups.length > 1}<h3 class="field-label prep-area">{t(`setup.area_${g.area}`)}</h3>{/if}
    <ul class="prep-list">
      {#each g.sections as sec (sec.id)}<PrepCard {session} {sec} />{/each}
    </ul>
  {/each}
</div>
