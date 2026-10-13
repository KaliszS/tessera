import type { GameEvent, GameState, PackBundle, PackTranslator } from "@tessera/engine";

/** One-line, translated description of a logged event. */
export function describeEvent(
  e: GameEvent,
  state: GameState,
  bundle: PackBundle | null,
  tr: PackTranslator | null,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const seat = (id: string) => state.seats.find((s) => s.id === id)?.name ?? id;
  const label = (ns: string, k: string) => tr?.t(`${ns}.${k}`, undefined, k) ?? k;
  const zoneCatalog = (zone: string) => bundle?.game.seat.zones[zone]?.catalog ?? "";

  switch (e.t) {
    case "zone.add":
      return t("log.zone_add", { seat: seat(e.seat), item: tr?.name(zoneCatalog(e.zone), e.item) ?? e.item });
    case "zone.remove":
      return t("log.zone_remove", { seat: seat(e.seat) });
    case "counter.add":
      return t("log.counter_add", { seat: seat(e.seat), counter: label("counters", e.counter), delta: e.delta > 0 ? `+${e.delta}` : String(e.delta) });
    case "counter.set":
      return t("log.counter_set", { seat: seat(e.seat), counter: label("counters", e.counter), value: e.value });
    case "field.set": {
      const def = bundle?.game.seat.fields[e.field];
      const value =
        e.value === null ? "—" : def?.type === "ref" && def.catalog ? (tr?.name(def.catalog, String(e.value)) ?? String(e.value)) : String(e.value);
      return t("log.field_set", { seat: seat(e.seat), field: label("fields", e.field), value });
    }
    case "track.set":
      return t("log.track_set", { track: label("tracks", e.track), value: e.value });
    case "seat.add":
      return t("log.seat_add", { name: e.name });
    case "seat.claim":
      return t("log.seat_claim", { seat: seat(e.seat) });
    case "seat.release":
      return t("log.seat_release", { seat: seat(e.seat) });
    case "adjust.set":
      return t("log.adjust_set", { seat: seat(e.seat), category: label("categories", e.category), value: e.value });
    case "setup.roll":
      return t("log.setup_roll", { section: label("setup", e.section) });
    case "undo":
      return t("log.undo", { seq: e.target });
    default:
      return t(`log.event.${e.t.replace(".", "_")}`);
  }
}
