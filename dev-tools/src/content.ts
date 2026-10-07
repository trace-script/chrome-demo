// Plain content-script entry. It must not contain imports: Chrome executes
// content scripts as classic scripts, not as ES modules.
window.addEventListener('message', (event) => {
  if (event.source !== window)
    return
  const data: unknown = event.data
  if (
    !data
    || typeof data !== 'object'
    || !('type' in data)
    || !('source' in data)
    || data.source !== 'trace-script-extension'
    || (data.type !== 'devtools-event'
      && data.type !== 'devtools-init'
      && data.type !== 'devtools-clear')
  ) {
    return
  }

  // Page scripts can send this message too. The source field prevents accidental
  // collisions; event.source rejects messages sent from another frame.
  const runtime = globalThis.chrome?.runtime
  const sendMessage = runtime?.sendMessage as
    ((message: unknown) => Promise<unknown>) | undefined
  if (typeof sendMessage !== 'function')
    return

  try {
    // An extension reload invalidates existing content-script contexts. Do not
    // let that rejected message escape into the page's window.postMessage call.
    sendMessage.call(runtime, data).then((response) => {
      if (response && typeof response === 'object' && 'ok' in response && !response.ok)
        console.warn('Trace event was not saved by the extension')
    }).catch(() => undefined)
  }
  catch {
    // The page must keep working while Chrome replaces the old content script.
  }
})
