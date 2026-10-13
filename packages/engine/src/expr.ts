import jsonata from "jsonata";

export type Expression = ReturnType<typeof jsonata>;

/** Sum of squares per symbol plus a bonus per complete set, wildcards placed optimally. */
export function setCollection(counts: number[], wild = 0, setBonus = 0): number {
  const score = (c: number[]) => c.reduce((a, n) => a + n * n, 0) + setBonus * Math.min(...c);
  if (counts.length === 0) return 0;
  let best = score(counts);
  const place = (c: number[], left: number) => {
    if (left === 0) {
      best = Math.max(best, score(c));
      return;
    }
    for (let i = 0; i < c.length; i++) {
      c[i]++;
      place(c, left - 1);
      c[i]--;
    }
  };
  place([...counts], Math.min(wild, 8));
  return best;
}

/** Like JSONata's $sum, but missing input is 0 and non-numbers are skipped. */
function sumLenient(v: unknown): number {
  if (v === undefined || v === null) return 0;
  const items = Array.isArray(v) ? v : [v];
  return items.reduce<number>((a, x) => (typeof x === "number" && Number.isFinite(x) ? a + x : a), 0);
}

const cache = new Map<string, Expression>();

/** Compiles (and caches) a JSONata expression with the engine's helper functions.
 * Per-evaluation helpers such as `$row` are passed as bindings. */
export function compile(src: string): Expression {
  const hit = cache.get(src);
  if (hit) return hit;
  const e = jsonata(src);
  e.registerFunction("sum", sumLenient);
  e.registerFunction("setCollection", (counts: number[] | number, wild?: number, bonus?: number) =>
    setCollection(Array.isArray(counts) ? counts : [counts], wild ?? 0, bonus ?? 0),
  );
  cache.set(src, e);
  return e;
}

export function syntaxError(src: string): string | null {
  try {
    jsonata(src);
    return null;
  } catch (e) {
    const err = e as { message?: string; position?: number };
    return `${err.message ?? String(e)}${err.position !== undefined ? ` (at ${err.position})` : ""}`;
  }
}
