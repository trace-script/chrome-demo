export type Status = 'success' | 'running' | 'failed' | 'cancelled'
export type DetailTab
  = 'Overview' | 'Usage' | 'Payload' | 'Timing' | 'Relations' | 'Raw'
export type StoredEvent = Readonly<{
  id: string
  tabId: number
  frameId?: number
  seq: number
  timestamp: number
  payload: unknown
  request?: unknown
  trace?: TraceMetadata
}>
export type TraceMetadata = Readonly<Partial<{
  session_id: string
  trace_id: string
  parent_id: string
  tool_call_id: string
  retry_count: number
  type: string
  name: string
  agent: string
  status: Status | string
  model: string
  started_at: number
  ended_at: number
  duration_ms: number
  timing: { queue_ms?: number, model_ms?: number, tool_ms?: number }
}>>
export interface TraceRow {
  event: StoredEvent
  name: string
  type: string
  status: Status
  agent: string
  model: string
  tokens?: number
  duration: number
  start: number
  parentId?: string
}

export type TokenUsage = Partial<{
  input: number
  cachedInput: number
  cacheWrite: number
  output: number
  reasoning: number
  total: number
}>
