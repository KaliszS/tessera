<script lang="ts">
  import { onMount } from "svelte";
  import type { PackBundle } from "@tessera/engine";
  import { type RoomRow, db, getHostConfig } from "../core/db";
  import { listPacks } from "../core/packs";
  import type { HostConfig } from "../core/relay";
  import { deleteRoom, forgetRoom } from "../core/rooms";
  import { t } from "../i18n/index.svelte";
  import { choose, confirmAction } from "../ui/dialog.svelte";
  import Empty from "../ui/Empty.svelte";
  import { toasts } from "../ui/toast.svelte";
  import RoomCard from "./RoomCard.svelte";

  let rooms = $state.raw<RoomRow[]>([]);
  let host = $state.raw<HostConfig | null>(null);
  let bundles = $state.raw<Map<string, PackBundle>>(new Map());

  onMount(async () => {
    rooms = await db.rooms.orderBy("lastSeen").reverse().toArray();
    host = (await getHostConfig()) ?? null;
    bundles = new Map((await listPacks()).map((p) => [p.id, p.bundle]));
  });

  // Only rooms on this device's own relay can be deleted from here.
  const canDelete = (r: RoomRow) => r.role === "host" && !!host && host.server === r.server;

  async function menu(r: RoomRow) {
    const action = await choose(r.label || r.id, [
      { id: "forget", label: t("home.forget") },
      ...(canDelete(r) ? [{ id: "delete", label: t("home.delete_all"), danger: true }] : []),
    ]);
    if (action === "forget" && (await confirmAction(t("home.forget_title"), t("home.forget_confirm"), t("common.forget")))) {
      await forgetRoom(r.id);
      rooms = rooms.filter((x) => x.id !== r.id);
    }
    if (action === "delete" && host) {
      if (!(await confirmAction(t("admin.delete_title"), t("admin.delete_confirm", { name: r.label || r.id }), t("common.delete"), true))) return;
      try {
        await deleteRoom(host, r.id);
        rooms = rooms.filter((x) => x.id !== r.id);
      } catch (e) {
        toasts.show((e as Error).message, "error");
      }
    }
  }
</script>

{#if rooms.length === 0}
  <Empty>{t("home.empty")}</Empty>
{:else}
  <ul class="plain-list">
    {#each rooms as room (room.id)}
      <RoomCard {room} bundle={room.packId ? (bundles.get(room.packId) ?? null) : null} onmenu={() => menu(room)} />
    {/each}
  </ul>
{/if}
