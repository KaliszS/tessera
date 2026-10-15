<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import X from "@lucide/svelte/icons/x";
  import { untrack } from "svelte";
  import type { SeatState } from "@tessera/engine";
  import { t } from "../i18n/index.svelte";
  import { SEAT_COLORS } from "./seat-colors";

  let { seat, onsave, oncancel }: { seat: SeatState; onsave: (name: string, color: string) => void; oncancel: () => void } =
    $props();

  // Draft values start from the seat and are edited locally until saved.
  let name = $state(untrack(() => seat.name));
  let color = $state(untrack(() => seat.color ?? SEAT_COLORS[0]));

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (name.trim()) onsave(name, color);
  }
</script>

<form class="seat-editor enter" onsubmit={submit}>
  <div class="row-nowrap">
    <input class="input grow" bind:value={name} aria-label={t("room.rename")} maxlength="40" />
    <button type="button" class="icon-btn" aria-label={t("common.cancel")} onclick={oncancel}><X size={18} /></button>
    <button type="submit" class="btn btn-primary" aria-label={t("common.save")} disabled={!name.trim()}><Check size={18} /></button>
  </div>
  <div class="swatches" role="radiogroup" aria-label={t("room.color")}>
    {#each SEAT_COLORS as c (c)}
      <button type="button" class="swatch" role="radio" aria-checked={c === color} aria-label={c} style:--c={c} onclick={() => (color = c)}></button>
    {/each}
  </div>
</form>
