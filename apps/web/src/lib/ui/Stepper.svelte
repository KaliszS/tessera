<script lang="ts">
  import Minus from "@lucide/svelte/icons/minus";
  import Plus from "@lucide/svelte/icons/plus";

  let {
    value,
    step = 1,
    label,
    onadd,
    onedit,
  }: { value: number; step?: number; label: string; onadd: (delta: number) => void; onedit: () => void } = $props();
</script>

<div class="stepper" role="group" aria-label={label}>
  <button type="button" class="icon-btn" aria-label="−{step}" onclick={() => onadd(-step)}><Minus size={20} /></button>
  <button type="button" class="stepper-value" onclick={onedit}>{value}</button>
  <button type="button" class="icon-btn" aria-label="+{step}" onclick={() => onadd(step)}><Plus size={20} /></button>
</div>
