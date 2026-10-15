import type { GameState } from "@tessera/engine";
import { randomId } from "../core/util";
import { t } from "../i18n/index.svelte";
import type { GameSession } from "../sync/session.svelte";
import { ask, confirmAction } from "../ui/dialog.svelte";
import { nextSeatColor } from "./seat-colors";

/** Adds a seat; `mine` also claims it (guests' own seats are claimed automatically by the fold). */
export async function addSeat(session: GameSession, mine: boolean) {
  const name = (await ask(mine ? t("room.your_name") : t("room.player_name")))?.trim();
  if (!name) return;
  const seat = randomId("s", 6).replace("_", "");
  await session.submit({ t: "seat.add", seat, name: name.slice(0, 40), color: nextSeatColor(session.state.seats) });
  if (mine && session.isHost) await session.submit({ t: "seat.claim", seat });
}

export async function updateSeat(session: GameSession, seat: string, name: string, color: string) {
  await session.submit({ t: "seat.update", seat, name: name.trim().slice(0, 40), color });
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
