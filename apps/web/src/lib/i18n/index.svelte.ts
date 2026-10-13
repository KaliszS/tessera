import { type PackBundle, type Params, Translator, packTranslator } from "@tessera/engine";
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

  pack(bundle: PackBundle | null) {
    return bundle ? packTranslator(bundle, this.locale) : null;
  }

  packName(bundle: PackBundle) {
    return packTranslator(bundle, this.locale).t("name", undefined, bundle.id);
  }
}

export const i18n = new I18n();
export const t = (key: string, params?: Params) => i18n.t(key, params);
