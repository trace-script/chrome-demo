import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'

interface TestEvent {
  id: string
  tabId: number
  frameId: number
  bridgeId?: string
  seq: number
  payload: { message: string }
}

type MessageListener = (
  message: unknown,
  sender: { tab: { id: number }, frameId: number },
  respond: (response: { ok: boolean }) => void,
) => boolean | void

let onMessage: MessageListener
let onConnect: (port: TestPort) => void
let onRemoved: (tabId: number) => void

interface TestPort {
  name: string
  postMessage: ReturnType<typeof vi.fn>
  onMessage: { addListener: (listener: (message: unknown) => void) => void }
  onDisconnect: { addListener: (listener: () => void) => void }
}

function panel() {
  let receive: (message: unknown) => void = () => undefined
  const port: TestPort = {
    name: 'devtools-panel',
    postMessage: vi.fn(),
    onMessage: { addListener: listener => receive = listener },
    onDisconnect: { addListener: () => undefined },
  }
  onConnect(port)
  return { port, send: (message: unknown) => receive(message) }
}

function send(type: string, payload?: unknown, frameId = 0): Promise<{ ok: boolean }> {
  return new Promise((resolve) => {
    onMessage(
      { source: 'trace-script-extension', type, payload },
      { tab: { id: 7 }, frameId },
      resolve,
    )
  })
}

async function readEvents(): Promise<TestEvent[]> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('mugeda-agent-events', 1)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  if (!database.objectStoreNames.contains('events')) {
    database.close()
    return []
  }
  const events = await new Promise<TestEvent[]>((resolve, reject) => {
    const request = database.transaction('events').objectStore('events').index('tabId').getAll(7)
    request.onsuccess = () => resolve(request.result as TestEvent[])
    request.onerror = () => reject(request.error)
  })
  database.close()
  return events.sort((a, b) => a.seq - b.seq)
}

beforeEach(async () => {
  vi.resetModules()
  vi.stubGlobal('indexedDB', new IDBFactory())
  vi.stubGlobal('IDBKeyRange', IDBKeyRange)
  vi.stubGlobal('chrome', {
    runtime: {
      onMessage: { addListener: (listener: MessageListener) => onMessage = listener },
      onConnect: { addListener: (listener: typeof onConnect) => onConnect = listener },
    },
    tabs: { onRemoved: { addListener: (listener: typeof onRemoved) => onRemoved = listener } },
  })
  await import('./background.js')
})

describe('extension background transport', () => {
  it('merges page history with already saved live events without duplicates', async () => {
    expect(await send('devtools-event', { message: 'live', bridgeId: 'live-1' })).toEqual({ ok: true })
    expect((await readEvents()).map(event => event.payload.message)).toEqual(['live'])

    expect(await send('devtools-init', [
      { message: 'old', bridgeId: 'old-1' },
      { message: 'live', bridgeId: 'live-1' },
    ])).toEqual({ ok: true })

    const events = await readEvents()
    expect(events.map(event => event.payload.message)).toEqual(['old', 'live'])
    expect(events.map(event => event.seq)).toEqual([1, 2])
  })

  it('sends initial history before events queued after panel readiness', async () => {
    const connection = panel()
    connection.send({ type: 'devtools-panel-ready', tabId: 7 })
    expect(await send('devtools-event', { message: 'live' })).toEqual({ ok: true })
    expect(connection.port.postMessage.mock.calls.map(([message]) => message.type))
      .toEqual(['devtools-history', 'devtools-event'])
  })

  it('allows iframe events but reserves tab clearing for the top frame', async () => {
    expect(await send('devtools-event', { message: 'iframe' }, 4)).toEqual({ ok: true })
    expect((await readEvents())[0]?.frameId).toBe(4)
    expect(await send('devtools-clear', undefined, 4)).toEqual({ ok: false })
    expect(await readEvents()).toHaveLength(1)
    expect(await send('devtools-clear')).toEqual({ ok: true })
    expect(await readEvents()).toHaveLength(0)
  })

  it('clears persisted history from the panel and after a pending write on tab close', async () => {
    const connection = panel()
    connection.send({ type: 'devtools-panel-ready', tabId: 7 })
    expect(await send('devtools-event', { message: 'first' })).toEqual({ ok: true })
    connection.send({ type: 'devtools-panel-clear' })
    await vi.waitFor(async () => expect(await readEvents()).toHaveLength(0))

    const pending = send('devtools-event', { message: 'second' })
    onRemoved(7)
    expect(await pending).toEqual({ ok: true })
    await vi.waitFor(async () => expect(await readEvents()).toHaveLength(0))
  })

  it('rejects oversized messages before writing to IndexedDB', async () => {
    expect(await send('devtools-event', { message: 'x'.repeat(1024 * 1024) }))
      .toEqual({ ok: false })
    expect(await readEvents()).toHaveLength(0)
  })

  it('keeps only the newest 2000 events per tab', async () => {
    const snapshot = Array.from({ length: 2500 }, (_, index) => ({ message: String(index) }))
    expect(await send('devtools-init', snapshot)).toEqual({ ok: true })
    expect(await send('devtools-event', { message: 'newest' })).toEqual({ ok: true })
    const events = await readEvents()
    expect(events).toHaveLength(2000)
    expect(events[0]?.payload.message).toBe('501')
    expect(events.at(-1)?.payload.message).toBe('newest')
  })

  it('restores the newest records from a snapshot larger than 1 MiB', async () => {
    const snapshot = Array.from({ length: 150 }, (_, index) => ({
      message: `${index}:${'x'.repeat(8192)}`,
    }))
    expect(await send('devtools-init', snapshot)).toEqual({ ok: true })
    const events = await readEvents()
    expect(events.length).toBeGreaterThan(0)
    expect(events.length).toBeLessThan(150)
    expect(events.at(-1)?.payload.message).toBe(snapshot.at(-1)?.message)
  })

  it('limits the number of pending page messages', async () => {
    const responses = await Promise.all(Array.from({ length: 33 }, (_, index) =>
      send('devtools-event', { message: String(index) })))
    expect(responses.filter(response => response.ok)).toHaveLength(32)
    expect(responses.filter(response => !response.ok)).toHaveLength(1)
    expect(await readEvents()).toHaveLength(32)
  })

  it('limits sustained messages from one tab', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000)
    try {
      for (let index = 0; index < 100; index++)
        expect(await send('devtools-event', { message: String(index) })).toEqual({ ok: true })
      expect(await send('devtools-event', { message: 'extra' })).toEqual({ ok: false })
      expect(await readEvents()).toHaveLength(100)
    }
    finally {
      clock.mockRestore()
    }
  })
})
