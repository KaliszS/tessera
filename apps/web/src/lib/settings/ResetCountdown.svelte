<script lang="ts">
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import { i18n, t } from "../i18n/index.svelte";

  let now = $state(Date.now());

  $effect(() => {
    const id = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(id);
  });

  // Cloudflare daily limits always reset at 00:00 UTC, whatever the local time zone.
  const next = $derived.by(() => {
    const d = new Date(now);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  });
  const left = $derived(Math.max(0, next - now));
  const time = $derived(`${Math.floor(left / 3_600_000)}h ${Math.floor((left % 3_600_000) / 60_000)}m`);
  const local = $derived(new Date(next).toLocaleTimeString(i18n.locale, { hour: "2-digit", minute: "2-digit" }));
</script>

<span class="badge" title={t("admin.reset_in", { time, local })}><RotateCw size={13} />{time}</span>
