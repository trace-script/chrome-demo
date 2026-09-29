const output = document.querySelector<HTMLPreElement>('#events')!
const events: unknown[] = []
const render = (): void => {
  output.textContent = events.length
    ? events.map((event) => JSON.stringify(event, null, 2)).join('\n\n')
    : 'Waiting for events…'
}
const port = chrome.runtime.connect({ name: 'devtools-panel' })
port.onMessage.addListener((message) => {
  if (
    !message ||
    typeof message !== 'object' ||
    !('type' in message) ||
    message.type !== 'devtools-event'
  )
    return
  events.push('payload' in message ? message.payload : message)
  render()
})
