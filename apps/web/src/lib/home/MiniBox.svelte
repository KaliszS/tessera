<script lang="ts">
  import type { PackBundle } from "@tessera/engine";
  import { coverOf } from "./shelf";

  // A small box of the game with its initial, e.g. on a room card or in the lobby's game step.
  let { id, bundle, name }: { id: string; bundle?: PackBundle | null; name: string } = $props();
</script>

<span class="box3d mini-box" style:--cover={coverOf(id, bundle)} title={name}>{(name || "?").charAt(0)}</span>
