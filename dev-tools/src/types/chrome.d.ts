declare namespace chrome {
  namespace runtime {
    const onConnect: { addListener(listener: (port: Port) => void): void }
    const onMessage: { addListener(listener: (message: unknown) => void): void }
    function connect(options: { name: string }): Port
    function sendMessage(message: unknown): void
  }

  namespace devtools {
    const panels: { create(title: string, icon: string, page: string): void }
  }

  interface Port {
    readonly name: string
    readonly onMessage: { addListener(listener: (message: unknown) => void): void }
    readonly onDisconnect: { addListener(listener: () => void): void }
    postMessage(message: unknown): void
  }
}
