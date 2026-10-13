import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { GameDef, LocaleTree } from "../schema";

const dir = join(import.meta.dir, "../../schema");
const emit = (name: string, schema: z.ZodType) =>
  writeFile(join(dir, name), `${JSON.stringify(z.toJSONSchema(schema, { io: "input" }), null, 2)}\n`);
await emit("game.schema.json", GameDef);
await emit("locale.schema.json", LocaleTree);
console.log(`wrote ${dir}`);
