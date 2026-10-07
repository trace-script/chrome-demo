<script setup lang="ts">
import type { DetailTab, TraceRow } from '../types'
import { computed, ref } from 'vue'
import VueJsonPretty from 'vue-json-pretty'
import { displayValue, formatTimestamp, outputItems, outputSummary, payloadOf, requestOf, traceOf, usageOf } from '../transcript-format.js'
import DetailTabs from './DetailTabs.vue'
import 'vue-json-pretty/lib/styles.css'

const props = defineProps<{ row?: TraceRow, siblings: TraceRow[] }>()
const emit = defineEmits<{ select: [id: string] }>()
const active = ref<DetailTab>('Overview')
const tabs: DetailTab[] = ['Overview', 'Usage', 'Payload', 'Timing', 'Relations', 'Raw']
function duration(value: number | undefined) {
  if (value === undefined)
    return '—'
  return value < 1000 ? `${value}ms` : `${(value / 1000).toFixed(1)}s`
}
function value(input: unknown) {
  return displayValue(input)
}
const payload = computed(() => props.row ? payloadOf(props.row.event) : {})
const request = computed(() => props.row ? requestOf(props.row.event) : {})
const trace = computed(() => props.row ? traceOf(props.row.event) : {})
const usage = computed(() => props.row ? usageOf(props.row.event) : {})
const output = computed(() => props.row ? outputItems(props.row.event) : [])
const summary = computed(() => props.row ? outputSummary(props.row.event) : '')
const children = computed(() => props.siblings.filter(item => props.row && traceOf(item.event).parent_id === props.row.event.id))
const related = computed(() => {
  if (!props.row)
    return []
  const current = traceOf(props.row.event)
  return props.siblings.filter((item) => {
    if (!item?.event?.id || item.event.id === props.row?.event.id)
      return false
    const itemTrace = traceOf(item.event)
    return itemTrace.parent_id === props.row?.event.id || current.parent_id === item.event.id
      || (current.trace_id !== undefined && itemTrace.trace_id === current.trace_id)
      || (current.tool_call_id !== undefined && itemTrace.tool_call_id === current.tool_call_id)
  })
})
const retryEvents = computed(() => props.siblings.filter(item => props.row && traceOf(item.event).trace_id === trace.value.trace_id && traceOf(item.event).retry_count !== undefined))
</script>

