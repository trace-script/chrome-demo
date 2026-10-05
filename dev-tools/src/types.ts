export type Status = 'success' | 'running' | 'failed' | 'cancelled'
export type DetailTab
  = 'Overview' | 'Usage' | 'Payload' | 'Timing' | 'Relations' | 'Raw'
export interface StoredEvent {
  readonly id: string
  readonly tabId: number
  readonly seq: number
  readonly timestamp: number
  readonly payload: unknown
  readonly request?: unknown
  readonly trace?: TraceMetadata
}
export interface TraceMetadata {
  readonly session_id?: string
  readonly trace_id?: string
  readonly parent_id?: string
  readonly tool_call_id?: string
  readonly retry_count?: number
  readonly type?: string
  readonly name?: string
  readonly agent?: string
  readonly status?: Status | string
  readonly model?: string
  readonly started_at?: number
  readonly ended_at?: number
  readonly duration_ms?: number
  readonly timing?: { queue_ms?: number, model_ms?: number, tool_ms?: number }
}
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

export interface TokenUsage {
  input?: number
  cachedInput?: number
  cacheWrite?: number
  output?: number
  reasoning?: number
  total?: number
}
