<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Plus from "@lucide/svelte/icons/plus";
  import { href } from "../core/nav";
  import { t } from "../i18n/index.svelte";
</script>

<a class="room-card new-room-card" href={href("/new")}>
  <span class="mini-box add"><Plus size={22} /></span>
  <span class="room-card-title grow">{t("home.new_room")}</span>
  <span class="new-room-arrow"><ChevronRight size={20} /></span>
</a>
