import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    router: { type: "hash" },
    // Hash routing serves a single SPA shell, so a sub-path host (e.g. GitHub Pages /<repo>) needs an explicit base.
    paths: { base: process.env.BASE_PATH ?? "", relative: true },
    serviceWorker: { register: true },
  },
};
