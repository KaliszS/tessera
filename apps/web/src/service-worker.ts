/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { build, files, version } from "$service-worker";

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `tessera-${version}`;
const ASSETS = [...build, ...files];
const SHELL = new URL("./", sw.registration.scope).pathname;

sw.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([...ASSETS, SHELL])).then(() => sw.skipWaiting()));
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => sw.clients.claim()),
  );
});

sw.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
  } else if (req.mode === "navigate" && build.length) {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match(new URL("./", sw.registration.scope).href)) ?? Response.error()),
    );
  }
});
