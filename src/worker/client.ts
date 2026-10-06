import type { WorkerApi } from './pdf.worker'
import type { WorkerRequest, WorkerResponse } from './protocol'

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

export class WorkerError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const p = pending.get(e.data.id)
    if (!p) return
    pending.delete(e.data.id)
    if (e.data.ok) p.resolve(e.data.result)
    else p.reject(new WorkerError(e.data.error.message, e.data.error.code))
  }
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new WorkerError(e.message || 'The PDF engine crashed. The file may be too large for this device.'))
    pending.clear()
    worker?.terminate()
    worker = null
  }
  return worker
}

/**
 * Calls a core function in the worker. Input byte arrays are copied (not
 * transferred) so callers can keep using their originals.
 */
export function run<K extends keyof WorkerApi>(fn: K, ...args: Parameters<WorkerApi[K]>): Promise<Awaited<ReturnType<WorkerApi[K]>>> {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
    const msg: WorkerRequest = { id, fn, args }
    getWorker().postMessage(msg)
  })
}
