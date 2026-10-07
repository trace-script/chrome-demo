# dev-tools

Chrome DevTools 扩展 demo：网页发送 `{ role, message }`，background 持续把事件保存到 IndexedDB，DevTools 面板打开后回放当前 Tab 的历史并继续接收实时事件。

```bash
pnpm build
```

在 `chrome://extensions` 开启开发者模式，加载构建后的 `dist/` 目录。重新加载扩展并刷新网页，然后点击网页按钮。

消息链路：

```text
web window.postMessage → content.js → background.js → IndexedDB
                                             └──────→ DevTools panel
```

事件按 Tab 保存，Tab 关闭后清理。页面消息使用 `source: 'trace-script-extension'` 区分其他 `postMessage`；扩展接受所有站点和 frame 的事件，在详情中显示 Frame ID，但只有顶层 frame 能初始化或清空 Tab 历史。网页初始化时发送 `devtools-init` 快照，background 将它与已收到的实时事件按 `bridgeId` 去重合并。面板连接后按 Tab 顺序读取历史并接收实时事件；消息写入 IndexedDB 后才回复成功并推送面板。

每个 Tab 最多保留 2000 条事件；初始化快照超过数量或 1 MiB 时，保留容量内最新的事件。普通事件单条消息最大 1 MiB，每秒最多接收 100 条，同时最多排队 32 条页面消息。面板的 Pause 暂停实时显示，恢复时重新读取历史；Clear 在暂停时也会清空可见列表和扩展保存的当前 Tab 历史。页面自己的 IndexedDB 独立于扩展，页面重新加载时仍可能重新发送它保存的事件。
