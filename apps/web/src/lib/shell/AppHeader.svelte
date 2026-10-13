<script lang="ts">
  import Settings from "@lucide/svelte/icons/settings";
  import { href } from "../core/nav";
  import { t } from "../i18n/index.svelte";
  import LangSwitch from "./LangSwitch.svelte";
  import ThemeToggle from "./ThemeToggle.svelte";

  let { current }: { current: string } = $props();
</script>

<header class="app-header">
  <a class="brand" href={href("/")}>
    <img src="./icon.svg" alt="" />
    <span>Tessera</span>
  </a>
  <ThemeToggle />
  <LangSwitch />
  <a
    class="icon-btn"
    href={href("/settings")}
    aria-label={t("nav.settings")}
    title={t("nav.settings")}
    aria-current={current === "/settings" ? "page" : undefined}
  >
    <Settings size={20} />
  </a>
</header>
