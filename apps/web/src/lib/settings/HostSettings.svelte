<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Download from "@lucide/svelte/icons/download";
  import Smartphone from "@lucide/svelte/icons/smartphone";
  import Upload from "@lucide/svelte/icons/upload";
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import KeyRound from "@lucide/svelte/icons/key-round";
  import PlugZap from "@lucide/svelte/icons/plug-zap";
  import Save from "@lucide/svelte/icons/save";
  import Server from "@lucide/svelte/icons/server";
  import X from "@lucide/svelte/icons/x";
  import { onMount } from "svelte";
  import { getDeviceId, getHostConfig, setHostConfig } from "../core/db";
  import { relay } from "../core/relay";
  import { t } from "../i18n/index.svelte";
  import Panel from "../ui/Panel.svelte";
  import { exportToFile, importFromFile } from "./backup";

  let { onsaved }: { onsaved: () => void } = $props();

  let server = $state("");
  let secret = $state("");
  let reveal = $state(false);
  let status = $state<{ ok: boolean; text: string } | null>(null);
  let device = $state("");

  onMount(async () => {
    const h = await getHostConfig();
    server = h?.server ?? "";
    secret = h?.secret ?? "";
    device = await getDeviceId();
  });

  async function onImport(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      await importFromFile(file);
    } catch (err) {
      status = { ok: false, text: (err as Error).message };
    }
  }

  async function test() {
    status = null;
    try {
      await relay.adminRooms({ server, secret });
      status = { ok: true, text: t("settings.test_ok") };
    } catch (e) {
      status = { ok: false, text: (e as Error).message };
    }
  }

  async function save(e: SubmitEvent) {
    e.preventDefault();
    const s = server.trim().replace(/\/+$/, "");
    await setHostConfig(s ? { server: s, secret } : null);
    status = { ok: true, text: t("common.saved") };
    onsaved();
  }
</script>

<Panel title={t("settings.host_title")} icon={Server}>
  {#snippet actions()}
    {#if status}
      <span class={status.ok ? "text-ok" : "text-danger"} title={status.text} role="status" aria-label={status.text}>
        {#if status.ok}<Check size={20} />{:else}<X size={20} />{/if}
      </span>
    {/if}
    <button type="button" class="icon-btn" aria-label={t("settings.export")} title={t("settings.export")} onclick={exportToFile}>
      <Download size={18} />
    </button>
    <label class="icon-btn" aria-label={t("settings.import")} title={t("settings.import")}>
      <Upload size={18} />
      <input type="file" accept="application/json,.json" hidden onchange={onImport} />
    </label>
  {/snippet}
  <form class="stack-s" onsubmit={save}>
    <div class="input-icon">
      <Server size={18} />
      <input class="input" bind:value={server} placeholder="https://…workers.dev" aria-label={t("settings.server")} autocomplete="off" />
    </div>
    <div class="row-nowrap">
      <div class="input-icon">
        <KeyRound size={18} />
        <input class="input" type={reveal ? "text" : "password"} bind:value={secret} aria-label={t("settings.secret")} autocomplete="off" />
      </div>
      <button type="button" class="icon-btn" aria-label={reveal ? t("common.hide") : t("common.show")} onclick={() => (reveal = !reveal)}>
        {#if reveal}<EyeOff size={18} />{:else}<Eye size={18} />{/if}
      </button>
      <button type="button" class="icon-btn" aria-label={t("settings.test")} title={t("settings.test")} disabled={!server} onclick={test}>
        <PlugZap size={18} />
      </button>
      <button type="submit" class="btn btn-primary" aria-label={t("common.save")} title={t("common.save")}><Save size={18} /></button>
    </div>
  </form>
  <div class="device-line" title={t("settings.device_title")}><Smartphone size={14} /><code>{device}</code></div>
</Panel>
