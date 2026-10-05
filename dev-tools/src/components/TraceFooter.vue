<script setup lang="ts">
defineProps<{
  connected: boolean
  eventCount: number
  visibleCount: number
  totalTokens: number
  visibleTokens: number
  failedCount: number
  maxDuration: number
  totalDuration: number
}>()

function formatDuration(value: number) {
  return value < 1000 ? `${Math.round(value)}ms` : `${(value / 1000).toFixed(1)}s`
}
</script>

<template>
  <footer
    class="network-status-bar text-xs flex min-h-8 items-center gap-0 border-t border-(--divider) bg-(--panel-raised)"
    aria-label="Trace summary"
  >
    <span class="status-item status-item-primary">
      <i
        class="size-1.5 rounded-full"
        :class="connected ? 'bg-emerald-400' : 'bg-red-400'"
      />
      {{ connected ? 'Connected' : 'Disconnected' }}
    </span>
    <span class="status-item">
      <strong>{{ eventCount }}</strong> events
    </span>
    <span class="status-item">
      <strong>{{ visibleCount }}</strong> visible
    </span>
    <span class="status-item">
      <strong>{{ totalTokens }}</strong> tokens
    </span>
    <span class="status-item">
      <strong>{{ visibleTokens }}</strong> visible tokens
    </span>
    <span class="status-item" :class="failedCount ? 'text-red-300' : ''">
      <strong>{{ failedCount }}</strong> failed
    </span>
    <span class="status-item">
      Max duration: <strong>{{ formatDuration(maxDuration) }}</strong>
    </span>
    <span class="status-item">
      Total duration: <strong>{{ formatDuration(totalDuration) }}</strong>
    </span>
    <span class="status-spacer" />
    <span class="status-item status-item-last text-slate-600">
      ↑↓ Navigate
    </span>
  </footer>
</template>
