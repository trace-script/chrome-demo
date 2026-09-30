import { persistEvent } from './event-store.js'

export interface RoleMessage {
  readonly role: string
  readonly message: string
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
export function sendDevToolsEvent(data: RoleMessage): void {
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
