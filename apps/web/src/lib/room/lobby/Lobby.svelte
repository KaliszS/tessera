<script lang="ts">
  import Play from "@lucide/svelte/icons/play";
  import { SETUP_AREAS, type SetupArea, modulesOn, moduleTree, playerRange, sectionArea, stepKey } from "@tessera/engine";
  import { i18n, t } from "../../i18n/index.svelte";
  import type { GameSession } from "../../sync/session.svelte";
  import { confirmAction } from "../../ui/dialog.svelte";
  import Notice from "../../ui/Notice.svelte";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import JoinCard from "../JoinCard.svelte";
  import Assign from "./Assign.svelte";
  import GameSettings from "./GameSettings.svelte";
  import Players from "./Players.svelte";
  import Prepare from "./Prepare.svelte";
  import Step from "./Step.svelte";
  import { seatLabel } from "../seat-label";
  import { setupSections } from "../setup-sections.svelte";
  import { refFields } from "./status";

  type StepId = "game" | "players" | "assign" | SetupArea;
  // A step counts as done only once the host confirms it with "Next" (recorded under its stepKey).
  const isArea = (id: StepId): id is SetupArea => (SETUP_AREAS as readonly string[]).includes(id);

  let { session }: { session: GameSession } = $props();

  const bundle = $derived(session.bundle!);
  const st = $derived(session.state);
  const tr = $derived(i18n.pack(bundle)!);
  const fields = $derived(refFields(bundle));
  const setup = setupSections(() => session);

  // Setup splits into one step per area that the enabled sections use (players' places, shared components, the table).
  const areas = $derived(
    SETUP_AREAS.filter((a) => (bundle.game.setup?.sections ?? []).some((s) => sectionArea(s) === a && modulesOn(st.modules, s.module))),
  );
  const byArea = $derived(Object.fromEntries(SETUP_AREAS.map((a) => [a, setup.list.filter((s) => s.area === a)])));
  const steps = $derived(
    (["game", "players", ...(fields.length ? ["assign"] : []), ...areas] as StepId[]).map((id) => ({
      id,
      done: !!st.setupChecked[stepKey(id)],
    })),
  );
  // Players still needed before the game can start; the table cannot play below the game's minimum.
  const range = $derived(playerRange(bundle.game, st.modules));
  const short = $derived(Math.max(0, range.min - st.seats.length));
  // Turning a module off can shrink the table below the seats already taken.
  const over = $derived(Math.max(0, st.seats.length - range.max));
  const current = $derived(steps.find((s) => !s.done)?.id ?? null);
  const progress = $derived(steps.filter((s) => s.done).length);

  // The current step opens by itself; the user may open or close any step.
  let manual = $state<Partial<Record<StepId, boolean>>>({});
  const isOpen = (id: StepId) => manual[id] ?? id === current;

  const summary = (id: StepId): string => {
    if (id === "game") {
      // Variants read as part of their module ("Leaders (Expert), Cities"); a part on its own (e.g. one board of an
      // expansion's box) is listed by name, and goes unsaid with its module on.
      const on = (id: string) => st.modules.includes(id);
      const name = (m: string) => tr.t(`modules.${m}`, undefined, m);
      const names = moduleTree(bundle.game).flatMap(({ def, variants, parts }) => {
        if (!on(def.id)) return parts.filter((p) => on(p.id)).map((p) => name(p.id));
        const vs = variants.filter((v) => on(v.id)).map((v) => name(v.id));
        return [vs.length ? `${name(def.id)} (${vs.join(", ")})` : name(def.id)];
      });
      return names.length ? names.join(", ") : t("lobby.base_game");
    }
    if (id === "players") {
      const names = st.seats.length ? st.seats.map((s) => seatLabel(st, s)).join(", ") : t("lobby.no_players");
      if (short) return `${names} · ${t("lobby.min_players", { min: range.min })}`;
      return over ? `${names} · ${t("lobby.max_players", { max: range.max })}` : names;
    }
    if (id === "assign") return t("lobby.assigned", { done: st.seats.filter((s) => fields.every(([k]) => s.fields[k] != null)).length, total: st.seats.length });
    const list = byArea[id];
    if (id === "table") return list.map((s) => tr.t(`setup.${s.section}`, undefined, s.section)).join(", ");
    return t("lobby.prepared", { done: list.filter((s) => st.setupChecked[s.id]).length, total: list.length });
  };

  // "Next" confirms a step and opens the following one; on the last step it only confirms.
  function next(from: StepId, to: StepId | undefined) {
    if (!st.setupChecked[stepKey(from)]) session.submit({ t: "setup.check", section: stepKey(from), done: true });
    manual = to ? { ...manual, [from]: false, [to]: true } : { ...manual, [from]: false };
  }

  async function start() {
    const missing = steps.filter((s) => !s.done && !isArea(s.id));
    if (missing.length && !(await confirmAction(t("lobby.start_anyway"), t("lobby.start_missing", { steps: missing.map((s) => t(`lobby.step_${s.id}`)).join(", ") }), t("lobby.start")))) return;
    session.submit({ t: "phase.set", phase: "playing" });
  }
</script>

<div class="lobby">
  <JoinCard {session} />
  <div class="lobby-progress" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={progress}>
    <div style:width="{(100 * progress) / steps.length}%"></div>
  </div>
  <ol class="steps">
    {#each steps as step, i (step.id)}
      <Step
        index={i + 1}
        title={t(`lobby.step_${step.id}`)}
        summary={summary(step.id)}
        done={step.done}
        current={step.id === current}
        bind:open={() => isOpen(step.id), (v) => (manual[step.id] = v)}
      >
        {#if step.id === "game"}
          <GameSettings {session} />
        {:else if step.id === "players"}
          <Players {session} />
        {:else if step.id === "assign"}
          <Assign {session} />
        {:else}
          <Prepare {session} sections={byArea[step.id]} />
        {/if}
        {#if session.isHost}
          <div class="step-foot">
            <button type="button" class="step-next" onclick={() => next(step.id, steps[i + 1]?.id)}>
              {t("lobby.next")}<ChevronRight size={16} />
            </button>
          </div>
        {/if}
      </Step>
    {/each}
  </ol>
  {#if session.isHost}
    {#if short}<Notice kind="warn">{t("lobby.need_players", { count: short })}</Notice>{/if}
    {#if over}<Notice kind="warn">{t("lobby.too_many_players", { count: over, max: range.max })}</Notice>{/if}
    <button type="button" class="btn btn-primary btn-block lobby-start" disabled={short > 0 || over > 0} onclick={start}><Play size={18} />{t("lobby.start")}</button>
  {:else}
    <Notice>{t("lobby.waiting_host")}</Notice>
  {/if}
</div>
