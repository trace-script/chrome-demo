// Plain content-script entry. It must not contain imports: Chrome executes
// content scripts as classic scripts, not as ES modules.
window.addEventListener('message', (event) => {
  const data: unknown = event.data
  if (
    !data ||
    typeof data !== 'object' ||
    !('type' in data) ||
    (data.type !== 'devtools-event' &&
      data.type !== 'devtools-init' &&
      data.type !== 'devtools-clear')
  )
    return

  // The page and this content script share the DOM window, but run in
  // different JavaScript worlds. `event.source` is therefore not reliable
  // across browsers; the message shape is the contract we validate here.
  const runtime = globalThis.chrome?.runtime
  const sendMessage = runtime?.sendMessage as
    ((message: unknown) => Promise<unknown>) | undefined
  if (typeof sendMessage !== 'function') return

  try {
    // An extension reload invalidates existing content-script contexts. Do not
    // let that rejected message escape into the page's window.postMessage call.
    sendMessage.call(runtime, data).catch(() => undefined)
  } catch {
    // The page must keep working while Chrome replaces the old content script.
  }
})
