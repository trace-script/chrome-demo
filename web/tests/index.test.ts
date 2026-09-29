import { expect, test } from 'vitest'
import { sendDevToolsEvent } from '../src/index.ts'

test('sends an event through the extension bridge', async () => {
  const messages: unknown[] = []
  const originalWindow = globalThis.window
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { postMessage: (message: unknown): void => { messages.push(message) } } })
  sendDevToolsEvent({ role: 'user', message: 'clicked' })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
  expect(messages).toEqual([{ type: 'devtools-event', payload: { role: 'user', message: 'clicked' } }])
})
