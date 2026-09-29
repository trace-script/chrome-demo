# dev-tools

最小 Chrome DevTools 扩展：网页点击后发送 `{ role, message }`，扩展面板用 `<pre>` 展示。

```bash
pnpm build
```

在 `chrome://extensions` 开启开发者模式，加载构建后的 `dist/` 目录。重新加载扩展并刷新网页，然后点击网页按钮。

消息链路：

```text
web window.postMessage → content.js → background.js → DevTools panel
```
