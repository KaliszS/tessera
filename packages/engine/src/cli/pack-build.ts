import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { PackError, checkPack, loadPack } from "../index";
import { readPackDir } from "../node";

const [dir, outArg] = process.argv.slice(2);
if (!dir) {
  console.error("usage: bun run pack:build <pack-dir> [out-dir]");
  process.exit(2);
}
try {
  const bundle = await loadPack(await readPackDir(resolve(dir)));
  const { errors } = checkPack(bundle);
  if (errors.length) {
    for (const e of errors) console.error(`  error ${e}`);
    process.exit(1);
  }
  const outDir = outArg ?? dirname(resolve(dir));
  await mkdir(outDir, { recursive: true });
  const out = join(outDir, `${basename(resolve(dir))}.tessera.json`);
  await writeFile(out, JSON.stringify(bundle));
  console.log(`✓ ${out}`);
} catch (e) {
  for (const i of e instanceof PackError ? e.issues : [(e as Error).message]) console.error(`  error ${i}`);
  process.exit(1);
}
