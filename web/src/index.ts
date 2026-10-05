import { persistEvent } from './event-store.js'

export interface RoleMessage {
  readonly role: string
  readonly message: string
}

export interface TraceEvent {
  readonly role: string
  readonly message: string
  readonly request: {
    readonly model: string
    readonly input: unknown[]
  }
  readonly payload: {
    readonly id: string
    readonly object: 'response'
    readonly status: string
    readonly model: string
    readonly output: readonly Record<string, unknown>[]
    readonly usage: Record<string, unknown>
    readonly error: unknown
  }
  readonly trace: {
    readonly session_id: string
    readonly trace_id: string
    readonly parent_id?: string
    readonly tool_call_id?: string
    readonly type: 'Trace' | 'Agent' | 'LLM' | 'Tool'
    readonly name: string
    readonly agent: string
    readonly status: 'success' | 'running' | 'failed' | 'cancelled'
    readonly model: string
    readonly started_at?: number
    readonly duration_ms: number
  }
}

export interface SseTraceMessage extends RoleMessage {
  readonly source: 'sse'
  readonly eventId: string
}

export interface AgentSseOptions {
  readonly withCredentials?: boolean
  readonly onMessage?: (event: MessageEvent<string>) => void
  readonly onError?: (event: Event) => void
}

export interface DevToolsInitMessage {
  readonly type: 'devtools-init'
  readonly payload: readonly RoleMessage[]
}

/** Send one trace record to the DevTools extension, if it is installed. */
export function sendDevToolsEvent(data: RoleMessage | TraceEvent): void {
  persistEvent(data).catch(() => undefined)
  window.postMessage({ type: 'devtools-event', payload: data }, '*')
}

export function sendDevToolsInit(events: readonly RoleMessage[]): void {
  window.postMessage({ type: 'devtools-init', payload: events }, '*')
}

export function sendDevToolsClear(): void {
  window.postMessage({ type: 'devtools-clear' }, '*')
}

/** Forward an already parsed SSE message to DevTools. */
export function forwardSseEvent(event: MessageEvent<string>): void {
  const trace: SseTraceMessage = {
    role: 'assistant',
    message: event.data,
    source: 'sse',
    eventId: event.lastEventId,
  }
  sendDevToolsEvent(trace)
}

/**
 * Open the agent's upstream SSE stream.
 *
 * Each message is forwarded before the application callback runs, so a
 * callback cannot accidentally prevent DevTools from seeing an upstream
 * chunk. The returned function closes the stream and removes its handlers.
 */
export function connectAgentSse(
  url: string | URL,
  options: AgentSseOptions = {},
): () => void {
  const source = new EventSource(url, {
    withCredentials: options.withCredentials ?? false,
  })

  const handleMessage = (event: MessageEvent<string>): void => {
    forwardSseEvent(event)
    options.onMessage?.(event)
  }

  const handleError = (event: Event): void => {
    options.onError?.(event)
  }

  source.addEventListener('message', handleMessage)
  source.addEventListener('error', handleError)

  return (): void => {
    source.removeEventListener('message', handleMessage)
    source.removeEventListener('error', handleError)
    source.close()
  }
}

export function reportClick(element: Element): () => void {
  const handler = (event: Event): void => {
    const target = event.target instanceof Element ? event.target : element
    sendDevToolsEvent({ role: 'user', message: `点击了 ${target.tagName}` })
  }
  element.addEventListener('click', handler)
  return () => element.removeEventListener('click', handler)
}
