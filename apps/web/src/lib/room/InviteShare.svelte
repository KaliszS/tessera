<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Copy from "@lucide/svelte/icons/copy";
  import Share from "@lucide/svelte/icons/share-2";
  import X from "@lucide/svelte/icons/x";
  import { t } from "../i18n/index.svelte";
  import Panel from "../ui/Panel.svelte";
  import Qr from "../ui/Qr.svelte";

  let { title, url, onclose }: { title: string; url: string; onclose: () => void } = $props();
  let copied = $state(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }

  async function share() {
    if (navigator.share) await navigator.share({ title: "Tessera", text: title, url }).catch(() => {});
    else await copy();
  }
</script>

<Panel {title}>
  {#snippet actions()}
    <button type="button" class="icon-btn" aria-label={t("common.close")} onclick={onclose}><X size={20} /></button>
  {/snippet}
  <div class="center enter">
    <Qr text={url} />
    <code class="copy-text small" data-testid="invite-link">{url}</code>
    <div class="row">
      <button type="button" class="btn" onclick={copy}>
        {#if copied}<Check size={18} />{t("invite.copied")}{:else}<Copy size={18} />{t("invite.copy")}{/if}
      </button>
      <button type="button" class="btn btn-primary" onclick={share}><Share size={18} />{t("invite.share")}</button>
    </div>
    <p class="tiny muted">{t("invite.secret_warning")}</p>
  </div>
</Panel>
