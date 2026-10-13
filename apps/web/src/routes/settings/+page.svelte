<script lang="ts">
  import HostAdmin from "$lib/settings/HostAdmin.svelte";
  import HostSettings from "$lib/settings/HostSettings.svelte";

  let version = $state(0);
</script>

<div class="settings-grid">
  <div class="area-server"><HostSettings onsaved={() => version++} /></div>
  <HostAdmin {version} />
</div>
