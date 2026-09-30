# web

最小 Vite + Vue 页面。点击按钮会生成一条 `{ role, message }` 数据，并通过 `window.postMessage` 发送给 DevTools 扩展。

Agent 接收上游 SSE 时使用 `connectAgentSse`。每条 `message` 会先转发到 DevTools，再调用业务回调；关闭页面或切换会话时调用返回的清理函数即可。如果项目已经有 SSE 客户端，也可以在收到 `MessageEvent` 时直接调用 `forwardSseEvent(event)`。

```ts
import { connectAgentSse } from './index'

const close = connectAgentSse('/api/agent/stream', {
  onMessage: (event) => consumeAgentChunk(event.data),
})

// 会话结束时
close()
```

转发到 DevTools 的 payload 包含 `role: 'assistant'`、SSE 原始 `message`、`source: 'sse'` 和 `eventId`，因此流式分片会按接收顺序显示在面板中。

所有通过 `sendDevToolsEvent` 触发的事件都会同步写入 IndexedDB；页面刷新后会自动恢复到事件列表。

```bash
pnpm dev
```
