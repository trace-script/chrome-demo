<script setup lang="ts">
import type { StoredEvent } from './types'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import DetailsPanel from './components/DetailsPanel.vue'
import Timeline from './components/Timeline.vue'
import Toolbar from './components/Toolbar.vue'
import TraceFooter from './components/TraceFooter.vue'
import TraceTable from './components/TraceTable.vue'
import { applyPanelMessage } from './panel-messages.js'
import { useTraceStore } from './use-trace-store.js'

const store = useTraceStore()

// Fixtures used when opening src/index.html directly. The extension replaces
// these with the inspected tab history as soon as it connects.
const isStandaloneDemo
  = import.meta.env.DEV && window.location.pathname.endsWith('/index.html')
const demoTemplates: StoredEvent[] = [
  {
    id: 'demo-plan',
    tabId: 0,
    seq: 1,
    timestamp: 1710000000000,
    payload: {
      name: 'agent.plan',
      type: 'Agent',
      status: 'success',
      agent: 'planner',
      model: 'gpt-4.1',
      tokens: 842,
      duration: 386,
      input: { goal: 'Create a product brief' },
      output: { steps: 3 },
    },
  },
  {
    id: 'demo-search',
    tabId: 0,
    seq: 2,
    timestamp: 1710000000386,
    payload: {
      name: 'tool.search',
      type: 'Tool',
      status: 'success',
      agent: 'researcher',
      model: '—',
      tokens: 126,
      duration: 712,
      input: { query: 'customer feedback Q4' },
      output: { results: 18 },
    },
  },
  {
    id: 'demo-generate',
    tabId: 0,
    seq: 3,
    timestamp: 1710000001098,
    payload: {
      name: 'model.generate',
      type: 'LLM',
      status: 'running',
      agent: 'writer',
      model: 'gpt-4.1-mini',
      tokens: 1204,
      duration: 1840,
      input: { messages: 4 },
      output: { stream: 'in_progress' },
    },
  },
  {
    id: 'demo-validate',
    tabId: 0,
    seq: 4,
    timestamp: 1710000002938,
    payload: {
      name: 'tool.validate',
      type: 'Tool',
      status: 'failed',
      agent: 'reviewer',
      model: '—',
      tokens: 88,
      duration: 240,
      input: { document: 'product-brief.md' },
      output: { error: 'missing owner field' },
    },
  },
  {
    id: 'demo-review',
    tabId: 0,
    seq: 5,
    timestamp: 1710000003178,
    payload: {
      name: 'agent.review',
      type: 'Agent',
      status: 'cancelled',
      agent: 'reviewer',
      model: 'gpt-4.1',
      tokens: 310,
      duration: 98,
      input: { draft: 'product-brief.md' },
      output: { reason: 'cancelled by user' },
    },
  },
]
// Keep the fixture content readable while emitting the same request/payload/trace
// envelope used by the extension transport.
const modernDemoTemplates = demoTemplates.map((event, index) => {
  const legacy = event.payload as Record<string, unknown>
  const output = legacy.output
  const total = Number(legacy.tokens ?? 0)
  const duration = Number(legacy.duration ?? 0)
  return {
    ...event,
    request: {
      model: legacy.model,
      input: legacy.input,
    },
    payload: {
      id: `resp_demo_${index + 1}`,
      object: 'response',
      status: legacy.status === 'running' ? 'in_progress' : legacy.status,
      model: legacy.model,
      output: [{
        id: `msg_demo_${index + 1}`,
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text: JSON.stringify(output) }],
      }],
      error: legacy.status === 'failed' ? output : undefined,
      usage: {
        input_tokens: Math.max(1, Math.round(total * 0.72)),
        input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
        output_tokens: Math.max(1, Math.round(total * 0.28)),
        output_tokens_details: { reasoning_tokens: legacy.type === 'LLM' ? Math.round(total * 0.1) : 0 },
        total_tokens: total,
      },
    },
    trace: {
      type: legacy.type,
      name: legacy.name,
      agent: legacy.agent,
      model: legacy.model,
      status: legacy.status,
      started_at: event.timestamp,
      ended_at: event.timestamp + duration,
      duration_ms: duration,
      trace_id: `demo-trace-${index + 1}`,
      session_id: 'demo-session-1',
      parent_id: index > 0 ? 'demo-001' : undefined,
      timing: { queue_ms: Math.min(40, duration), model_ms: legacy.type === 'LLM' ? duration : undefined, tool_ms: legacy.type === 'Tool' ? duration : undefined },
    },
  } satisfies StoredEvent
})
const demoEvents: StoredEvent[] = Array.from({ length: 100 }, (_, index) => {
  const template = modernDemoTemplates[index % modernDemoTemplates.length]!
  const payload = template.payload as Record<string, unknown>
  const trace = template.trace!
  const usage = payload.usage as Record<string, unknown>
  const duration = Number(trace.duration_ms) + (index % 9) * 35
  const timestamp = template.timestamp + index * 420
  return {
    ...template,
    id: `demo-${String(index + 1).padStart(3, '0')}`,
    seq: index + 1,
    timestamp,
    trace: {
      ...trace,
      trace_id: `demo-trace-${index + 1}`,
      started_at: timestamp,
      ended_at: timestamp + duration,
      duration_ms: duration,
    },
    payload: {
      ...payload,
      id: `resp_demo_${index + 1}`,
      usage: { ...usage, total_tokens: Number(usage.total_tokens) + index * 7 },
    },
  }
})
function addDemoEvents(): void {
  const timestamp = Date.now()
  const offset = store.events.value.length
  for (let index = 0; index < 10; index++) {
    const source = demoEvents[(offset + index) % demoEvents.length]!
    store.addEvent({
      ...source,
      id: `test-${timestamp}-${index}`,
      seq: offset + index + 1,
      timestamp: timestamp + index,
      trace: source.trace
        ? {
            ...source.trace,
            trace_id: `test-trace-${timestamp}-${index}`,
            started_at: timestamp + index,
            ended_at: timestamp + index + (source.trace.duration_ms ?? 0),
          }
        : undefined,
    })
  }
}
const totalTokens = computed(() =>
  store.events.value.reduce((total, row) => total + (row.tokens ?? 0), 0),
)
const visibleTokens = computed(() =>
  store.visibleRows.value.reduce((total, row) => total + (row.tokens ?? 0), 0),
)
const totalDuration = computed(() =>
  store.events.value.reduce((total, row) => total + row.duration, 0),
)
const maxDuration = computed(() =>
  store.events.value.reduce((max, row) => Math.max(max, row.duration), 0),
)
const filtersVisible = ref(true)
const failedCount = computed(
  () => store.events.value.filter(row => row.status === 'failed').length,
)
const timelineHeight = ref(96)
const detailsWidth = ref(320)
const dragging = ref<'timeline' | 'details' | null>(null)
let dragOrigin = 0
let dragSize = 0

