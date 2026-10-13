<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";
  import { t } from "../i18n/index.svelte";
  import Dot from "../ui/Dot.svelte";
  import { SEAT_COLORS } from "./create-game";

  let {
    names = $bindable(),
    me = $bindable(),
    min,
    max,
  }: { names: string[]; me: number; min: number; max: number } = $props();

  function remove(i: number) {
    names = names.filter((_, j) => j !== i);
    if (me >= names.length) me = names.length - 1;
  }
</script>

<ul class="plain-list">
  {#each names as _, i (i)}
    <li class="row-nowrap">
      <Dot color={SEAT_COLORS[i % SEAT_COLORS.length]} large />
      <input class="input grow" bind:value={names[i]} placeholder={t("new.player_n", { n: i + 1 })} />
      <button
        type="button"
        class="chip"
        aria-pressed={me === i}
        onclick={() => (me = me === i ? -1 : i)}
      >
        {t("new.me")}
      </button>
      <button type="button" class="icon-btn" disabled={names.length <= min} aria-label={t("common.remove")} onclick={() => remove(i)}>
        <X size={18} />
      </button>
    </li>
  {/each}
</ul>
<button type="button" class="btn" disabled={names.length >= max} onclick={() => (names = [...names, ""])}>
  <Plus size={18} />{t("new.add_player")}
</button>
