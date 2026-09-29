/** Background service worker for the DevTools extension. */
const panels = new Set<chrome.Port>()
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'devtools-panel') return
  panels.add(port)
  port.onDisconnect.addListener(() => panels.delete(port))
})
chrome.runtime.onMessage.addListener((message) => {
  if (
    message &&
    typeof message === 'object' &&
    'type' in message &&
    message.type === 'devtools-event'
  ) {
    for (const panel of panels) panel.postMessage(message)
  }
})
