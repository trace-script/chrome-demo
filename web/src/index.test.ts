import { expect, it, vi } from 'vitest'
import { sendDevToolsInit } from './index.js'

it('sends only the newest history that fits in an initialization message', () => {
  const postMessage = vi.fn()
  vi.stubGlobal('window', { postMessage })
  const events = Array.from({ length: 2500 }, (_, index) => ({ role: 'assistant', message: String(index) }))
  sendDevToolsInit(events)

  const [message] = postMessage.mock.calls[0]!
  expect(message.payload).toHaveLength(2000)
  expect(message.payload[0].message).toBe('500')
  expect(message.payload.at(-1).message).toBe('2499')

  const largeEvents = Array.from({ length: 150 }, (_, index) => ({
    role: 'assistant',
    message: `${index}:${'x'.repeat(8192)}`,
  }))
  sendDevToolsInit(largeEvents)
  const [largeMessage] = postMessage.mock.calls[1]!
  expect(largeMessage.payload.length).toBeGreaterThan(0)
  expect(largeMessage.payload.length).toBeLessThan(150)
  expect(largeMessage.payload.at(-1).message).toBe(largeEvents.at(-1)?.message)
  expect(new TextEncoder().encode(JSON.stringify(largeMessage)).length).toBeLessThanOrEqual(1024 * 1024)
})