<template>
  <aside v-if="row?.event?.id" class="details-panel text-xs flex min-w-0 flex-col bg-(--panel-surface)">
    <DetailTabs v-model:active="active" :tabs="tabs" />
    <div class="details-content min-h-0 flex-1 overflow-auto p-2.5">
      <template v-if="active === 'Overview'">
        <dl class="details-fields mb-5 grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-0">
          <template v-for="entry in [['Name', row.name], ['Type', row.type], ['Status', row.status], ['Agent', row.agent], ['Model', row.model], ['Frame ID', row.event.frameId ?? 0], ['Tokens', value(row.tokens)], ['Duration', duration(row.duration)], ['Started', formatTimestamp(trace.started_at)], ['Ended', formatTimestamp(trace.ended_at)], ['Event ID', row.event.id], ['Session ID', trace.session_id], ['Trace ID', trace.trace_id], ['Parent ID', trace.parent_id]]" :key="entry[0]">
            <dt class="details-field-label border-b border-(--divider) py-2.5 text-slate-500">
              {{ entry[0] }}
            </dt><dd class="details-field-value text-xs m-0 min-w-0 wrap-break-word border-b border-(--divider) py-2.5">
              {{ entry[1] }}
            </dd>
          </template>
        </dl>
      </template>
      <template v-else-if="active === 'Usage'">
        <dl class="details-fields mb-5 grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-0">
          <template v-for="entry in [['Input tokens', usage.input], ['Cached input', usage.cachedInput], ['Cache write', usage.cacheWrite], ['Output tokens', usage.output], ['Reasoning tokens', usage.reasoning], ['Total tokens', usage.total]]" :key="entry[0]">
            <dt class="details-field-label border-b border-(--divider) py-2.5 text-slate-500">
              {{ entry[0] }}
            </dt><dd class="details-field-value m-0 border-b border-(--divider) py-2.5">
              {{ value(entry[1]) }}
            </dd>
          </template>
        </dl>
        <p v-if="summary" class="whitespace-pre-wrap text-slate-300">
          {{ summary }}
        </p>
      </template>
      <template v-else-if="active === 'Payload'">
        <div class="details-section-label">
          Request input
        </div><div v-if="request.input !== undefined" class="details-json mb-5 rounded border border-(--code-border) bg-(--code-bg) p-3">
          <VueJsonPretty :data="request.input" :deep="2" :show-length="true" :show-line="true" theme="dark" />
        </div><pre v-else class="details-code text-xs mb-5 rounded border border-(--code-border) bg-(--code-bg) p-3 whitespace-pre-wrap text-slate-300">—</pre><div class="details-section-label">
          Response output
        </div><div v-if="output.length" class="space-y-2 mb-5">
          <section v-for="(item, index) in output" :key="`${item.id ?? index}`" class="rounded border border-(--code-border) bg-(--code-bg) p-3">
            <strong class="text-slate-200">{{ value(item.type) }}</strong><div class="details-json mt-2">
              <VueJsonPretty :data="item" :deep="2" :show-length="true" :show-line="true" theme="dark" />
            </div>
          </section>
        </div><pre v-else class="details-code text-xs mb-5 rounded border border-(--code-border) bg-(--code-bg) p-3 whitespace-pre-wrap text-slate-300">—</pre><div v-if="payload.error !== undefined" class="details-section-label details-section-label-error">
          Error
        </div><div v-if="payload.error !== undefined" class="details-json details-json-error rounded border border-red-900 bg-(--code-bg) p-3">
          <VueJsonPretty :data="payload.error" :deep="2" :show-length="true" :show-line="true" theme="dark" />
        </div>
      </template>
      <dl v-else-if="active === 'Timing'" class="details-fields grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-0">
        <template v-for="entry in [['Queue', trace.timing?.queue_ms], ['Model', trace.timing?.model_ms], ['Tool', trace.timing?.tool_ms], ['Total', trace.duration_ms ?? row.duration], ['Start', formatTimestamp(trace.started_at)], ['End', formatTimestamp(trace.ended_at)]]" :key="entry[0]">
          <dt class="details-field-label border-b border-(--divider) py-2.5 text-slate-500">
            {{ entry[0] }}
          </dt><dd class="details-field-value m-0 border-b border-(--divider) py-2.5">
            {{ entry[0] === 'Start' || entry[0] === 'End' ? entry[1] : typeof entry[1] === 'number' ? duration(entry[1]) : value(entry[1]) }}
          </dd>
        </template>
      </dl>
      <template v-else-if="active === 'Relations'">
        <div class="details-section-label">
          Parent and children
        </div><button v-if="trace.parent_id" type="button" class="details-relation mb-2 block w-full rounded border border-(--control-border) bg-(--control-bg) px-3 py-2.5 text-left" @click="emit('select', trace.parent_id)">
          Parent: {{ trace.parent_id }}
        </button><button v-for="item in children" :key="item.event.id" type="button" class="details-relation mb-2 block w-full rounded border border-(--control-border) bg-(--control-bg) px-3 py-2.5 text-left" @click="emit('select', item.event.id)">
          Child: {{ item.name }}
        </button><div class="details-section-label details-section-label-spaced">
          Trace and tool call links
        </div><button v-for="item in related" :key="item.event.id" type="button" class="details-relation mb-2 block w-full rounded border border-(--control-border) bg-(--control-bg) px-3 py-2.5 text-left" @click="emit('select', item.event.id)">
          {{ item.name }} · {{ item.event.id }}
        </button><div v-if="retryEvents.length" class="details-section-label details-section-label-spaced">
          Retry chain
        </div><button v-for="item in retryEvents" :key="`retry-${item.event.id}`" type="button" class="details-relation mb-2 block w-full rounded border border-(--control-border) bg-(--control-bg) px-3 py-2.5 text-left" @click="emit('select', item.event.id)">
          Retry {{ value(traceOf(item.event).retry_count) }}: {{ item.name }}
        </button><p v-if="!trace.parent_id && !children.length && !related.length && !retryEvents.length" class="text-slate-500">
          No related events
        </p>
      </template>
      <div v-else class="details-json rounded border border-(--code-border) bg-(--code-bg) p-3">
        <VueJsonPretty :data="row.event" :deep="2" :show-length="true" :show-line="true" theme="dark" />
      </div>
    </div>
  </aside>
  <aside v-else class="grid place-items-center bg-(--panel-surface) text-slate-500">
    Select an event to inspect details
  </aside>
</template>
