<script lang="ts">
  import Moon from "@lucide/svelte/icons/moon";
  import Sun from "@lucide/svelte/icons/sun";
  import { t } from "../i18n/index.svelte";
  import { theme } from "../theme/theme.svelte";

  const label = $derived(theme.current === "dark" ? t("theme.to_light") : t("theme.to_dark"));
</script>

<button type="button" class="icon-btn" aria-label={label} title={label} onclick={() => theme.toggle()}>
  {#if theme.current === "dark"}<Sun size={20} />{:else}<Moon size={20} />{/if}
</button>
