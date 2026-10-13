import {
  type Evaluation,
  type GameEvent,
  type GameState,
  type LoggedEvent,
  type PackBundle,
  evaluate,
  fold,
  parseBundle,
} from "@tessera/engine";
import { type RoomRow, db } from "../core/db";
import { RoomSync } from "./sync.svelte";

/** One joined room: synced log + resolved pack + folded state + live evaluation. */
export class GameSession {
  readonly sync: RoomSync;
  bundle = $state.raw<PackBundle | null>(null);
  packError = $state<string | null>(null);
  evaluation = $state.raw<Evaluation | null>(null);

  state: GameState = $derived.by(() => fold(this.sync.events, this.bundle));
  mySeats = $derived.by(() => this.state.seats.filter((s) => s.device === this.device));
  isHost = $derived.by(() => this.state.host === this.device);

  private disposeEffects: (() => void) | null = null;
  private evalRun = 0;

  constructor(
    readonly room: RoomRow,
    readonly device: string,
  ) {
    this.sync = new RoomSync(room, device);
    this.sync.revalidate = (env, events) => this.wouldReject(env.e, events);
  }

  async start() {
    await this.sync.start();
    this.disposeEffects = $effect.root(() => {
      $effect(() => {
        void this.resolvePack(this.sync.events);
      });
      $effect(() => {
        const bundle = this.bundle;
        const state = this.state;
        if (!bundle) return;
        const run = ++this.evalRun;
        void evaluate(bundle, state).then((ev) => {
          if (run === this.evalRun) this.evaluation = ev;
        });
      });
    });
  }

  stop() {
    this.sync.stop();
    this.disposeEffects?.();
  }

  submit(event: GameEvent) {
    return this.sync.submit(event);
  }

  private wouldReject(event: GameEvent, events: LoggedEvent[]): string | null {
    if (event.t === "room.init" || event.t === "pack.attach") return null;
    const seq = (events.at(-1)?.seq ?? 0) + 1;
    const next = fold([...events, { seq, dev: this.device, ts: Date.now(), event }], this.bundle);
    const entry = next.log.at(-1);
    return entry?.status === "rejected" ? `${event.t}: ${entry.reason}` : null;
  }

  private async resolvePack(events: LoggedEvent[]) {
    const init = events.find((e) => e.event.t === "room.init")?.event;
    if (!init || init.t !== "room.init") return;
    if (this.bundle?.hash === init.pack.hash) return;
    const local = await db.packs.get(init.pack.hash);
    if (local) {
      this.bundle = local.bundle;
      return;
    }
    const attach = events.find((e) => e.event.t === "pack.attach")?.event;
    if (!attach || attach.t !== "pack.attach") {
      this.packError = `pack ${init.pack.id}@${init.pack.version} not available yet`;
      return;
    }
    try {
      const bundle = await parseBundle(JSON.stringify(attach.bundle));
      if (bundle.hash !== init.pack.hash) throw new Error("attached pack does not match the room");
      await db.packs.put({
        hash: bundle.hash,
        id: bundle.id,
        version: bundle.version,
        bundle,
        installedAt: Date.now(),
        source: "room",
      });
      this.bundle = bundle;
      this.packError = null;
    } catch (e) {
      this.packError = (e as Error).message;
    }
  }
}
