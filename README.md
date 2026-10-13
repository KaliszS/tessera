# Tessera

A board game companion: it tracks, computes, remembers and suggests, and never enforces rules.
Every player's phone shows the same live state, synced through a tiny relay that the host runs on their own free Cloudflare account.

> Unofficial and not affiliated with any game publisher. Game names and trademarks belong to their owners.
> This repository contains no game data: packs live outside of it (see `games/README.md`).

## Layout

| Path | What |
| --- | --- |
| `crates/protocol` | Wire messages, room tokens (HMAC), relay decisions. Pure Rust, no I/O. Generates TS types. |
| `crates/relay-worker` | Cloudflare Worker (workers-rs): one SQLite Durable Object per room, WebSocket Hibernation, admin registry. |
| `packages/protocol` | TS types generated from `crates/protocol` (`bun run gen:protocol`). |
| `packages/engine` | Game engine: pack schema and loader, event fold, JSONata-derived values and scoring, setup, i18n. |
| `apps/web` | SvelteKit static PWA (hash router, IndexedDB via Dexie, service worker). |
| `tests/conformance` | Protocol conformance suite; runs against any relay implementation. |
| `games/` | Your local game packs. Gitignored. |

## Requirements

- [Bun](https://bun.sh) 1.4+
- Rust stable with `wasm32-unknown-unknown` (picked up from `rust-toolchain.toml`)
- `cargo install worker-build --version 0.8.7 --locked`

## Run locally

```sh
bun install
bun run dev        # from the repo root; Ctrl+C stops both servers
```

This starts `wrangler dev` (relay on :8787, local Durable Objects and SQLite under `.wrangler/`) and Vite on :5173.
On first run it creates `crates/relay-worker/.env` from `.env.example` (local secret `dev-secret`, local usage estimates on).
Vite proxies `/relay` to the Worker, so the relay URL in the app is `http://localhost:5173/relay`.

1. Hosting is configured automatically in dev (local relay, secret `dev-secret`); see the gear icon.
2. Shelf: tap a faded game box (packs from `games/`, dev mode only) to install it.
3. **New room**: pick the game, players and modules, then create.
4. Invite: copy the link and open it in another browser profile or a private window to act as a second player.

To test with phones: start `bun run dev:phone` on the computer instead. The terminal prints an address such as `https://192.168.x.x:5173`. Open it on the phone (same Wi-Fi) and accept the certificate warning.
HTTPS is needed because browsers allow WebCrypto (room encryption) only on secure pages.

## Tests

```sh
bun run test               # cargo test (protocol) + bun test (engine, web client)
bun run test:conformance   # needs a running relay (bun run dev:worker); RELAY_URL / RELAY_SECRET to target another
bun run pack:check games/<pack>
bun run --cwd apps/web check   # svelte-check
```

## Deploy

**Relay (each host, once):**

```sh
cd crates/relay-worker
bunx wrangler login
bunx wrangler deploy
bunx wrangler secret put HOST_SECRET        # long random string; enter it in the app's Settings
```

For the usage panel in Settings (requests, duration, rows read/written today) also run `wrangler secret put CF_ACCOUNT_ID` and `wrangler secret put CF_API_TOKEN` (a token with *Account Analytics: Read*).
Optionally restrict browser origins with `ALLOWED_ORIGINS = "https://you.github.io"` in `wrangler.toml`.
The free plan is enough for board games; over a daily limit requests fail until 00:00 UTC and nothing is billed.

**Frontend (GitHub Pages):** `.github/workflows/pages.yml` tests, builds and deploys `apps/web` when `main` changes (after a merge); there are no other workflows.
Enable it once in the repository: *Settings → Pages → Source: GitHub Actions*.
The workflow passes the Pages sub-path (`/<repo>`) as `BASE_PATH`; for another host build with its path, e.g. `BASE_PATH=/tessera bun run --cwd apps/web build` (output in `apps/web/build`).

## How it works

- The relay is the source of truth for ordering only. It assigns `seq`, stores opaque ciphertext and broadcasts it, and it knows nothing about games.
- Clients encrypt events with AES-GCM. The room key travels only in the invite link fragment (`#/join?...&k=`), which browsers never send to servers.
- `state = fold(events)`. Undo is a compensating event, and every device computes the same state.
- `append` carries `base` (the last `seq` the client saw). A stale base is rejected. The client catches up, re-checks the event against the new state, then resends it or drops it with a notice.
- Locks (`lock` / `unlock`) let one device run a multi-step procedure while the others' appends are rejected. The host can force a release.
- Mobile sockets die on screen lock. The client reconnects on wake or when back online, then asks `since(last_seq)`.

See `docs/packs.md` for the pack format.
