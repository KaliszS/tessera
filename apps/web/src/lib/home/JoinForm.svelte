<script lang="ts">
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Link2 from "@lucide/svelte/icons/link-2";
  import { parseInvite } from "../core/invite";
  import { go } from "../core/nav";
  import { t } from "../i18n/index.svelte";
  import { toasts } from "../ui/toast.svelte";

  let link = $state("");

  function join(e: SubmitEvent) {
    e.preventDefault();
    const inv = parseInvite(link.trim());
    if (!inv) return toasts.show(t("home.bad_link"), "error");
    go(`/join?${new URLSearchParams({ s: inv.server, r: inv.room, t: inv.token, k: inv.key })}`);
  }
</script>

<form class="row-nowrap" onsubmit={join}>
  <div class="input-icon">
    <Link2 size={18} />
    <input class="input" bind:value={link} placeholder={t("home.join_placeholder")} aria-label={t("home.join_title")} />
  </div>
  <button type="submit" class="btn btn-primary" aria-label={t("home.join")} title={t("home.join")} disabled={!link.trim()}>
    <ArrowRight size={18} />
  </button>
</form>
