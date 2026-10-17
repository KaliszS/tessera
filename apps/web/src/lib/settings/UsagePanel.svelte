<script lang="ts">
  import BookOpen from "@lucide/svelte/icons/book-open";
  import DoorOpen from "@lucide/svelte/icons/door-open";
  import Gauge from "@lucide/svelte/icons/gauge";
  import Globe from "@lucide/svelte/icons/globe";
  import HardDrive from "@lucide/svelte/icons/hard-drive";
  import PenLine from "@lucide/svelte/icons/pen-line";
  import Timer from "@lucide/svelte/icons/timer";
  import type { Component } from "svelte";
  import type { UsageResponse } from "@tessera/protocol";
  import { formatBytes } from "../core/util";
  import { i18n, t } from "../i18n/index.svelte";
  import Messages from "../ui/Messages.svelte";
  import Meter from "../ui/Meter.svelte";
  import Notice from "../ui/Notice.svelte";
  import Panel from "../ui/Panel.svelte";
  import ResetCountdown from "./ResetCountdown.svelte";

  let { usage, storage }: { usage: UsageResponse | null; storage: { used: number; limit: number } | null } = $props();

  const ICONS: Record<string, Component<{ size?: number }>> = {
    worker_requests: Globe,
    do_requests: DoorOpen,
    do_duration: Timer,
    rows_read: BookOpen,
    rows_written: PenLine,
  };

  // Local estimates come only from a dev relay and must never show in a production build.
  const source = $derived(usage?.source === "local" && !import.meta.env.DEV ? "none" : (usage?.source ?? "none"));
  const metrics = $derived(source === "none" ? [] : (usage?.metrics ?? []));
  const fmt = (n: number) => new Intl.NumberFormat(i18n.locale, { notation: "compact", maximumFractionDigits: 1 }).format(n);
</script>

<Panel title={t("admin.usage_title")} icon={Gauge}>
  {#snippet actions()}
    {#if source === "local"}<span class="badge badge-accent" title={t("admin.local_estimate")}>dev</span>{/if}
    {#if source !== "none"}<ResetCountdown />{/if}
  {/snippet}
  {#each metrics as m (m.id)}
    <Meter
      icon={ICONS[m.id] ?? Gauge}
      label={t(`admin.metric_short.${m.id}`)}
      title={t(`admin.metric.${m.id}`)}
      value={m.used === null ? "-" : `${fmt(m.used)} / ${fmt(m.limit)}`}
      used={m.used}
      limit={m.limit}
    />
  {/each}
  {#if storage}
    <Meter
      icon={HardDrive}
      label={t("admin.metric_short.storage")}
      title={t("admin.metric.storage")}
      value="{formatBytes(storage.used)} / {formatBytes(storage.limit)}"
      used={storage.used}
      limit={storage.limit}
    />
  {/if}
  {#if source === "none"}<Notice>{t("admin.usage_not_configured")}</Notice>{/if}
  {#if usage}<Messages warnings={usage.errors} />{/if}
</Panel>
