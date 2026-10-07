export const maxEventsPerTab: number = 2000
export const maxMessageBytes: number = 1024 * 1024

/** Keep the newest records that fit in one extension initialization message. */
export function limitDevToolsSnapshot<T>(events: readonly T[]): T[] {
  const encoder = new TextEncoder()
  let bytes = encoder.encode(JSON.stringify({
    source: 'trace-script-extension',
    type: 'devtools-init',
    payload: [],
  })).length
  const selected: T[] = []

  for (let index = events.length - 1; index >= 0 && selected.length < maxEventsPerTab; index--) {
    let serialized: string | undefined
    try {
      serialized = JSON.stringify(events[index])
    }
    catch {
      continue
    }
    if (serialized === undefined)
      continue

    const cost = encoder.encode(serialized).length + (selected.length ? 1 : 0)
    if (bytes + cost > maxMessageBytes)
      continue
    bytes += cost
    selected.push(events[index]!)
  }

  return selected.reverse()
}
