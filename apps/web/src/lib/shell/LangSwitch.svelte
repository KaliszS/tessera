<script lang="ts">
  import Segmented from "../ui/Segmented.svelte";
  import { LOCALES, i18n, t } from "../i18n/index.svelte";
</script>

<Segmented
  compact
  label={t("common.language")}
  options={LOCALES.map((l) => ({ value: l.id, label: l.id.toUpperCase() }))}
  value={i18n.locale}
  onchange={(v) => i18n.set(v)}
/>
