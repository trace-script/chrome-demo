/** Background service worker for the DevTools extension. */

import { limitDevToolsSnapshot, maxEventsPerTab, maxMessageBytes } from '../../shared/devtools-snapshot.js'

interface StoredEvent {
  readonly id: string
  readonly tabId: number
  readonly frameId: number
  readonly bridgeId?: string
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
const maxPendingMessagesPerTab = 32
const maxMessagesPerSecond = 100
const panels = new Set<PanelState>()
const nextSequences = new Map<number, number>()
const eventCounts = new Map<number, number>()
const eventQueues = new Map<number, Promise<void>>()
const pendingMessages = new Map<number, number>()
const messageRates = new Map<number, { startedAt: number, count: number }>()

function enqueue<T>(tabId: number, action: () => Promise<T>): Promise<T> {
  const previous = eventQueues.get(tabId) ?? Promise.resolve()
  const task = previous.then(action)
  const settled = task.then(() => undefined, () => undefined)
  eventQueues.set(tabId, settled)
  return task
}

function validSize(value: unknown): boolean {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length <= maxMessageBytes
  }
  catch {
    return false
  }
}

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

async function replaceTabEvents(tabId: number, events: StoredEvent[]): Promise<void> {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(eventStoreName, 'readwrite')
    const store = transaction.objectStore(eventStoreName)
    const request = store.index('tabId').openCursor(IDBKeyRange.only(tabId))
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
      else {
        for (const event of events)
          store.put(event)
      }
    }
    transaction.oncomplete = () => resolve()
    transaction.addEventListener('error', () => reject(transaction.error))
  })
  database.close()
}

async function trimTabEvents(tabId: number): Promise<boolean> {
  const excess = (eventCounts.get(tabId) ?? 0) - maxEventsPerTab
  if (excess <= 0)
    return false
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(eventStoreName, 'readwrite')
    const store = transaction.objectStore(eventStoreName)
    const request = store.index('tabSeq').openCursor(
      IDBKeyRange.bound([tabId, 0], [tabId, Number.MAX_SAFE_INTEGER]),
    )
    let removed = 0
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor || removed >= excess)
        return
      cursor.delete()
      removed += 1
      cursor.continue()
    }
    transaction.oncomplete = () => resolve()
    transaction.addEventListener('error', () => reject(transaction.error))
  })
  database.close()
  eventCounts.set(tabId, maxEventsPerTab)
  return true
}

function createEvent(tabId: number, frameId: number, payload: unknown): StoredEvent {
  const seq = (nextSequences.get(tabId) ?? 0) + 1
  nextSequences.set(tabId, seq)
  const envelope = payload && typeof payload === 'object' && 'payload' in payload
    ? payload as { payload: unknown, request?: unknown, trace?: unknown, bridgeId?: string }
    : undefined
  const bridgeId = payload && typeof payload === 'object' && 'bridgeId' in payload
    && typeof payload.bridgeId === 'string'
    ? payload.bridgeId
    : undefined
  return {
    id: crypto.randomUUID(),
    tabId,
    frameId,
    bridgeId,
    seq,
    timestamp: Date.now(),
    payload: envelope?.payload ?? payload,
    request: envelope?.request,
    trace: envelope?.trace as StoredEvent['trace'],
  }
}

function sendToTab(tabId: number, message: unknown): void {
  for (const panel of panels) {
    if (panel.tabId === tabId) {
      try {
        panel.port.postMessage(message)
      }
      catch {
        panels.delete(panel)
      }
    }
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'devtools-panel')
    return
  const panel: PanelState = { port }
  panels.add(panel)
  port.onMessage.addListener((message: unknown) => {
    if (!message || typeof message !== 'object' || !('type' in message))
      return

    if (message.type === 'devtools-panel-ready') {
      if (!('tabId' in message) || typeof message.tabId !== 'number'
        || !Number.isInteger(message.tabId) || message.tabId < 0) {
        return
      }
      panel.tabId = message.tabId as number
      enqueue(panel.tabId, async () => {
        const events = await readEvents(panel.tabId!)
        if (panels.has(panel))
          port.postMessage({ type: 'devtools-history', events })
      }).catch((error: unknown) => console.error('Failed to read DevTools event history', error))
    }
    else if (message.type === 'devtools-panel-clear' && panel.tabId !== undefined) {
      queueHistoryReplacement(panel.tabId, []).catch((error: unknown) =>
        console.error('Failed to clear DevTools event history', error))
    }
  })
  port.onDisconnect.addListener(() => panels.delete(panel))
})

