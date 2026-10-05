import type { StoredEvent, TokenUsage, TraceMetadata } from './types.js'

export type JsonObject = Record<string, any>

export function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : {}
}

export function payloadOf(event: StoredEvent): JsonObject {
  return object(event.payload)
}

export function requestOf(event: StoredEvent): JsonObject {
  return object(event.request)
}

export function traceOf(event: StoredEvent): TraceMetadata {
  const payload = payloadOf(event)
  return object(event.trace ?? payload.trace) as TraceMetadata
}

export function usageOf(event: StoredEvent): TokenUsage {
  const payload = payloadOf(event)
  const usage = Object.keys(object(payload.usage)).length ? object(payload.usage) : payload
  const inputDetails = object(usage.input_tokens_details)
  const outputDetails = object(usage.output_tokens_details)
  return {
    input: numberOrUndefined(usage.input_tokens ?? usage.prompt_tokens),
    cachedInput: numberOrUndefined(inputDetails.cached_tokens),
    cacheWrite: numberOrUndefined(inputDetails.cache_write_tokens),
    output: numberOrUndefined(usage.output_tokens ?? usage.completion_tokens),
    reasoning: numberOrUndefined(outputDetails.reasoning_tokens),
    total: numberOrUndefined(usage.total_tokens ?? payload.total_tokens ?? payload.tokens),
  }
}

export function numberOrUndefined(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : undefined
}

export function displayValue(value: unknown): string {
  return value === undefined || value === null ? '—' : String(value)
}

export function outputItems(event: StoredEvent): JsonObject[] {
  const output = payloadOf(event).output
  return Array.isArray(output) ? output.map(object) : []
}

export function outputSummary(event: StoredEvent): string {
  const payload = payloadOf(event)
  if (typeof payload.output_text === 'string')
    return payload.output_text
  return outputItems(event)
    .flatMap(item => Array.isArray(item.content) ? item.content : [])
    .filter(item => object(item).type === 'output_text')
    .map(item => object(item).text)
    .filter((text): text is string => typeof text === 'string')
    .join('\n')
}

export function formatTimestamp(value: unknown): string {
  const timestamp = numberOrUndefined(value)
  return timestamp === undefined ? '—' : new Date(timestamp).toLocaleString()
}
