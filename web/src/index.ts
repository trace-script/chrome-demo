export interface RoleMessage {
  readonly role: string
  readonly message: string
}

export function sendDevToolsEvent(data: RoleMessage): void {
  window.postMessage({ type: 'devtools-event', payload: data }, '*')
}
export function reportClick(element: Element): () => void {
  const handler = (event: Event): void => {
    const target = event.target instanceof Element ? event.target : element
    sendDevToolsEvent({ role: 'user', message: `点击了 ${target.tagName}` })
  }
  element.addEventListener('click', handler)
  return () => element.removeEventListener('click', handler)
}
