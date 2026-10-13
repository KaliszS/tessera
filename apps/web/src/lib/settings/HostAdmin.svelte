<script lang="ts">
  import type { AdminRoomsResponse, RoomStats, UsageResponse } from "@tessera/protocol";
  import { getHostConfig } from "../core/db";
  import { relay } from "../core/relay";
  import { deleteRoom } from "../core/rooms";
  import { t } from "../i18n/index.svelte";
  import { confirmAction } from "../ui/dialog.svelte";
  import { toasts } from "../ui/toast.svelte";
  import RoomsPanel from "./RoomsPanel.svelte";
  import UsagePanel from "./UsagePanel.svelte";

  let { version }: { version: number } = $props();

  let rooms = $state.raw<AdminRoomsResponse | null>(null);
  let usage = $state.raw<UsageResponse | null>(null);

  async function load() {
    const host = await getHostConfig();
    if (!host) return;
    try {
      [rooms, usage] = await Promise.all([relay.adminRooms(host), relay.adminUsage(host)]);
    } catch {
      rooms = usage = null;
    }
  }

  $effect(() => {
    void version;
    void load();
  });

  async function remove(r: RoomStats) {
    const host = await getHostConfig();
    if (!host) return;
    if (!(await confirmAction(t("admin.delete_title"), t("admin.delete_confirm", { name: r.label ?? r.room }), t("common.delete"), true))) return;
    try {
      await deleteRoom(host, r.room);
      await load();
    } catch (e) {
      toasts.show((e as Error).message, "error");
    }
  }
</script>

{#if rooms || usage}
  <div class="area-usage">
    <UsagePanel {usage} storage={rooms ? { used: rooms.total_bytes, limit: rooms.limit_bytes } : null} />
  </div>
{/if}
{#if rooms}
  <div class="area-rooms"><RoomsPanel rooms={rooms.rooms} ondelete={remove} /></div>
{/if}
