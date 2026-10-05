<script setup lang="ts">
import type { TraceRow } from '../types.js'
import { computed, ref } from 'vue'

const props = defineProps<{ rows: TraceRow[], selectedId: string }>()
const emit = defineEmits<{ select: [id: string] }>()
const rulerCanvas = ref<HTMLElement>()
const eventsScroll = ref<HTMLElement>()

const orderedRows = computed(() =>
  [...props.rows].sort(
    (a, b) => a.start - b.start || a.event.seq - b.event.seq,
  ),
)
const groups = computed(() => {
  const grouped = new Map<string, TraceRow[]>()
  for (const row of orderedRows.value) {
    const rows = grouped.get(row.type) ?? []
    rows.push(row)
    grouped.set(row.type, rows)
  }
  return [...grouped].map(([type, rows]) => ({ type, rows }))
})
const endTime = computed(() =>
  Math.max(1, ...orderedRows.value.map(row => row.start + row.duration)),
)
const ticks = computed(() => {
  const count = 5
  return Array.from({ length: count }, (_, index) => ({
    value: (endTime.value / (count - 1)) * index,
    position: (index / (count - 1)) * 100,
  }))
})
const overlapCount = computed(() => {
  const result: Record<string, number> = {}
  for (const row of orderedRows.value) {
    result[row.event.id] = orderedRows.value.filter(
      other =>
        other.event.id !== row.event.id
        && other.start < row.start + row.duration
        && row.start < other.start + other.duration,
    ).length
  }
  return result
})
function formatTime(value: number) {
  return value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(1)} s`
}
function barStyle(row: TraceRow) {
  return {
    left: `${(row.start / endTime.value) * 100}%`,
    width: `${Math.max((row.duration / endTime.value) * 100, 0.35)}%`,
  }
}
function syncTimelineScroll(event: Event) {
  const scrollLeft = (event.currentTarget as HTMLElement).scrollLeft
  if (rulerCanvas.value)
    rulerCanvas.value.style.transform = `translateX(-${scrollLeft}px)`
}
</script>

<template>
  <section class="timeline-panel" aria-label="Event timeline">
    <div v-if="orderedRows.length" class="timeline-ruler-header">
      <div class="timeline-ruler-spacer">
        <span class="timeline-title">TIMELINE</span>
      </div>
      <div
        class="timeline-ruler-scroll"
      >
        <div ref="rulerCanvas" class="timeline-events-canvas">
          <div class="timeline-ruler">
            <i
              v-for="tick in ticks"
              :key="tick.position"
              class="timeline-grid-line"
              :style="{ left: `${tick.position}%` }"
            />
            <span
              v-for="tick in ticks"
              :key="`label-${tick.position}`"
              class="timeline-tick"
              :style="{ left: `${tick.position}%` }"
            >{{ formatTime(tick.value) }}</span>
          </div>
        </div>
      </div>
    </div>
    <div v-if="orderedRows.length" class="timeline-scroll">
      <div class="timeline-layout">
        <div class="timeline-label-column">
          <div v-for="group in groups" :key="group.type" class="timeline-label-row">
            <span class="timeline-label" :title="group.type">
              <strong>{{ group.type }}</strong>
              <small>{{ group.rows.length }} events</small>
            </span>
          </div>
        </div>
        <div
          ref="eventsScroll"
          class="timeline-events-scroll"
          @scroll="syncTimelineScroll"
        >
          <div class="timeline-events-canvas">
            <div v-for="group in groups" :key="group.type" class="timeline-track-row">
              <span class="timeline-track">
                <i
                  v-for="tick in ticks"
                  :key="`row-${group.type}-${tick.position}`"
                  class="timeline-grid-line"
                  :style="{ left: `${tick.position}%` }"
                />
                <button
                  v-for="row in group.rows"
                  :key="row.event.id"
                  type="button"
                  class="timeline-bar"
                  :class="[
                    `timeline-bar-${row.status}`,
                    row.event.id === selectedId ? 'timeline-bar-selected' : '',
                    overlapCount[row.event.id] ? 'timeline-bar-parallel' : '',
                  ]"
                  :style="barStyle(row)"
                  :title="`${row.name} · ${row.agent} · ${formatTime(row.duration)} · ${overlapCount[row.event.id] ? 'parallel' : 'serial'}`"
                  @click="emit('select', row.event.id)"
                >
                  <b v-if="row.duration > endTime * 0.08">{{
                    formatTime(row.duration)
                  }}</b>
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="timeline-empty">
      No events match these filters
    </div>
  </section>
</template>
