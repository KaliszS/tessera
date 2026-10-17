<script lang="ts">
  import type { Snippet } from "svelte";

  let { kind = "info", children }: { kind?: "info" | "error" | "warn" | "ok" | "accent"; children: Snippet } = $props();
</script>

<div class="notice {kind}" role={kind === "error" ? "alert" : "status"}>{@render children()}</div>
