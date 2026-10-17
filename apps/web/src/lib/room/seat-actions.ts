import { type GameState, NAME_MAX, type SeatState, mayAddSeat, mayAssign } from "@tessera/engine";
import { randomId } from "../core/util";
import { t } from "../i18n/index.svelte";
import type { GameSession } from "../sync/session.svelte";
import { ask, confirmAction } from "../ui/dialog.svelte";
import { nextSeatColor } from "./seat-colors";

/** Adds a seat; `mine` also claims it (guests' own seats are claimed automatically by the fold).
 * Your own seat needs a name; any other seat may stay unnamed until its player joins. Returns the new seat id. */
export async function addSeat(session: GameSession, mine: boolean, known?: string): Promise<string | null> {
  const name = (known ?? (mine ? await ask(t("room.your_name")) : ""))?.trim() ?? "";
  if (mine && !name) return null;
  const seat = randomId("s", 6).replace("_", "");
  await session.submit({ t: "seat.add", seat, name: name.slice(0, NAME_MAX), color: nextSeatColor(session.state.seats) });
  if (mine && session.isHost) await session.submit({ t: "seat.claim", seat });
  return seat;
}

/** Host puts a joined device on a free seat, or on a new seat named after them. */
export async function assignMember(session: GameSession, device: string, name: string, seat: string | "new") {
  const target = seat === "new" ? await addSeat(session, false, name) : seat;
  if (target) await session.submit({ t: "seat.assign", seat: target, device });
}

export async function updateSeat(session: GameSession, seat: string, name: string, color: string) {
  await session.submit({ t: "seat.update", seat, name: name.trim().slice(0, NAME_MAX), color });
}

export async function removeSeat(session: GameSession, seat: string, name: string) {
  if (await confirmAction(t("room.remove_confirm", { name }), undefined, t("common.remove"), true)) {
    await session.submit({ t: "seat.remove", seat });
  }
}

/** Makes a seat the first player by turning the table, so everyone keeps their neighbours. */
export function makeFirst(session: GameSession, seat: string) {
  const order = session.state.seats.map((s) => s.id);
  const i = order.indexOf(seat);
  if (i > 0) void session.submit({ t: "seat.order", order: [...order.slice(i), ...order.slice(0, i)] });
}

export function moveSeat(session: GameSession, state: GameState, seat: string, dir: -1 | 1) {
  const order = state.seats.map((s) => s.id);
  const i = order.indexOf(seat);
  const j = i + dir;
  if (j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  void session.submit({ t: "seat.order", order });
}

export const canAddSeat = (session: GameSession) => !!session.bundle && mayAddSeat(session.state, session.bundle.game, session.device);

export const canAssign = (session: GameSession, seat: SeatState) => mayAssign(session.state, session.device, seat);
