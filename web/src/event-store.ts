import type { RoleMessage } from './index.js'

export interface StoredEvent extends RoleMessage {
  readonly source?: string
  readonly eventId?: string
  readonly createdAt: number
}

const databaseName = 'mugeda-agent'
const storeName = 'events'
const databaseVersion = 1

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion)
    request.addEventListener('upgradeneeded', (): void => {
      request.result.createObjectStore(storeName, {
        keyPath: 'id',
        autoIncrement: true,
      })
    })
    request.addEventListener('success', (): void => resolve(request.result))
    request.addEventListener('error', (): void => reject(request.error))
  })
}

export async function persistEvent(data: RoleMessage): Promise<void> {
  if (typeof indexedDB === 'undefined') return

  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).add({
      ...data,
      createdAt: Date.now(),
    })
    transaction.addEventListener('complete', (): void => resolve())
    transaction.addEventListener('error', (): void => reject(transaction.error))
    transaction.addEventListener('abort', (): void => reject(transaction.error))
  })
  database.close()
}

export async function loadEvents(): Promise<StoredEvent[]> {
  if (typeof indexedDB === 'undefined') return []

  const database = await openDatabase()
  const events = await new Promise<StoredEvent[]>((resolve, reject) => {
    const request = database
      .transaction(storeName, 'readonly')
      .objectStore(storeName)
      .getAll()
    request.addEventListener('success', (): void =>
      resolve(request.result as StoredEvent[]),
    )
    request.addEventListener('error', (): void => reject(request.error))
  })
  database.close()
  return events
}

export async function clearEvents(): Promise<void> {
  if (typeof indexedDB === 'undefined') return

  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).clear()
    transaction.addEventListener('complete', (): void => resolve())
    transaction.addEventListener('error', (): void => reject(transaction.error))
    transaction.addEventListener('abort', (): void => reject(transaction.error))
  })
  database.close()
}
