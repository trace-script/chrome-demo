import type { StoredEvent } from './types.js'

interface PanelStore {
  replaceEvents: (events: readonly StoredEvent[]) => void
  addEvent: (event: StoredEvent) => void
}

export function applyPanelMessage(message: unknown, liveUpdates: boolean, store: PanelStore): void {
  if (!message || typeof message !== 'object' || !('type' in message))
    return
  const value = message as { type: string, events?: StoredEvent[], event?: StoredEvent }

  if (value.type === 'devtools-history') {
    const events = value.events ?? []
    if (liveUpdates || events.length === 0)
      store.replaceEvents(events)
  }
  else if (liveUpdates && value.type === 'devtools-event' && value.event) {
    store.addEvent(value.event)
  }
}
