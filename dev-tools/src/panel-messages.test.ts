import { expect, it } from 'vitest'
import { applyPanelMessage } from './panel-messages.js'
import { useTraceStore } from './use-trace-store.js'

it('clears visible events while live updates are paused', () => {
  const store = useTraceStore()
  const event = { id: 'one', tabId: 7, seq: 1, timestamp: 1, payload: { message: 'one' } }
  store.addEvent(event)

  applyPanelMessage({ type: 'devtools-event', event: { ...event, id: 'two' } }, false, store)
  applyPanelMessage({ type: 'devtools-history', events: [event] }, false, store)
  expect(store.events.value).toHaveLength(1)

  applyPanelMessage({ type: 'devtools-history', events: [] }, false, store)
  expect(store.events.value).toHaveLength(0)

  applyPanelMessage({ type: 'devtools-event', event }, true, store)
  expect(store.events.value).toHaveLength(1)
})
