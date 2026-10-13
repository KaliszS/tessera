<script lang="ts">
  import Crown from "@lucide/svelte/icons/crown";
  import Ellipsis from "@lucide/svelte/icons/ellipsis";
  import type { PackBundle } from "@tessera/engine";
  import type { RoomRow } from "../core/db";
  import { href } from "../core/nav";
  import { i18n, t } from "../i18n/index.svelte";
  import { hueOf } from "./shelf";

  let { room, bundle, onmenu }: { room: RoomRow; bundle: PackBundle | null; onmenu: () => void } = $props();

  const MAX_AVATARS = 5;
  const seats = $derived(room.seats ?? []);
  const gameName = $derived(bundle ? i18n.packName(bundle) : "");
  const ago = $derived(relative(room.lastSeen));

  function relative(ts: number): string {
    const rtf = new Intl.RelativeTimeFormat(i18n.locale, { numeric: "auto", style: "short" });
    const s = (ts - Date.now()) / 1000;
    for (const [unit, sec] of [["day", 86400], ["hour", 3600], ["minute", 60]] as const) {
      if (Math.abs(s) >= sec) return rtf.format(Math.round(s / sec), unit);
    }
    return rtf.format(0, "minute");
  }
</script>

<li class="room-card enter">
  <a class="room-card-main" href={href(`/room/${room.id}`)}>
    <span class="mini-box" style:--hue={hueOf(room.packId ?? room.id)} title={gameName}>{(gameName || "?").charAt(0)}</span>
    <span class="room-card-body">
      <span class="room-card-title truncate">{room.label || gameName || room.id}</span>
      <span class="room-card-meta">
        {#if seats.length}
          <span class="avatars">
            {#each seats.slice(0, MAX_AVATARS) as s, i (i)}
              <span class="avatar" class:mine={s.mine} style:--c={s.color ?? "var(--border-strong)"} title={s.name}>{s.name.charAt(0)}</span>
            {/each}
            {#if seats.length > MAX_AVATARS}<span class="avatar more">+{seats.length - MAX_AVATARS}</span>{/if}
          </span>
        {/if}
        <span class="tiny muted">{ago}</span>
        {#if room.role === "host"}<span class="host-mark" title={t("home.role_host")}><Crown size={13} /></span>{/if}
      </span>
    </span>
  </a>
  <button type="button" class="icon-btn" aria-label={t("home.room_actions")} onclick={onmenu}><Ellipsis size={18} /></button>
</li>
