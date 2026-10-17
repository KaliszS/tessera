import type { FieldDef, PackBundle } from "@tessera/engine";

/** Seat fields that reference a catalog (boards, factions…) and are handed out in the lobby. */
export function refFields(bundle: PackBundle): Array<[string, FieldDef]> {
  return Object.entries(bundle.game.seat.fields).filter(([, f]) => f.type === "ref" && !!f.catalog);
}