function startResize(kind: 'timeline' | 'details', event: PointerEvent) {
  dragging.value = kind
  dragOrigin = kind === 'timeline' ? event.clientY : event.clientX
  dragSize = kind === 'timeline' ? timelineHeight.value : detailsWidth.value
  window.addEventListener('pointermove', resize)
  window.addEventListener('pointerup', stopResize, { once: true })
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
}
function resize(event: PointerEvent) {
  if (!dragging.value)
    return
  const delta = dragging.value === 'timeline'
    ? event.clientY - dragOrigin
    : dragOrigin - event.clientX
  if (dragging.value === 'timeline')
    timelineHeight.value = Math.min(360, Math.max(80, dragSize + delta))
  else
    detailsWidth.value = Math.min(520, Math.max(260, dragSize + delta))
}
function stopResize() {
  dragging.value = null
  window.removeEventListener('pointermove', resize)
}
const workspaceStyle = computed(() => ({
  gridTemplateRows: `${timelineHeight.value}px 1px minmax(0, 1fr)`,
}))
const contentStyle = computed(() => ({
  gridTemplateColumns: `minmax(420px, 1fr) 1px ${detailsWidth.value}px`,
}))
let port: chrome.runtime.Port | undefined
let retry: ReturnType<typeof setTimeout> | undefined
let disposed = false
function onMessage(message: unknown): void {
  applyPanelMessage(message, store.recording.value, store)
}
function refreshHistory(): void {
  const tabId = chrome.devtools?.inspectedWindow?.tabId
  if (typeof tabId === 'number')
    port?.postMessage({ type: 'devtools-panel-ready', tabId })
}
function toggleRecording(): void {
  store.recording.value = !store.recording.value
  if (store.recording.value && port)
    refreshHistory()
}
function clearEvents(): void {
  if (port)
    port.postMessage({ type: 'devtools-panel-clear' })
  else
    store.clear()
}
function connect(): void {
  if (disposed || typeof chrome === 'undefined' || !chrome.runtime?.connect)
    return
  try {
    port = chrome.runtime.connect({ name: 'devtools-panel' })
    store.connected.value = true
    port.onMessage.addListener(onMessage)
    port.onDisconnect.addListener(() => {
      port = undefined
      store.connected.value = false
      if (disposed)
        return
      retry = setTimeout(() => {
        retry = undefined
        connect()
      }, 500)
    })
    refreshHistory()
  }
  catch {
    if (!disposed)
      retry = setTimeout(connect, 500)
  }
}
function keyboard(event: KeyboardEvent): void {
  const index = store.visibleRows.value.findIndex(
    row => row.event.id === store.selectedId.value,
  )
  if (event.key === 'ArrowDown' && store.visibleRows.value.length) {
    store.select(
      store.visibleRows.value[
        Math.min(index + 1, store.visibleRows.value.length - 1)
      ].event.id,
    )
  }
  if (event.key === 'ArrowUp' && store.visibleRows.value.length)
    store.select(store.visibleRows.value[Math.max(index - 1, 0)].event.id)
  if (event.key === 'Escape')
    store.select('')
}
onMounted(() => {
  if (isStandaloneDemo)
    store.replaceEvents(demoEvents)
  connect()
  document.addEventListener('keydown', keyboard)
})
onUnmounted(() => {
  disposed = true
  document.removeEventListener('keydown', keyboard)
  if (retry)
    clearTimeout(retry)
  port?.disconnect()
  window.removeEventListener('pointermove', resize)
})
</script>

