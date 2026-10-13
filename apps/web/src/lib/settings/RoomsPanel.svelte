<script lang="ts">
  import DoorOpen from "@lucide/svelte/icons/door-open";
  import Trash from "@lucide/svelte/icons/trash";
  import Users from "@lucide/svelte/icons/users";
  import type { RoomStats } from "@tessera/protocol";
  import { href } from "../core/nav";
  import { formatBytes } from "../core/util";
  import { t } from "../i18n/index.svelte";
  import Panel from "../ui/Panel.svelte";

  let { rooms, ondelete }: { rooms: RoomStats[]; ondelete: (room: RoomStats) => void } = $props();
</script>

<Panel title="{t('admin.rooms_title')} · {rooms.length}" icon={DoorOpen}>
  {#if rooms.length}
    <ul class="list">
      {#each rooms as r (r.room)}
        <li class="list-item">
          <a class="grow room-card-link" href={href(`/room/${r.room}`)}>
            <span class="truncate strong small">{r.label ?? r.room}</span>
            <span class="tiny muted row-nowrap">
              {r.head} · {formatBytes(r.size_bytes)} · <Users size={12} />{r.connections}
            </span>
          </a>
          <button type="button" class="icon-btn danger" aria-label={t("common.delete")} onclick={() => ondelete(r)}><Trash size={18} /></button>
        </li>
      {/each}
    </ul>
  {/if}
</Panel>
