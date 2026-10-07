import { expect, it, vi } from 'vitest'

it('forwards only namespaced messages from its own frame', async () => {
  vi.resetModules()
  let receive: (event: MessageEvent) => void = () => undefined
  const windowObject = {
    addEventListener: (_type: string, listener: typeof receive) => receive = listener,
  }
  const sendMessage = vi.fn().mockResolvedValue({ ok: true })
  vi.stubGlobal('window', windowObject)
  vi.stubGlobal('chrome', { runtime: { sendMessage } })
  await import('./content.js')

  const message = { source: 'trace-script-extension', type: 'devtools-clear' }
  receive({ source: {}, data: message } as MessageEvent)
  receive({ source: windowObject, data: { ...message, source: 'other' } } as unknown as MessageEvent)
  expect(sendMessage).not.toHaveBeenCalled()

  receive({ source: windowObject, data: message } as unknown as MessageEvent)
  expect(sendMessage).toHaveBeenCalledExactlyOnceWith(message)
})
