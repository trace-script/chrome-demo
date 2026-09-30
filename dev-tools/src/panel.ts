const output = document.querySelector<HTMLPreElement>('#events')!
output.style.setProperty('font-size', '12px', 'important')
interface StoredEvent {
  readonly id: string
  readonly tabId: number
  readonly seq: number
  readonly timestamp: number
  readonly payload: unknown
}

const events: StoredEvent[] = []
const render = (): void => {
  output.textContent = events.length
    ? events.map((event) => JSON.stringify(event.payload, null, 2)).join('\n\n')
    : 'Waiting for events…'
}
let port: chrome.runtime.Port | undefined
let reconnectTimer: ReturnType<typeof setTimeout> | undefined

function addEvent(event: StoredEvent): void {
  if (events.some((existing) => existing.id === event.id)) return
  events.push(event)
  events.sort((left, right) => left.seq - right.seq)
  render()
}

function handleMessage(message: unknown): void {
  if (!message || typeof message !== 'object' || !('type' in message)) return

  if (
    message.type === 'devtools-history' &&
    'events' in message &&
    Array.isArray(message.events)
  ) {
    events.splice(0)
    for (const event of message.events) {
      if (!event || typeof event !== 'object') continue
      addEvent(event as StoredEvent)
    }
    render()
    return
  }

  if (message.type === 'devtools-event' && 'event' in message) {
    addEvent(message.event as StoredEvent)
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer !== undefined) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined
    connectPanel()
  }, 250)
}

function connectPanel(): void {
  try {
    const nextPort = chrome.runtime.connect({ name: 'devtools-panel' })
    port = nextPort
    nextPort.onMessage.addListener(handleMessage)
    nextPort.onDisconnect.addListener(() => {
      if (port !== nextPort) return
      port = undefined
      scheduleReconnect()
    })
    nextPort.postMessage({
      type: 'devtools-panel-ready',
      tabId: chrome.devtools.inspectedWindow.tabId,
    })
  } catch {
    port = undefined
    scheduleReconnect()
  }
}

connectPanel()
