import type { PackBundle } from "@tessera/engine";
import { db } from "../core/db";
import { fetchDevPacks, installPack } from "../core/packs";
import { latestInstalled } from "../home/shelf";
import type { GameSession } from "../sync/session.svelte";

/** A different version of the room's pack the host could switch to: the local dev copy first, else the shelf's newest. */
export async function findPackUpdate(current: PackBundle): Promise<{ bundle: PackBundle; dev: boolean } | null> {
  const [devPacks, rows] = await Promise.all([fetchDevPacks(), db.packs.where("id").equals(current.id).toArray()]);
  const dev = devPacks.find((d) => d.bundle?.id === current.id)?.bundle;
  if (dev && dev.hash !== current.hash) return { bundle: dev, dev: true };
  // A version only some room brought is not an update to offer.
  const shelf = latestInstalled(rows).get(current.id);
  return shelf && shelf.source !== "room" && shelf.hash !== current.hash ? { bundle: shelf.bundle, dev: false } : null;
}

/** Attaches the new version for devices that lack it (once per version), then points the room at it.
 * Seats, picks and the log stay. */
export async function applyPackUpdate(session: GameSession, update: { bundle: PackBundle; dev: boolean }) {
  const { bundle } = update;
  if (update.dev) await installPack(bundle, "dev");
  const attached = session.sync.events.some((e) => e.event.t === "pack.attach" && (e.event.bundle as { hash?: string })?.hash === bundle.hash);
  if (!attached) await session.submit({ t: "pack.attach", bundle });
  await session.submit({ t: "pack.set", pack: { id: bundle.id, version: bundle.version, hash: bundle.hash } });
}
