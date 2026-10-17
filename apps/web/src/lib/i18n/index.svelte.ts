import { type PackBundle, type PackTranslator, type Params, Translator, packTranslator } from "@tessera/engine";
import { kvGet, kvSet } from "../core/db";
import en from "./en";
import pl from "./pl";

export const LOCALES = [
  { id: "en", label: "English" },
  { id: "pl", label: "Polski" },
] as const;

function detect(): string {
  const nav = typeof navigator !== "undefined" ? navigator.language : "en";
  return nav.toLowerCase().startsWith("pl") ? "pl" : "en";
}

class I18n {
  locale = $state(detect());
  private ui = $derived(new Translator({ en, pl }, this.locale, "en"));

  async load() {
    const saved = await kvGet<string>("locale");
    if (saved) this.locale = saved;
    document.documentElement.lang = this.locale;
  }

  async set(locale: string) {
    this.locale = locale;
    document.documentElement.lang = locale;
    await kvSet("locale", locale);
  }

  t = (key: string, params?: Params) => this.ui.t(key, params);

  // One translator per pack and locale, so components share its parsed ICU messages.
  private packs = new WeakMap<PackBundle, Map<string, PackTranslator>>();

  pack(bundle: PackBundle | null): PackTranslator | null {
    if (!bundle) return null;
    let byLocale = this.packs.get(bundle);
    if (!byLocale) this.packs.set(bundle, (byLocale = new Map()));
    let tr = byLocale.get(this.locale);
    if (!tr) byLocale.set(this.locale, (tr = packTranslator(bundle, this.locale)));
    return tr;
  }

  packName(bundle: PackBundle) {
    return this.pack(bundle)!.t("name", undefined, bundle.id);
  }
}

export const i18n = new I18n();
export const t = (key: string, params?: Params) => i18n.t(key, params);
