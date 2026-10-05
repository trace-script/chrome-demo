/** Background service worker for the DevTools extension. */

interface StoredEvent {
  readonly id: string
  readonly tabId: number
  readonly seq: number
  readonly timestamp: number
  readonly payload: unknown
  readonly request?: unknown
  readonly trace?: unknown
}

interface PanelState {
  readonly port: chrome.runtime.Port
  tabId?: number
}

const databaseName = 'mugeda-agent-events'
const databaseVersion = 1
const eventStoreName = 'events'
const panels = new Set<PanelState>()
const nextSequences = new Map<number, number>()
const eventQueues = new Map<number, Promise<void>>()

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion)
    request.onupgradeneeded = () => {
      const database = request.result
      const store = database.createObjectStore(eventStoreName, {
        keyPath: 'id',
      })
      store.createIndex('tabId', 'tabId', { unique: false })
      store.createIndex('tabSeq', ['tabId', 'seq'], { unique: true })
    }
    request.onsuccess = () => resolve(request.result)
    request.addEventListener('error', () => reject(request.error))
  })
}

async function saveEvent(event: StoredEvent): Promise<void> {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(eventStoreName, 'readwrite')
    transaction.objectStore(eventStoreName).put(event)
    transaction.oncomplete = () => resolve()
    transaction.addEventListener('error', () => reject(transaction.error))
  })
  database.close()
}

async function readEvents(tabId: number): Promise<StoredEvent[]> {
  const database = await openDatabase()
  const events = await new Promise<StoredEvent[]>((resolve, reject) => {
    const request = database
      .transaction(eventStoreName, 'readonly')
      .objectStore(eventStoreName)
      .index('tabId')
      .getAll(tabId)
    request.onsuccess = () => resolve(request.result as StoredEvent[])
    request.addEventListener('error', () => reject(request.error))
  })
  database.close()
  // Keep the extension compatible with Chrome versions without ES2023 toSorted.

  return events.sort((left, right) => left.seq - right.seq)
}

async function persistEvent(event: StoredEvent): Promise<void> {
  await saveEvent(event)
}

async function deleteTabEvents(tabId: number): Promise<void> {
  const events = await readEvents(tabId)
  if (!events.length)
    return
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(eventStoreName, 'readwrite')
    const store = transaction.objectStore(eventStoreName)
    for (const event of events) store.delete(event.id)
    transaction.oncomplete = () => resolve()
    transaction.addEventListener('error', () => reject(transaction.error))
  })
  database.close()
}

function createEvent(tabId: number, payload: unknown): StoredEvent {
  const seq = (nextSequences.get(tabId) ?? 0) + 1
  nextSequences.set(tabId, seq)
  const envelope = payload && typeof payload === 'object' && 'payload' in payload
    ? payload as { payload: unknown, request?: unknown, trace?: unknown }
    : undefined
  return {
    id: crypto.randomUUID(),
    tabId,
    seq,
    timestamp: Date.now(),
    payload: envelope?.payload ?? payload,
    request: envelope?.request,
    trace: envelope?.trace as StoredEvent['trace'],
  }
}

function sendToTab(tabId: number, message: unknown): void {
  for (const panel of panels) {
    if (panel.tabId === tabId)
      panel.port.postMessage(message)
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'devtools-panel')
    return
  const panel: PanelState = { port }
  panels.add(panel)
  port.onMessage.addListener((message: unknown) => {
    if (
      !message
      || typeof message !== 'object'
      || !('type' in message)
      || message.type !== 'devtools-panel-ready'
      || !('tabId' in message)
      || typeof message.tabId !== 'number'
    ) {
      return
    }

    panel.tabId = message.tabId
    readEvents(panel.tabId)
      .then((events) => {
        port.postMessage({ type: 'devtools-history', events })
      })
      .catch((error: unknown) => {
        console.error('Failed to read DevTools event history', error)
      })
  })
  port.onDisconnect.addListener(() => panels.delete(panel))
})

function queueEvent(tabId: number, payload: unknown): void {
  const previous = eventQueues.get(tabId) ?? Promise.resolve()
  const current = previous
    .then(async () => {
      if (!nextSequences.has(tabId)) {
        try {
          const events = await readEvents(tabId)
          nextSequences.set(tabId, events.at(-1)?.seq ?? 0)
        }
        catch (error: unknown) {
          console.error('Failed to initialize DevTools event sequence', error)
          nextSequences.set(tabId, 0)
        }
      }
      const event = createEvent(tabId, payload)
      sendToTab(event.tabId, { type: 'devtools-event', event })
      await persistEvent(event)
    })
    .catch((error: unknown) => {
      console.error('Failed to persist DevTools event', error)
    })
  eventQueues.set(tabId, current)
}

function queueHistoryReplacement(
  tabId: number,
  payloads: unknown[],
  preserveRealtime = false,
): void {
  const previous = eventQueues.get(tabId) ?? Promise.resolve()
  const current = previous
    .then(async () => {
      // The web app loads its local history asynchronously. A user can emit
      // live events before that snapshot arrives; replacing the tab history
      // here would erase those events from the panel. Keep the events already
      // persisted by this service worker and let the panel replay them.
      if (preserveRealtime) {
        const current = await readEvents(tabId)
        if (current.length) {
          sendToTab(tabId, { type: 'devtools-history', events: current })
          return
        }
      }
      await deleteTabEvents(tabId)
      nextSequences.set(tabId, 0)

      const events: StoredEvent[] = []
      for (const payload of payloads) {
        const event = createEvent(tabId, payload)
        await persistEvent(event)
        events.push(event)
      }
      sendToTab(tabId, { type: 'devtools-history', events })
    })
    .catch((error: unknown) => {
      console.error('Failed to replace DevTools event history', error)
    })
  eventQueues.set(tabId, current)
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (
    !message
    || typeof message !== 'object'
    || !('type' in message)
    || typeof sender.tab?.id !== 'number'
  ) {
    return
  }

  if (message.type === 'devtools-init') {
    if (!('payload' in message) || !Array.isArray(message.payload))
      return
    queueHistoryReplacement(sender.tab.id, message.payload, true)
    return
  }

  if (message.type === 'devtools-clear') {
    queueHistoryReplacement(sender.tab.id, [])
    return
  }

  if (message.type === 'devtools-event') {
    queueEvent(sender.tab.id, 'payload' in message ? message.payload : message)
  }
})

chrome.tabs.onRemoved.addListener((tabId) => {
  nextSequences.delete(tabId)
  eventQueues.delete(tabId)
  deleteTabEvents(tabId).catch((error: unknown) => {
    console.error('Failed to delete closed tab events', error)
  })
})
