import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { PackFiles } from "./pack";

const PACK_FILE = /\.(ya?ml|csv|json)$/;

/** Reads a pack directory into the path -> content map that loadPack expects. */
export async function readPackDir(dir: string): Promise<PackFiles> {
  const files: PackFiles = {};
  const walk = async (d: string) => {
    for (const ent of await readdir(d, { withFileTypes: true })) {
      const p = join(d, ent.name);
      if (ent.isDirectory()) await walk(p);
      else if (PACK_FILE.test(ent.name)) files[relative(dir, p).split("\\").join("/")] = await readFile(p, "utf8");
    }
  };
  await walk(dir);
  return files;
}
