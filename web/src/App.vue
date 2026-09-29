<script setup lang="ts">
import { ref } from 'vue'
import { sendDevToolsEvent } from './index'

const messages = ref<string[]>([])

function addLlmData(): void {
  const message = `添加了第 ${messages.value.length + 1} 条 LLM 数据`
  messages.value.push(message)
  sendDevToolsEvent({ role: 'user', message })
}
</script>

<template>
  <main>
    <h1>LLM 数据记录</h1>
    <button type="button" @click="addLlmData">添加 LLM 数据</button>
    <pre>{{ messages.length ? messages.join('\n') : '还没有数据' }}</pre>
  </main>
</template>
