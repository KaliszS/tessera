export type Theme = "light" | "dark";

const KEY = "tessera.theme";
const META = { light: "#f3efe7", dark: "#0f141b" } satisfies Record<Theme, string>;

function read(): Theme {
  const attr = typeof document === "undefined" ? undefined : document.documentElement.dataset.theme;
  return attr === "dark" ? "dark" : "light";
}

class ThemeState {
  current = $state<Theme>(read());

  set(theme: Theme) {
    this.current = theme;
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", META[theme]);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // Storage may be unavailable (private mode); the theme still applies for this visit.
    }
  }

  toggle() {
    this.set(this.current === "dark" ? "light" : "dark");
  }
}

export const theme = new ThemeState();
