import type { GameState } from "@tessera/engine";
import { randomId } from "../core/util";
import { t } from "../i18n/index.svelte";
import type { GameSession } from "../sync/session.svelte";
import { ask, confirmAction } from "../ui/dialog.svelte";

export async function addSeat(session: GameSession) {
  const name = (await ask(t("room.your_name")))?.trim();
  if (name) await session.submit({ t: "seat.add", seat: randomId("g", 6).replace("_", ""), name: name.slice(0, 40) });
}

export async function renameSeat(session: GameSession, seat: string, current: string) {
  const name = (await ask(t("room.rename"), current))?.trim();
  if (name && name !== current) await session.submit({ t: "seat.update", seat, name: name.slice(0, 40) });
}

export async function removeSeat(session: GameSession, seat: string, name: string) {
  if (await confirmAction(t("room.remove_confirm", { name }), undefined, t("common.remove"), true)) {
    await session.submit({ t: "seat.remove", seat });
  }
}

export function moveSeat(session: GameSession, state: GameState, seat: string, dir: -1 | 1) {
  const order = state.seats.map((s) => s.id);
  const i = order.indexOf(seat);
  const j = i + dir;
  if (j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  void session.submit({ t: "seat.order", order });
}

export const canAddSeat = (session: GameSession) =>
  (session.isHost || session.state.allowGuestSeats) && session.state.seats.length < (session.bundle?.game.players.max ?? 0);
