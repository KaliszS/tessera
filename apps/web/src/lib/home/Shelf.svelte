<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import { onMount } from "svelte";
  import { db } from "../core/db";
  import { go } from "../core/nav";
  import { describeError, fetchDevPacks, importPackFiles, installPack, listPacks } from "../core/packs";
  import { download } from "../core/util";
  import { i18n, t } from "../i18n/index.svelte";
  import { choose, confirmAction } from "../ui/dialog.svelte";
  import { toasts } from "../ui/toast.svelte";
  import GameBox from "./GameBox.svelte";
  import { type ShelfItem, shelfItems } from "./shelf";

  let items = $state.raw<ShelfItem[]>([]);
  let fileInput: HTMLInputElement | undefined = $state();
  let folderInput: HTMLInputElement | undefined = $state();

  async function refresh() {
    items = shelfItems(await listPacks(), await fetchDevPacks().catch(() => []));
  }
  onMount(refresh);

  async function install(item: ShelfItem) {
    if (item.dev?.errors.length) return toasts.show(item.dev.errors[0], "error", 8000);
    await installPack(item.bundle, "dev");
    toasts.show(t("home.installed", { name: i18n.packName(item.bundle) }));
    await refresh();
  }

  async function open(item: ShelfItem) {
    const row = item.installed;
    if (!row) return install(item);
    const action = await choose(i18n.packName(item.bundle), [
      { id: "play", label: t("home.new_room_with") },
      { id: "export", label: t("home.export_pack") },
      { id: "remove", label: t("common.remove"), danger: true },
    ]);
    if (action === "play") await go(`/new?pack=${row.hash}`);
    if (action === "export") download(`${row.id}.tessera.json`, JSON.stringify(row.bundle));
    if (action === "remove" && (await confirmAction(t("home.remove_pack"), undefined, t("common.remove"), true))) {
      await db.packs.delete(row.hash);
      await refresh();
    }
  }

  async function add() {
    const action = await choose(t("home.add_game"), [
      { id: "file", label: t("home.import_file") },
      { id: "folder", label: t("home.import_folder") },
    ]);
    if (action === "file") fileInput?.click();
    if (action === "folder") folderInput?.click();
  }

  async function onFiles(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    if (!input.files?.length) return;
    try {
      const { bundle, errors } = await importPackFiles(input.files);
      if (errors.length) toasts.show(errors[0], "error", 8000);
      else {
        await installPack(bundle, "import");
        toasts.show(t("home.installed", { name: i18n.packName(bundle) }));
      }
    } catch (err) {
      toasts.show(describeError(err)[0], "error", 8000);
    }
    input.value = "";
    await refresh();
  }
</script>

<section class="shelf" aria-label={t("home.shelf")}>
  <div class="shelf-row">
    {#each items as item (item.key)}
      <GameBox {item} onopen={() => open(item)} />
    {/each}
    <div class="shelf-item">
      <button type="button" class="game-box add" aria-label={t("home.add_game")} title={t("home.add_game")} onclick={add}>
        <Plus size={28} />
      </button>
    </div>
  </div>
  <div class="shelf-plank"></div>
  <input bind:this={fileInput} type="file" accept=".json,application/json" hidden onchange={onFiles} />
  <input bind:this={folderInput} type="file" webkitdirectory multiple hidden onchange={onFiles} />
</section>
