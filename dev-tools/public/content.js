// Plain content-script entry. It must not contain imports: Chrome executes
// content scripts as classic scripts, not as ES modules.
window.addEventListener('message', (event) => {
  if (event.source !== globalThis || event.data?.type !== 'devtools-event')
    return
  globalThis.chrome?.runtime?.sendMessage(event.data)
})
