<script lang="ts">
  import { onMount } from "svelte";
  import type { PackBundle } from "@tessera/engine";
  import { type RoomRow, db, getHostConfig } from "../core/db";
  import { listPacks } from "../core/packs";
  import type { HostConfig } from "../core/relay";
  import { deleteRoom, forgetRoom } from "../core/rooms";
  import { t } from "../i18n/index.svelte";
  import { confirmAction } from "../ui/dialog.svelte";
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

  async function forget(r: RoomRow) {
    if (!(await confirmAction(t("home.forget_title"), t("home.forget_confirm"), t("common.forget")))) return;
    await forgetRoom(r.id);
    rooms = rooms.filter((x) => x.id !== r.id);
  }

  async function remove(r: RoomRow) {
    if (!host) return;
    if (!(await confirmAction(t("admin.delete_title"), t("admin.delete_confirm", { name: r.label || r.id }), t("common.delete"), true))) return;
    try {
      await deleteRoom(host, r.id);
      rooms = rooms.filter((x) => x.id !== r.id);
    } catch (e) {
      toasts.show((e as Error).message, "error");
    }
  }
</script>

{#if rooms.length === 0}
  <Empty>{t("home.empty")}</Empty>
{:else}
  <ul class="plain-list">
    {#each rooms as room (room.id)}
      <RoomCard
        {room}
        bundle={room.packId ? (bundles.get(room.packId) ?? null) : null}
        canDelete={canDelete(room)}
        onforget={() => forget(room)}
        ondelete={() => remove(room)}
      />
    {/each}
  </ul>
{/if}
