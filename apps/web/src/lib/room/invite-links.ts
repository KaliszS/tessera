import { getHostConfig } from "../core/db";
import type { RoomRow } from "../core/db";
import { inviteUrl } from "../core/invite";
import { relay } from "../core/relay";
import { t } from "../i18n/index.svelte";

const link = (room: RoomRow, token: string) => inviteUrl({ server: room.server, room: room.id, token, key: room.key });

/** Link anyone can use to join and pick a seat. */
export const roomInvite = (room: RoomRow) => link(room, room.playerToken ?? room.token);

/** Link that claims one specific seat; minted by the host's relay. */
export async function seatInvite(room: RoomRow, seat: string): Promise<string> {
  const host = await getHostConfig();
  if (!host) throw new Error(t("invite.need_host"));
  const { token } = await relay.mintToken(host, room.id, { role: "player", seat, exp: null });
  return link(room, token);
}
