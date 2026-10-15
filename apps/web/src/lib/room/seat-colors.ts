import type { SeatState } from "@tessera/engine";

export const SEAT_COLORS = ["#e53935", "#1e88e5", "#43a047", "#fdd835", "#8e24aa", "#fb8c00", "#00acc1", "#6d4c41"];

/** First palette colour no seat uses yet (cycles when all are taken). */
export function nextSeatColor(seats: SeatState[]): string {
  const used = new Set(seats.map((s) => s.color));
  return SEAT_COLORS.find((c) => !used.has(c)) ?? SEAT_COLORS[seats.length % SEAT_COLORS.length];
}
