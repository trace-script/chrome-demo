// `devtools.html` is also served by Vite during local development, where the
// Chrome DevTools API is not available.
if (typeof chrome !== 'undefined' && chrome.devtools) {
  chrome.devtools.panels.create('Agent Trace', '', 'panel.html')
}
