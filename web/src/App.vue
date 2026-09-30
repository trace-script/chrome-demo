<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { clearEvents, loadEvents, type StoredEvent } from './event-store.js'
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
  if (isStreaming.value) return

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

function addLlmData(): void {
  const message = `添加了第 ${messages.value.length + 1} 条 LLM 数据`
  messages.value.push(message)
  sendDevToolsEvent({ role: 'user', message })
}

function clearHistory(): void {
  messages.value = []
  clearEvents().catch(() => undefined)
  sendDevToolsClear()
}
</script>

<template>
  <main>
    <h1>Agent SSE 流式数据</h1>
    <div class="actions">
      <button type="button" @click="addLlmData">添加 LLM 数据</button>
      <button type="button" :disabled="isStreaming" @click="simulateSse">
        {{ isStreaming ? 'SSE 发送中…' : '模拟 SSE 发送' }}
      </button>
      <button type="button" @click="clearHistory">清理历史</button>
    </div>
    <pre>{{ messages.length ? messages.join('\n') : '还没有数据' }}</pre>
  </main>
</template>
