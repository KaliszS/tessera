import { type SetupSection, computeSetup } from "@tessera/engine";
import { untrack } from "svelte";
import type { GameSession } from "../sync/session.svelte";

/** The room's setup sections (before the game, or before `round()` when given), recomputed only when the inputs
 * they depend on change rather than on every event, with older async results never overwriting newer ones. */
export function setupSections(room: () => GameSession, round?: () => number | undefined) {
  let list = $state.raw<SetupSection[]>([]);
  let request = 0;
  // The folded state is rebuilt on every event, so depend on a value-equal key of the inputs instead.
  const key = $derived.by(() => {
    const session = room();
    const st = session.state;
    return JSON.stringify([session.bundle?.hash, round?.(), st.seats.length, st.modules, st.setupRolls]);
  });

  $effect(() => {
    void key;
    const session = untrack(room);
    const bundle = session.bundle;
    if (!bundle) return;
    const { seats, modules, setupRolls } = untrack(() => session.state);
    const r = untrack(() => round?.());
    const id = ++request;
    void computeSetup(bundle, seats.length, modules, setupRolls, r).then((s) => {
      if (id === request) list = s;
    });
  });

  return {
    get list() {
      return list;
    },
  };
}
