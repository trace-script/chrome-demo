<script setup lang="ts">
import type { StoredEvent } from './event-store.js'
import type { TraceEvent } from './index.js'
import { onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { clearEvents, loadEvents } from './event-store.js'
import {
  forwardSseEvent,
  sendDevToolsClear,
  sendDevToolsEvent,
  sendDevToolsInit,

} from './index.js'

const messages = ref<string[]>([])
const isStreaming = shallowRef(false)
let streamTimer: ReturnType<typeof setInterval> | undefined

const sseChunks = [
  '正在分析你的问题…',
  '已收到上下文，准备生成回答…',
  '这是模拟 SSE 返回的第 3 个分片。',
  '回答生成完成。',
]

function formatEvent(event: StoredEvent): string {
  return event.source === 'sse' && event.eventId
    ? `[${event.eventId}] ${event.message}`
    : event.message
}

onMounted(() => {
  loadEvents()
    .then((events) => {
      messages.value = events.map(formatEvent)
      sendDevToolsInit(events)
    })
    .catch(() => undefined)
})

function simulateSse(): void {
  if (isStreaming.value)
    return

  isStreaming.value = true
  let chunkIndex = 0

  streamTimer = setInterval(() => {
    const data = sseChunks[chunkIndex]
    if (data === undefined) {
      stopSseSimulation()
      return
    }

    const event = new MessageEvent<string>('message', {
      data,
      lastEventId: String(chunkIndex + 1),
    })
    forwardSseEvent(event)
    messages.value.push(`[${event.lastEventId}] ${event.data}`)
    chunkIndex += 1
  }, 650)
}

function stopSseSimulation(): void {
  if (streamTimer !== undefined) {
    clearInterval(streamTimer)
    streamTimer = undefined
  }
  isStreaming.value = false
}

onUnmounted(stopSseSimulation)

function clearHistory(): void {
  messages.value = []
  clearEvents().catch(() => undefined)
  sendDevToolsClear()
}

const randomEvents: TraceEvent[] = [
  {
    role: 'assistant',
    message: 'agent.plan',
    request: { model: 'gpt-4.1', input: [{ role: 'user', content: 'Create a product brief' }] },
    payload: {
      id: 'resp_demo_plan',
      object: 'response',
      status: 'completed',
      model: 'gpt-4.1',
      output: [{ id: 'msg_demo_plan', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'Plan created' }] }],
      usage: { input_tokens: 620, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 }, output_tokens: 222, output_tokens_details: { reasoning_tokens: 80 }, total_tokens: 842 },
      error: null,
    },
    trace: { session_id: 'session_demo', trace_id: 'trace_demo_plan', type: 'Agent', name: 'agent.plan', agent: 'planner', status: 'success', model: 'gpt-4.1', duration_ms: 386 },
  },
  {
    role: 'assistant',
    message: 'tool.search',
    request: { model: 'gpt-4.1', input: [{ role: 'user', content: 'Search customer feedback Q4' }] },
    payload: {
      id: 'resp_demo_search',
      object: 'response',
      status: 'completed',
      model: 'gpt-4.1',
      output: [{ id: 'call_demo_search', type: 'function_call', name: 'search_feedback', arguments: '{"quarter":"Q4"}', call_id: 'call_search_1' }],
      usage: { input_tokens: 80, output_tokens: 46, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 126 },
      error: null,
    },
    trace: { session_id: 'session_demo', trace_id: 'trace_demo_search', parent_id: 'evt_demo_plan', tool_call_id: 'call_search_1', type: 'Tool', name: 'tool.search', agent: 'researcher', status: 'success', model: 'gpt-4.1', duration_ms: 712 },
  },
  {
    role: 'assistant',
    message: 'model.generate',
    request: { model: 'gpt-4.1-mini', input: [{ role: 'user', content: 'Draft the brief' }] },
    payload: {
      id: 'resp_demo_generate',
      object: 'response',
      status: 'in_progress',
      model: 'gpt-4.1-mini',
      output: [{ id: 'reason_demo_generate', type: 'reasoning', summary: [] }],
      usage: { input_tokens: 420, output_tokens: 784, output_tokens_details: { reasoning_tokens: 210 }, total_tokens: 1204 },
      error: null,
    },
    trace: { session_id: 'session_demo', trace_id: 'trace_demo_generate', parent_id: 'evt_demo_plan', type: 'LLM', name: 'model.generate', agent: 'writer', status: 'running', model: 'gpt-4.1-mini', duration_ms: 1840 },
  },
  {
    role: 'assistant',
    message: 'tool.validate',
    request: { model: 'gpt-4.1', input: [{ role: 'user', content: 'Validate product-brief.md' }] },
    payload: {
      id: 'resp_demo_validate',
      object: 'response',
      status: 'failed',
      model: 'gpt-4.1',
      output: [],
      usage: { input_tokens: 60, output_tokens: 28, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 88 },
      error: { message: 'missing owner field' },
    },
    trace: { session_id: 'session_demo', trace_id: 'trace_demo_validate', parent_id: 'evt_demo_generate', type: 'Tool', name: 'tool.validate', agent: 'reviewer', status: 'failed', model: 'gpt-4.1', duration_ms: 240 },
  },
  {
    role: 'assistant',
    message: 'agent.review',
    request: { model: 'gpt-4.1', input: [{ role: 'user', content: 'Review product-brief.md' }] },
    payload: {
      id: 'resp_demo_review',
      object: 'response',
      status: 'cancelled',
      model: 'gpt-4.1',
      output: [],
      usage: { input_tokens: 210, output_tokens: 100, output_tokens_details: { reasoning_tokens: 40 }, total_tokens: 310 },
      error: null,
    },
    trace: { session_id: 'session_demo', trace_id: 'trace_demo_review', parent_id: 'evt_demo_validate', type: 'Agent', name: 'agent.review', agent: 'reviewer', status: 'cancelled', model: 'gpt-4.1', duration_ms: 98 },
  },
]

function sendMockEvent(source: TraceEvent): void {
  const timestamp = Date.now()
  sendDevToolsEvent({
    ...source,
    payload: { ...source.payload, id: `resp_live_${timestamp}` },
    trace: {
      ...source.trace,
      started_at: timestamp,
      trace_id: `trace_live_${timestamp}`,
    },
  })
}

function addLlmData(): void {
  const message = `添加了第 ${messages.value.length + 1} 条 LLM 数据`
  messages.value.push(message)
  sendMockEvent({ ...randomEvents[2]!, message })
}

function emitRandomEvent(): void {
  const event = randomEvents[Math.floor(Math.random() * randomEvents.length)]
  if (event)
    sendMockEvent(event)
}
</script>

<template>
  <main>
    <h1>Agent SSE 流式数据</h1>
    <div class="actions">
      <button type="button" @click="addLlmData">
        添加 LLM 数据
      </button>
      <button type="button" @click="emitRandomEvent">
        随机发送 Trace 事件
      </button>
      <button type="button" :disabled="isStreaming" @click="simulateSse">
        {{ isStreaming ? 'SSE 发送中…' : '模拟 SSE 发送' }}
      </button>
      <button type="button" @click="clearHistory">
        清理历史
      </button>
    </div>
    <pre>{{ messages.length ? messages.join('\n') : '还没有数据' }}</pre>
  </main>
</template>
