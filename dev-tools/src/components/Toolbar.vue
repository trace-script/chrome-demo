<script setup lang="ts">
import { Icon } from '@iconify/vue'
import FilterBar from './FilterBar.vue'

defineProps<{
  recording: boolean
  filtersVisible: boolean
  query: string
  type: string
  status: string
  agent: string
  onlyErrors: boolean
  total: number
  count: number
}>()
const emit = defineEmits<{
  'toggleRecording': []
  'clear': []
  'add': []
  'toggleFilters': []
  'update:query': [value: string]
  'update:type': [value: string]
  'update:status': [value: string]
  'update:agent': [value: string]
  'toggleErrors': []
}>()
const isDev = import.meta.env.DEV
</script>

<template>
  <header
    class="toolbar box-border flex h-12 min-h-12 items-center justify-between border-0 bg-panel-raised p-2"
  >
    <div class="flex h-full min-w-0 items-center">
      <button
        type="button"
        class="icon-button min-h-0 min-w-0 p-0.5"
        :class="recording ? 'text-emerald-300' : 'text-red-300'"
        :aria-label="recording ? 'Pause recording' : 'Resume recording'"
        :title="recording ? 'Pause recording' : 'Resume recording'"
        @click="emit('toggleRecording')"
      >
        <Icon
          :icon="recording ? 'mdi:record-circle-outline' : 'mdi:play-outline'"
          width="16"
          height="16"
        />
      </button>
      <button
        type="button"
        class="icon-button min-h-0 min-w-0 p-0.5 hover:bg-(--control-hover)"
        aria-label="Clear events"
        title="Clear events"
        @click="emit('clear')"
      >
        <Icon icon="mdi:delete-outline" width="16" height="16" />
      </button>
      <button
        type="button"
        class="icon-button min-h-0 min-w-0 p-0.5 hover:bg-(--control-hover)"
        :class="filtersVisible ? 'text-(--accent)' : 'text-slate-500'"
        :aria-pressed="filtersVisible"
        aria-label="Toggle filters"
        title="Toggle filters"
        @click="emit('toggleFilters')"
      >
        <Icon icon="mdi:filter-variant" width="16" height="16" />
      </button>
      <FilterBar
        v-show="filtersVisible"
        :query="query"
        :type="type"
        :status="status"
        :agent="agent"
        :only-errors="onlyErrors"
        :total="total"
        :count="count"
        @update:query="emit('update:query', $event)"
        @update:type="emit('update:type', $event)"
        @update:status="emit('update:status', $event)"
        @update:agent="emit('update:agent', $event)"
        @toggle-errors="emit('toggleErrors')"
      />
    </div>
    <button
      v-if="isDev"
      type="button"
      class="h-7 rounded border border-panel-border px-2 text-xs text-slate-300 hover:bg-(--control-hover)"
      aria-label="Add 10 test events"
      title="Add 10 test events"
      @click="emit('add')"
    >
      Add 10 events
    </button>
  </header>
</template>
