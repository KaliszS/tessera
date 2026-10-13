<script lang="ts">
  import QrCode from "@lucide/svelte/icons/qr-code";
  import { getHostConfig } from "../core/db";
  import { inviteUrl } from "../core/invite";
  import { relay } from "../core/relay";
  import { t } from "../i18n/index.svelte";
  import type { GameSession } from "../sync/session.svelte";
  import Dot from "../ui/Dot.svelte";
  import Notice from "../ui/Notice.svelte";
  import Panel from "../ui/Panel.svelte";
  import InviteShare from "./InviteShare.svelte";

  let { session }: { session: GameSession } = $props();

  const room = $derived(session.room);
  const st = $derived(session.state);
  let shown = $state<{ title: string; url: string } | null>(null);
  let error = $state("");

  const link = (token: string) => inviteUrl({ server: room.server, room: room.id, token, key: room.key });

  async function seatLink(seat: string, name: string) {
    error = "";
    const host = await getHostConfig();
    if (!host) return void (error = t("invite.need_host"));
    try {
      const { token } = await relay.mintToken(host, room.id, { role: "player", seat, exp: null });
      shown = { title: t("invite.for_seat", { name }), url: link(token) };
    } catch (e) {
      error = (e as Error).message;
    }
  }
</script>

<div class="stack tab-panel">
  {#if shown}
    <InviteShare title={shown.title} url={shown.url} onclose={() => (shown = null)} />
  {/if}

  <Panel title={t("invite.room_title")} hint={t("invite.room_help")}>
    <button type="button" class="btn btn-primary" onclick={() => (shown = { title: t("invite.room_title"), url: link(room.playerToken ?? room.token) })}>
      <QrCode size={18} />{t("invite.show_qr")}
    </button>
  </Panel>

  {#if session.isHost}
    <Panel title={t("invite.seat_title")} hint={t("invite.seat_help")}>
      <div class="row">
        {#each st.seats as s (s.id)}
          <button type="button" class="btn" disabled={!!s.device} onclick={() => seatLink(s.id, s.name)}>
            <Dot color={s.color} />{s.name}
          </button>
        {/each}
      </div>
      <label class="check">
        <input
          type="checkbox"
          checked={st.allowGuestSeats}
          onchange={(e) => session.submit({ t: "settings.set", allow_guest_seats: e.currentTarget.checked })}
        />
        {t("new.allow_guests")}
      </label>
    </Panel>
  {/if}

  {#if error}<Notice kind="error">{error}</Notice>{/if}
</div>