function queueEvent(tabId: number, frameId: number, payload: unknown): Promise<void> {
  return enqueue(tabId, async () => {
    if (!nextSequences.has(tabId)) {
      const events = await readEvents(tabId)
      nextSequences.set(tabId, events.at(-1)?.seq ?? 0)
      eventCounts.set(tabId, events.length)
    }
    const event = createEvent(tabId, frameId, payload)
    await persistEvent(event)
    eventCounts.set(tabId, (eventCounts.get(tabId) ?? 0) + 1)
    const trimmed = await trimTabEvents(tabId)
    if (trimmed)
      sendToTab(tabId, { type: 'devtools-history', events: await readEvents(tabId) })
    else
      sendToTab(event.tabId, { type: 'devtools-event', event })
  })
}

function queueHistoryReplacement(
  tabId: number,
  payloads: unknown[],
  preserveRealtime = false,
): Promise<void> {
  return enqueue(tabId, async () => {
    // The web app loads its local history asynchronously. A user can emit
    // live events before that snapshot arrives; replacing the tab history
    // here would erase those events from the panel. Keep the events already
    // persisted by this service worker and let the panel replay them.
    if (preserveRealtime) {
      const current = await readEvents(tabId)
      if (current.length) {
        const snapshotIds = new Set(payloads.flatMap((payload) => {
          if (payload && typeof payload === 'object' && 'bridgeId' in payload
            && typeof payload.bridgeId === 'string') {
            return [payload.bridgeId]
          }
          return []
        }))
        payloads = [...payloads, ...current
          .filter(event => !event.bridgeId || !snapshotIds.has(event.bridgeId))
          .map(event => ({
            payload: event.payload,
            request: event.request,
            trace: event.trace,
            bridgeId: event.bridgeId,
            frameId: event.frameId,
          }))]
      }
    }
    nextSequences.set(tabId, 0)
    const events: StoredEvent[] = []
    for (const payload of payloads) {
      const frameId = payload && typeof payload === 'object' && 'frameId' in payload
        && typeof payload.frameId === 'number'
        ? payload.frameId
        : 0
      const event = createEvent(tabId, frameId, payload)
      events.push(event)
    }
    const retained = events.slice(-maxEventsPerTab)
    try {
      await replaceTabEvents(tabId, retained)
    }
    catch (error) {
      nextSequences.delete(tabId)
      eventCounts.delete(tabId)
      throw error
    }
    eventCounts.set(tabId, retained.length)
    sendToTab(tabId, { type: 'devtools-history', events: retained })
  })
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (
    !message
    || typeof message !== 'object'
    || !('type' in message)
    || !('source' in message)
    || message.source !== 'trace-script-extension'
    || typeof sender.tab?.id !== 'number'
  ) {
    return
  }

  const tabId = sender.tab.id
  const pending = pendingMessages.get(tabId) ?? 0
  if (pending >= maxPendingMessagesPerTab) {
    sendResponse({ ok: false })
    return
  }
  let action: () => Promise<void>
  if (message.type === 'devtools-init') {
    if (sender.frameId !== 0 || !('payload' in message)
      || !Array.isArray(message.payload)) {
      sendResponse({ ok: false })
      return
    }
    action = () => queueHistoryReplacement(tabId, limitDevToolsSnapshot(message.payload), true)
  }
  else if (message.type === 'devtools-clear') {
    if (sender.frameId !== 0) {
      sendResponse({ ok: false })
      return
    }
    action = () => queueHistoryReplacement(tabId, [])
  }
  else if (message.type === 'devtools-event') {
    if (!('payload' in message) || !validSize(message)) {
      sendResponse({ ok: false })
      return
    }
    action = () => queueEvent(tabId, sender.frameId ?? 0, message.payload)
  }
  else {
    return
  }

  const now = Date.now()
  const rate = messageRates.get(tabId)
  if (rate && now - rate.startedAt < 1000) {
    if (rate.count >= maxMessagesPerSecond) {
      sendResponse({ ok: false })
      return
    }
    rate.count += 1
  }
  else {
    messageRates.set(tabId, { startedAt: now, count: 1 })
  }
  pendingMessages.set(tabId, pending + 1)
  const task = action()
  task.then(
    () => {
      pendingMessages.set(tabId, (pendingMessages.get(tabId) ?? 1) - 1)
      sendResponse({ ok: true })
    },
    (error: unknown) => {
      pendingMessages.set(tabId, (pendingMessages.get(tabId) ?? 1) - 1)
      console.error('Failed to persist DevTools message', error)
      sendResponse({ ok: false })
    },
  )
  return true
})

chrome.tabs.onRemoved.addListener((tabId) => {
  const task = enqueue(tabId, async () => {
    await deleteTabEvents(tabId)
    nextSequences.delete(tabId)
    eventCounts.delete(tabId)
    pendingMessages.delete(tabId)
    messageRates.delete(tabId)
  })
  const settled = eventQueues.get(tabId)
  task.then(
    () => {
      if (eventQueues.get(tabId) === settled)
        eventQueues.delete(tabId)
    },
    (error: unknown) => console.error('Failed to delete closed tab events', error),
  )
})
