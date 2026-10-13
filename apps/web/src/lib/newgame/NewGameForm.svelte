<script lang="ts">
  import { untrack } from "svelte";
  import type { PackRow } from "../core/db";
  import { go } from "../core/nav";
  import type { HostConfig } from "../core/relay";
  import { i18n, t } from "../i18n/index.svelte";
  import Field from "../ui/Field.svelte";
  import Notice from "../ui/Notice.svelte";
  import Panel from "../ui/Panel.svelte";
  import { createGame } from "./create-game";
  import ModulePicker from "./ModulePicker.svelte";
  import PlayerList from "./PlayerList.svelte";

  let { host, packs, initial = null }: { host: HostConfig; packs: PackRow[]; initial?: string | null } = $props();

  let picked = $state<string | null>(null);
  const hash = $derived(picked ?? (packs.some((p) => p.hash === initial) ? initial! : (packs[0]?.hash ?? "")));
  let label = $state("");
  let modules = $state<string[]>([]);
  let names = $state<string[]>(["", "", ""]);
  let me = $state(0);
  let allowGuests = $state(true);
  let busy = $state(false);
  let error = $state("");

  const bundle = $derived(packs.find((p) => p.hash === hash)?.bundle ?? null);
  const limits = $derived(bundle?.game.players ?? { min: 1, max: 8 });

  $effect(() => {
    const b = bundle;
    if (!b) return;
    untrack(() => {
      modules = b.game.modules.filter((m) => m.default).map((m) => m.id);
      const { min, max } = b.game.players;
      const n = Math.min(max, Math.max(min, names.length));
      names = Array.from({ length: n }, (_, i) => names[i] ?? "");
    });
  });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!bundle) return;
    busy = true;
    error = "";
    try {
      const room = await createGame(host, {
        bundle,
        label: label.trim() || `${i18n.packName(bundle)} · ${new Date().toLocaleDateString()}`,
        modules: $state.snapshot(modules),
        seats: names.map((n, i) => n.trim() || t("new.player_n", { n: i + 1 })),
        me,
        allowGuests,
      });
      await go(`/room/${room}`);
    } catch (err) {
      error = (err as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<form class="page" onsubmit={submit}>
  <Panel>
    <Field label={t("new.game")}>
      <select class="select" value={hash} onchange={(e) => (picked = e.currentTarget.value)}>
        {#each packs as p (p.hash)}
          <option value={p.hash}>{i18n.packName(p.bundle)} · {p.version}</option>
        {/each}
      </select>
    </Field>
    <Field label={t("new.label")}>
      <input class="input" bind:value={label} placeholder={t("new.label_placeholder")} />
    </Field>
    {#if bundle?.game.modules.length}
      <Field label={t("new.modules")}>
        <ModulePicker {bundle} bind:selected={modules} />
      </Field>
    {/if}
  </Panel>

  <Panel title={t("new.players", { count: names.length })} hint={t("new.players_help", { min: limits.min, max: limits.max })}>
    <PlayerList bind:names bind:me min={limits.min} max={limits.max} />
    <label class="check"><input type="checkbox" bind:checked={allowGuests} />{t("new.allow_guests")}</label>
  </Panel>

  {#if error}<Notice kind="error">{error}</Notice>{/if}
  <button type="submit" class="btn btn-primary btn-block" disabled={busy || !bundle}>
    {busy ? t("common.working") : t("new.create")}
  </button>
</form>
