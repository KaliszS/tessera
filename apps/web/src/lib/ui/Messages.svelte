<script lang="ts">
  import Notice from "./Notice.svelte";

  let { errors = [], warnings = [] }: { errors?: string[]; warnings?: string[] } = $props();
</script>

{#if errors.length}
  <Notice kind="error"><div class="stack-s">{#each errors as m, i (i)}<span>{m}</span>{/each}</div></Notice>
{/if}
{#if warnings.length}
  <Notice kind="warn"><div class="stack-s">{#each warnings as m, i (i)}<span>{m}</span>{/each}</div></Notice>
{/if}
