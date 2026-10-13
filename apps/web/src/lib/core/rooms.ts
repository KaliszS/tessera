import { db } from "./db";
import { type HostConfig, relay } from "./relay";

/** Removes a room from this device only; the room and other players are unaffected. */
export async function forgetRoom(id: string) {
  await db.transaction("rw", [db.rooms, db.events, db.outbox], async () => {
    await db.rooms.delete(id);
    await db.events.where("room").equals(id).delete();
    await db.outbox.where("room").equals(id).delete();
  });
}

/** Deletes a room on the host's relay for everybody, then forgets it locally. */
export async function deleteRoom(host: HostConfig, id: string) {
  await relay.adminDelete(host, id);
  await forgetRoom(id);
}
