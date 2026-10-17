<script lang="ts">
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import { type PackBundle, moduleLocked, moduleTree } from "@tessera/engine";
  import { moduleIcon } from "../../core/pack-ui";
  import Glyph from "../../ui/Glyph.svelte";
  import Switch from "../../ui/Switch.svelte";
  import MiniBox from "../../home/MiniBox.svelte";
  import { confirmAction } from "../../ui/dialog.svelte";
  import { toasts } from "../../ui/toast.svelte";
  import { applyPackUpdate, findPackUpdate } from "../pack-update";
  import { i18n, t } from "../../i18n/index.svelte";
  import type { GameSession } from "../../sync/session.svelte";

  let { session }: { session: GameSession } = $props();

  const bundle = $derived(session.bundle!);
  // Inside a module's tile live its variants (shown while it is on) and its parts (always shown, forced on with it).
  const modules = $derived(moduleTree(bundle.game));
  const glyph = (id: string) => moduleIcon(bundle, id);
  const active = $derived(session.state.modules);
  const tr = $derived(i18n.pack(bundle)!);
  const name = $derived(i18n.packName(bundle));

  let update = $state.raw<{ bundle: PackBundle; dev: boolean } | null>(null);

  // The host can move the room to a newer (or locally edited) version of the same pack.
  $effect(() => {
    const current = bundle;
    if (!session.isHost) return;
    void findPackUpdate(current).then((u) => {
      if (current === bundle) update = u;
    });
  });

  async function upgrade() {
    const u = update;
    if (!u || !(await confirmAction(t("lobby.update_title", { version: u.bundle.version }), t("lobby.update_body"), t("lobby.update")))) return;
    await applyPackUpdate(session, u);
    update = null;
    toasts.show(t("lobby.update_done", { version: u.bundle.version }));
  }

  // The fold drops variants of a module switched off and adds its parts.
  const toggle = (id: string) =>
    session.submit({ t: "modules.set", modules: active.includes(id) ? active.filter((m) => m !== id) : [...active, id] });
</script>

<div class="stack-s">
  <div class="game-summary">
    <MiniBox id={bundle.id} {bundle} {name} />
    <strong class="grow truncate">{name}</strong>
    {#if bundle.game.edition}<span class="badge">{t("common.edition", { n: bundle.game.edition })}</span>{/if}
    <span class="tiny muted">v{bundle.version}</span>
  </div>
  {#if update}
    <button type="button" class="btn btn-s" onclick={upgrade}><RefreshCw size={16} />{t("lobby.update_to", { version: update.bundle.version })}</button>
  {/if}
  {#if modules.length}
    <div class="toggle-grid">
      {#each modules as { def, variants, parts } (def.id)}
        {@const inside = [...(active.includes(def.id) ? variants : []), ...parts]}
        <div class="module-tile" class:open={inside.length}>
          <Switch
            checked={active.includes(def.id)}
            disabled={!session.isHost}
            title={session.isHost ? undefined : t("room.host_only")}
            onchange={() => toggle(def.id)}
          >
            {#if glyph(def.id)}<Glyph value={glyph(def.id)} />{/if}
            <span class="truncate">{tr.t(`modules.${def.id}`, undefined, def.id)}</span>
          </Switch>
          {#if inside.length}
            <div class="module-variants">
              {#each inside as v (v.id)}
                <Switch small checked={active.includes(v.id)} disabled={!session.isHost || moduleLocked(active, v)} onchange={() => toggle(v.id)}>
                  {#if glyph(v.id)}<Glyph value={glyph(v.id)} />{/if}
                  <span>{tr.t(`modules.${v.id}`, undefined, v.id)}</span>
                </Switch>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <p class="small muted">{t("lobby.no_modules")}</p>
  {/if}
</div>