<template>
  <main class="flex h-screen flex-col overflow-hidden">
    <Toolbar
      :recording="store.recording.value"
      :filters-visible="filtersVisible"
      :query="store.query.value"
      :type="store.type.value"
      :status="store.status.value"
      :agent="store.agent.value"
      :only-errors="store.onlyErrors.value"
      :total="store.events.value.length"
      :count="store.visibleRows.value.length"
      @toggle-recording="toggleRecording"
      @clear="clearEvents"
      @add="addDemoEvents"
      @toggle-filters="filtersVisible = !filtersVisible"
      @update:query="store.query.value = $event"
      @update:type="store.type.value = $event"
      @update:status="store.status.value = $event"
      @update:agent="store.agent.value = $event"
      @toggle-errors="store.onlyErrors.value = !store.onlyErrors.value"
    />
    <div class="trace-workspace grid min-h-0 flex-1" :style="workspaceStyle">
      <div class="timeline-resizable">
        <Timeline
          :rows="store.visibleRows.value"
          :selected-id="store.selectedId.value"
          @select="store.select"
        />
      </div>
      <div class="content-workspace grid min-h-0" :style="contentStyle">
        <section class="flex min-w-0 flex-col border-r border-panel-border">
          <TraceTable
            :rows="store.visibleRows.value"
            :selected-id="store.selectedId.value"
            @select="store.select"
          />
        </section>
        <div
          class="resize-handle resize-handle-horizontal"
          role="separator"
          aria-label="Resize details panel width"
          aria-orientation="vertical"
          tabindex="0"
          @pointerdown="startResize('details', $event)"
          @keydown.left.prevent="detailsWidth = Math.min(520, detailsWidth + 8)"
          @keydown.right.prevent="detailsWidth = Math.max(260, detailsWidth - 8)"
        />
        <DetailsPanel
          :row="store.selected.value"
          :siblings="store.events.value"
          @select="store.select"
        />
      </div>
      <div
        class="resize-handle resize-handle-vertical"
        role="separator"
        aria-label="Resize timeline height"
        aria-orientation="horizontal"
        tabindex="0"
        @pointerdown="startResize('timeline', $event)"
        @keydown.down.prevent="timelineHeight = Math.min(360, timelineHeight + 8)"
        @keydown.up.prevent="timelineHeight = Math.max(80, timelineHeight - 8)"
      />
    </div>
    <TraceFooter
      :connected="store.connected.value"
      :event-count="store.events.value.length"
      :visible-count="store.visibleRows.value.length"
      :total-tokens="totalTokens"
      :visible-tokens="visibleTokens"
      :failed-count="failedCount"
      :max-duration="maxDuration"
      :total-duration="totalDuration"
    />
  </main>
</template>
