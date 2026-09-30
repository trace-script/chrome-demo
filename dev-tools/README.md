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

事件按 Tab 保存，Tab 关闭后清理。网页初始化时会发送 `devtools-init` 全量快照，清理按钮发送 `devtools-clear`，background 替换或清空该 Tab 的历史，面板也会整体替换当前列表；之后继续接收实时事件。面板连接后先发送当前 inspected tab，background 返回历史快照；历史和实时消息都带有唯一 `id` 与递增 `seq`，面板会去重并按顺序渲染。
