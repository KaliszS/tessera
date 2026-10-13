<script lang="ts" generics="T extends string">
  let { items, value = $bindable() }: { items: Array<{ id: T; label: string }>; value: T } = $props();
</script>

<div class="tabs" role="tablist">
  {#each items as item (item.id)}
    <button
      type="button"
      class="tab"
      role="tab"
      aria-selected={item.id === value}
      onclick={(e) => {
        value = item.id;
        e.currentTarget.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
      }}
    >
      {item.label}
    </button>
  {/each}
</div>
