<script lang="ts">
  import { i18n } from "../i18n/index.svelte";
  import type { GameSession } from "../sync/session.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import Stepper from "../ui/Stepper.svelte";
  import { askNumber } from "../ui/dialog.svelte";

  let { session }: { session: GameSession } = $props();

  const bundle = $derived(session.bundle!);
  const tr = $derived(i18n.pack(bundle)!);
  const tracks = $derived(Object.entries(bundle.game.tracks));
  const set = (track: string, value: number) => session.submit({ t: "track.set", track, value });
  const range = (min: number, max: number) => Array.from({ length: max - min + 1 }, (_, i) => min + i);

  async function edit(track: string, label: string) {
    const v = await askNumber(label, session.state.tracks[track] ?? 0);
    if (v !== null) set(track, v);
  }
</script>

{#each tracks as [name, def] (name)}
  {@const label = tr.t(`tracks.${name}`, undefined, name)}
  {@const value = session.state.tracks[name] ?? def.initial}
  <div class="row spread">
    <span class="field-label">{label}</span>
    {#if def.min !== undefined && def.max !== undefined && def.max - def.min <= 9}
      <Segmented {label} options={range(def.min, def.max).map((v) => ({ value: v, label: String(v) }))} {value} onchange={(v) => set(name, v)} />
    {:else}
      <Stepper {label} {value} onadd={(d) => set(name, value + d)} onedit={() => edit(name, label)} />
    {/if}
  </div>
{/each}
