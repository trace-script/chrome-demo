<script setup lang="ts">
import type { TraceRow } from '../types'
import { nextTick, ref, watch } from 'vue'
import { displayValue, traceOf } from '../transcript-format.js'

const props = defineProps<{ rows: TraceRow[], selectedId: string }>()
const emit = defineEmits<{ select: [id: string] }>()
const scrollContainer = ref<HTMLElement>()
const rowElements = new Map<string, HTMLElement>()

function setRowRef(id: string, element: unknown): void {
  if (element instanceof HTMLElement)
    rowElements.set(id, element)
  else
    rowElements.delete(id)
}

function scrollToRow(id: string, focus = false): void {
  const element = rowElements.get(id)
  if (!element)
    return
  element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  if (focus)
    element.focus({ preventScroll: true })
}

function selectAdjacent(id: string, direction: 1 | -1): void {
  if (!props.rows.length)
    return
  const currentIndex = props.rows.findIndex(row => row.event.id === id)
  const nextIndex = currentIndex < 0
    ? (direction > 0 ? 0 : props.rows.length - 1)
    : Math.max(0, Math.min(props.rows.length - 1, currentIndex + direction))
  const nextId = props.rows[nextIndex].event.id
  emit('select', nextId)
  nextTick(() => scrollToRow(nextId, true))
}

function onRowKeydown(event: KeyboardEvent, id: string): void {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    event.stopPropagation()
    selectAdjacent(id, event.key === 'ArrowDown' ? 1 : -1)
  }
  else if (event.key === 'Enter') {
    event.preventDefault()
    event.stopPropagation()
    emit('select', id)
  }
}

function onTableKeydown(event: KeyboardEvent): void {
  if (event.target !== scrollContainer.value)
    return
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    event.stopPropagation()
    selectAdjacent(props.selectedId, event.key === 'ArrowDown' ? 1 : -1)
  }
}

watch(() => props.selectedId, (id) => {
  if (id)
    nextTick(() => scrollToRow(id))
})

function tokens(value: number | undefined) {
  if (value === undefined)
    return '—'
  return value > 999 ? `${(value / 1000).toFixed(1)}k` : String(value)
}
function duration(value: number) {
  return value < 1000 ? `${value}ms` : `${(value / 1000).toFixed(1)}s`
}
</script>

<template>
  <div
    ref="scrollContainer"
    class="min-h-0 flex-1 overflow-auto"
    tabindex="0"
    role="grid"
    aria-label="Trace events"
    @keydown="onTableKeydown"
  >
    <div class="trace-table">
      <div class="trace-table-head" role="row">
        <span>Trace ID</span>
        <span>Name</span>
        <span>Agent</span>
        <span class="trace-table-number">Duration</span>
        <span>Type</span>
        <span>Status</span>
        <span>Model</span>
        <span class="trace-table-tokens">Tokens</span>
      </div>
      <div v-if="rows.length" class="trace-table-body">
        <div
          v-for="row in rows"
          :key="row.event.id"
          :ref="(element) => setRowRef(row.event.id, element)"
          tabindex="0"
          class="trace-row cursor-pointer border-b border-(--row-border) hover:bg-(--row-hover) focus:outline-none"
          :class="row.event.id === selectedId
            ? 'trace-row-selected bg-(--row-selected) shadow-[inset_2px_0_var(--accent)]'
            : ''"
          role="row"
          :aria-selected="row.event.id === selectedId"
          @click="emit('select', row.event.id)"
          @focus="emit('select', row.event.id)"
          @keydown="onRowKeydown($event, row.event.id)"
        >
          <span
            class="truncate"
            :title="displayValue(traceOf(row.event).trace_id)"
          >{{ displayValue(traceOf(row.event).trace_id) }}</span>
          <span class="truncate font-semibold text-slate-200">{{ row.name }}</span>
          <span class="truncate">{{ row.agent }}</span>
          <span class="trace-table-number">{{ duration(row.duration) }}</span>
          <span class="truncate text-slate-400">{{ row.type }}</span>
          <span>
            <span
              class="inline-flex items-center gap-1.5"
              :class="`status-${row.status}`"
            ><i class="size-1.5 rounded-full bg-current" />{{
              row.status
            }}</span>
          </span>
          <span class="truncate">{{ row.model }}</span>
          <span class="trace-table-tokens">{{ tokens(row.tokens) }}</span>
        </div>
      </div>
      <div v-else class="trace-table-empty">
        No events match these filters
      </div>
    </div>
  </div>
</template>
