import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { sveltekit } from "@sveltejs/kit/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { type Plugin, defineConfig } from "vite";

const ROOT = resolve(import.meta.dirname, "../..");
const PACK_ROOTS = [join(ROOT, "games")];

/** Dev-only: serves local packs from the gitignored games/ so they never enter a production build. */
function devPacks(): Plugin {
  return {
    name: "tessera-dev-packs",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__dev/packs", async (_req, res) => {
        const { PackError, checkPack, loadPack } = (await server.ssrLoadModule("@tessera/engine")) as typeof import("@tessera/engine");
        const { readPackDir } = (await server.ssrLoadModule("@tessera/engine/node")) as typeof import("@tessera/engine/node");
        const out = [];
        for (const root of PACK_ROOTS) {
          if (!existsSync(root)) continue;
          for (const ent of readdirSync(root, { withFileTypes: true })) {
            const dir = join(root, ent.name);
            if (!ent.isDirectory() || !existsSync(join(dir, "game.yaml"))) continue;
            try {
              const bundle = await loadPack(await readPackDir(dir));
              out.push({ dir: dir.slice(ROOT.length + 1), bundle, ...checkPack(bundle) });
            } catch (e) {
              const errors = e instanceof PackError ? e.issues : [(e as Error).message];
              out.push({ dir: dir.slice(ROOT.length + 1), bundle: null, errors, warnings: [] });
            }
          }
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(out));
      });
    },
  };
}

export default defineConfig({
  plugins: [sveltekit(), devPacks(), ...(process.env.HTTPS ? [basicSsl()] : [])],
  server: {
    fs: { allow: [ROOT] },
    proxy: {
      "/relay": {
        target: process.env.RELAY_TARGET ?? "http://127.0.0.1:8787",
        ws: true,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/relay/, "") || "/",
      },
    },
  },
});
