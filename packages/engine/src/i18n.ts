import { IntlMessageFormat } from "intl-messageformat";
import type { LocaleTree, PackBundle } from "./schema";

/** "pl-PL" -> ["pl-PL", "pl", fallback] without duplicates. */
export function localeChain(locale: string, fallback = "en"): string[] {
  const chain = [locale];
  const base = locale.split("-")[0];
  if (base !== locale) chain.push(base);
  if (!chain.includes(fallback)) chain.push(fallback);
  return chain;
}

export function lookup(tree: LocaleTree | undefined, key: string): string | undefined {
  let node: LocaleTree | string | undefined = tree;
  for (const part of key.split(".")) {
    if (!node || typeof node === "string") return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

export function flattenKeys(tree: LocaleTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === "string" ? [prefix + k] : flattenKeys(v, `${prefix}${k}.`),
  );
}

export type Params = Record<string, string | number | Date | boolean>;

export class Translator {
  private cache = new Map<string, IntlMessageFormat>();
  constructor(
    private trees: Record<string, LocaleTree>,
    readonly locale: string,
    private fallback = "en",
  ) {}

  has(key: string): boolean {
    return localeChain(this.locale, this.fallback).some((l) => lookup(this.trees[l], key) !== undefined);
  }

  t(key: string, params?: Params, fallbackText?: string): string {
    for (const l of localeChain(this.locale, this.fallback)) {
      const msg = lookup(this.trees[l], key);
      if (msg === undefined) continue;
      if (!params && !msg.includes("{")) return msg;
      const cacheKey = `${l}\u0000${key}`;
      let fmt = this.cache.get(cacheKey);
      if (!fmt) {
        try {
          fmt = new IntlMessageFormat(msg, l);
        } catch {
          return msg;
        }
        this.cache.set(cacheKey, fmt);
      }
      try {
        return String(fmt.format(params));
      } catch {
        return msg;
      }
    }
    return fallbackText ?? key;
  }
}

export function packTranslator(bundle: PackBundle, locale: string): Translator & { name(catalog: string, id: string): string } {
  const tr = new Translator(bundle.locales, locale, bundle.game.default_locale) as Translator & {
    name(catalog: string, id: string): string;
  };
  tr.name = (catalog, id) => {
    const ns = bundle.game.catalogs[catalog]?.names ?? catalog;
    return tr.t(`${ns}.${id}`, undefined, id);
  };
  return tr;
}

export type PackTranslator = ReturnType<typeof packTranslator>;
