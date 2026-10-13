import { resolve } from "node:path";
import { PackError, checkPack, loadPack } from "../index";
import { readPackDir } from "../node";

const dirs = process.argv.slice(2);
if (!dirs.length) {
  console.error("usage: bun run pack:check <pack-dir> [...]");
  process.exit(2);
}
let failed = false;
for (const dir of dirs) {
  try {
    const bundle = await loadPack(await readPackDir(resolve(dir)));
    const { errors, warnings } = checkPack(bundle);
    for (const w of warnings) console.warn(`  warn  ${w}`);
    for (const e of errors) console.error(`  error ${e}`);
    console.log(`${errors.length ? "✗" : "✓"} ${bundle.id}@${bundle.version} ${bundle.hash.slice(0, 12)} (${dir})`);
    failed ||= errors.length > 0;
  } catch (e) {
    failed = true;
    const issues = e instanceof PackError ? e.issues : [(e as Error).message];
    for (const i of issues) console.error(`  error ${i}`);
    console.log(`✗ ${dir}`);
  }
}
process.exit(failed ? 1 : 0);
