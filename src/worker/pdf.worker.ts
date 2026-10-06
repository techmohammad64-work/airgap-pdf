/// <reference lib="webworker" />
// Runs core PDF operations off the main thread so large files never freeze the UI.
import * as core from '../core'
import type { WorkerRequest, WorkerResponse } from './protocol'

const api = {
  pageCount: core.pageCount,
  assemble: core.assemble,
  merge: core.merge,
  split: core.split,
  imagesToPdf: core.imagesToPdf,
  applyOverlays: core.applyOverlays,
  watermark: core.watermark,
  addPageNumbers: core.addPageNumbers,
  listFields: core.listFields,
  fillForm: core.fillForm,
  replacePagesWithImages: core.replacePagesWithImages,
  makeZip: core.makeZip,
}
export type WorkerApi = typeof api

function transferables(value: unknown, out: Transferable[] = []): Transferable[] {
  if (value instanceof Uint8Array) out.push(value.buffer)
  else if (Array.isArray(value)) value.forEach((v) => transferables(v, out))
  return out
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, fn, args } = e.data
  try {
    const result = await (api[fn as keyof WorkerApi] as (...a: unknown[]) => unknown)(...args)
    const msg: WorkerResponse = { id, ok: true, result }
    ;(self as unknown as Worker).postMessage(msg, [...new Set(transferables(result))])
  } catch (err) {
    const error = err as Error & { code?: string }
    const msg: WorkerResponse = { id, ok: false, error: { message: error?.message ?? String(err), code: error?.code } }
    ;(self as unknown as Worker).postMessage(msg)
  }
}
