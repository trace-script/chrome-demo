<script setup lang="ts">
import type { StoredEvent } from './event-store.js'
import type { TraceEvent } from './index.js'
import type { MockEvent } from './mock-events.js'
import { onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { clearEvents, loadEvents } from './event-store.js'
import { mockEvents } from './mock-events.js'
import {
  forwardSseEvent,
  sendDevToolsClear,
  sendDevToolsEvent,
  sendDevToolsInit
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
  sentMockEvents.value = []
  clearEvents().catch(() => undefined)
  sendDevToolsClear()
}

const sentMockEvents = shallowRef<TraceEvent[]>([])
const sessionId = crypto.randomUUID()

function sendMockEvent(mock: MockEvent): void {
  const timestamp = Date.now()
  const model = mock.model ?? 'gpt-5.6-sol'
  const event: TraceEvent = {
    role: mock.type === 'message.user' ? 'user' : 'assistant',
    message: mock.type,
    request: { model, input: [...(mock.input ?? [])] },
    payload: {
      id: crypto.randomUUID(),
      object: 'response',
      status: mock.status === 'failed' ? 'failed' : mock.status === 'running' ? 'in_progress' : mock.status === 'cancelled' ? 'cancelled' : 'completed',
      model,
      output: mock.output ?? [],
      usage: mock.usage ?? {},
      error: mock.error ?? null,
    },
    trace: {
      session_id: sessionId,
      trace_id: crypto.randomUUID(),
      type: mock.traceType,
      name: mock.type,
      agent: mock.agent ?? 'codex',
      status: mock.status,
      model,
      started_at: timestamp,
      duration_ms: mock.durationMs ?? 0,
    },
  }
  sendDevToolsEvent(event)
  sentMockEvents.value = [event, ...sentMockEvents.value]
}

function sendAllMockEvents(): void {
  for (const mock of mockEvents)
    sendMockEvent(mock)
}

function addLlmData(): void {
  const modelResponse = mockEvents.find(event => event.type === 'model.response')
  if (modelResponse)
    sendMockEvent(modelResponse)
}
</script>

<template>
  <main>
    <h1>Agent Trace Playground</h1>
    <div class="actions">
      <button type="button" @click="sendAllMockEvents">
        一键发送全部 {{ mockEvents.length }} 种事件
      </button>
      <button type="button" @click="addLlmData">
        添加 LLM 数据
      </button>
      <button type="button" :disabled="isStreaming" @click="simulateSse">
        {{ isStreaming ? 'SSE 发送中…' : '模拟 SSE 发送' }}
      </button>
      <button type="button" @click="clearHistory">
        清理历史
      </button>
    </div>
    <div class="mock-buttons">
      <button v-for="mock in mockEvents" :key="mock.type" type="button" :title="mock.type" @click="sendMockEvent(mock)">
        {{ mock.label }}
      </button>
    </div>
    <h2>已发送 {{ sentMockEvents.length }} 条 mock 事件</h2>
    <p v-if="sentMockEvents.length === 0">还没有发送 mock 事件。</p>
    <details v-for="event in sentMockEvents" :key="event.payload.id">
      <summary>{{ event.message }} · {{ event.trace.status }}</summary>
      <pre>{{ JSON.stringify(event, null, 2) }}</pre>
    </details>
    <h2>消息历史</h2>
    <pre>{{ messages.length ? messages.join('\n') : '还没有消息' }}</pre>
  </main>
</template>
