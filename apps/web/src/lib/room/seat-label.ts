import type { GameState, SeatState } from "@tessera/engine";
import { t as appT } from "../i18n/index.svelte";

type Translate = (key: string, params?: Record<string, string | number>) => string;

const seatNo = (state: GameState, seat: SeatState) => state.seats.findIndex((s) => s.id === seat.id) + 1;

/** Name shown for a seat; an unnamed one is "Player N" after its place at the table. */
export const seatLabel = (state: GameState, seat: SeatState, t: Translate = appT) =>
  seat.name || t("room.seat_n", { n: seatNo(state, seat) });

/** What an avatar shows: the name's first letter, or the seat number when unnamed. */
export const seatInitial = (state: GameState, seat: SeatState) => seat.name || String(seatNo(state, seat));
