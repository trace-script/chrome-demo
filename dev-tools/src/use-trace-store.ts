import type { Status, StoredEvent, TraceRow } from './types.js'
import { computed, ref } from 'vue'
import { numberOrUndefined, payloadOf, requestOf, traceOf, usageOf } from './transcript-format.js'

export function useTraceStore() {
  const events = ref<TraceRow[]>([])
  const selectedId = ref('')
  const query = ref('')
  const type = ref('all')
  const status = ref('all')
  const agent = ref('all')
  const onlyErrors = ref(false)
  const recording = ref(true)
  const connected = ref(false)
  const validEvents = computed(() =>
    events.value.filter(row => Boolean(row?.event?.id)),
  )
  const visibleRows = computed(() =>
    validEvents.value.filter((row) => {
      const matchesQuery
        = !query.value
          || `${row.name} ${row.event.id}`
            .toLowerCase()
            .includes(query.value.toLowerCase())
      return (
        matchesQuery
        && (type.value === 'all' || row.type === type.value)
        && (status.value === 'all' || row.status === status.value)
        && (agent.value === 'all' || row.agent === agent.value)
        && (!onlyErrors.value || row.status === 'failed')
      )
    }),
  )
  const selected = computed(() =>
    validEvents.value.find(row => row.event.id === selectedId.value),
  )
  function addEvent(event: StoredEvent): void {
    if (!event || typeof event.id !== 'string')
      return
    if (events.value.some(row => row.event.id === event.id))
      return
    const payload = payloadOf(event)
    const request = requestOf(event)
    const metadata = traceOf(event)
    const usage = usageOf(event)
    const totalTokens = usage.total
    const startedAt = numberOrUndefined(metadata.started_at) ?? event.timestamp
    const duration = numberOrUndefined(metadata.duration_ms) ?? numberOrUndefined(payload.duration) ?? 0
    const earliest = Math.min(
      ...events.value.map(row => numberOrUndefined(traceOf(row.event).started_at) ?? row.event.timestamp),
      startedAt,
    )
    events.value.push({
      event,
      name: String(metadata.name ?? payload.name ?? payload.event ?? 'trace.event'),
      type: String(metadata.type ?? payload.type ?? 'Trace'),
      status: (metadata.status ?? payload.status ?? 'success') as Status,
      agent: String(metadata.agent ?? payload.agent ?? '—'),
      model: String(metadata.model ?? payload.model ?? request.model ?? '—'),
      tokens: Number.isFinite(totalTokens) ? totalTokens : undefined,
      duration,
      start: startedAt - earliest,
      parentId: metadata.parent_id,
    })
  }
  function replaceEvents(nextEvents: readonly StoredEvent[]): void {
    events.value = []
    selectedId.value = ''
    nextEvents.forEach(addEvent)
  }
  function clear(): void {
    events.value = []
    selectedId.value = ''
  }
  function select(id: string): void {
    selectedId.value = id
  }
  return {
    events,
    visibleRows,
    selected,
    selectedId,
    query,
    type,
    status,
    agent,
    onlyErrors,
    recording,
    connected,
    addEvent,
    replaceEvents,
    clear,
    select,
  }
}
