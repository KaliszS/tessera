// Runs the relay Worker (wrangler dev) and the web app (vite) together.
// HTTPS=1 serves the app over self-signed HTTPS so phones on the LAN get a secure context (WebCrypto).
import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const bin = (name: string, cwd: string) =>
  [join(cwd, "node_modules/.bin", name), join(root, "node_modules/.bin", name)].find(existsSync) ?? name;

const devVars = join(root, "crates/relay-worker/.env");
if (!existsSync(devVars)) await Bun.write(devVars, Bun.file(`${devVars}.example`));
if (!Bun.which("worker-build")) {
  console.error("worker-build not found. Install it once: cargo install worker-build --version 0.8.7 --locked");
  process.exit(1);
}

for (const port of [8787, 5173]) {
  const busy = await Bun.connect({ hostname: "127.0.0.1", port, socket: { data() {} } }).then(
    (s) => (s.end(), true),
    () => false,
  );
  if (busy) {
    console.error(`Port ${port} is already in use (an earlier dev run still alive?). Stop it: lsof -ti tcp:${port} | xargs kill`);
    process.exit(1);
  }
}

const procs = [
  { name: "relay", color: 35, cmd: ["wrangler", "dev", "--port", "8787", "--ip", "127.0.0.1"], cwd: join(root, "crates/relay-worker") },
  { name: "web", color: 36, cmd: ["vite", "dev", "--host", "--port", "5173"], cwd: join(root, "apps/web") },
].map(({ name, color, cmd, cwd }) => {
  const p = Bun.spawn([bin(cmd[0], cwd), ...cmd.slice(1)], { cwd, stdout: "pipe", stderr: "pipe", env: process.env });
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;
  for (const stream of [p.stdout, p.stderr]) {
    void (async () => {
      const dec = new TextDecoder();
      for await (const chunk of stream) {
        for (const line of dec.decode(chunk).split("\n")) if (line.trim()) console.log(prefix + line);
      }
    })();
  }
  return p;
});

const scheme = process.env.HTTPS ? "https" : "http";
const lan = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === "IPv4" && !i.internal)
  .map((i) => `${scheme}://${i!.address}:5173`);
console.log(`\nTessera dev: ${scheme}://localhost:5173  (relay proxied at /relay, secret: dev-secret)`);
if (lan.length && process.env.HTTPS) console.log(`Phones in this Wi-Fi can open: ${lan.join("  ")} (accept the certificate warning)\n`);
else if (lan.length) console.log(`For phones in this Wi-Fi start with: bun run dev:phone\n`);

const stop = () => {
  for (const p of procs) p.kill();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await Promise.race(procs.map((p) => p.exited));
stop();
