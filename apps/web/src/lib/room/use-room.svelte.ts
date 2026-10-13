import { db, getDeviceId } from "../core/db";
import { GameSession } from "../sync/session.svelte";

/** Opens the session for a room id and keeps it alive while the calling component is mounted. */
export function useRoom(id: () => string) {
  const state = $state<{ session: GameSession | null; missing: boolean }>({ session: null, missing: false });

  $effect(() => {
    const roomId = id();
    let s: GameSession | null = null;
    let cancelled = false;
    state.missing = false;
    void (async () => {
      const room = await db.rooms.get(roomId);
      if (cancelled) return;
      if (!room) {
        state.missing = true;
        return;
      }
      await db.rooms.update(roomId, { lastSeen: Date.now() });
      s = new GameSession(room, await getDeviceId());
      if (cancelled) return;
      await s.start();
      state.session = s;
    })();
    return () => {
      cancelled = true;
      s?.stop();
      state.session = null;
    };
  });

  return state;
}
