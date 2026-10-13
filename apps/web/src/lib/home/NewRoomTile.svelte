<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Plus from "@lucide/svelte/icons/plus";
  import { href } from "../core/nav";
  import { t } from "../i18n/index.svelte";
</script>

<a class="cta-tile" href={href("/new")}>
  <span class="cta-token"><Plus size={24} strokeWidth={2.5} /></span>
  <span class="cta-title">{t("home.new_room")}</span>
  <span class="cta-arrow"><ChevronRight size={22} /></span>
</a>
