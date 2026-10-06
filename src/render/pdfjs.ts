// Thin wrapper around pdf.js for rendering pages. All assets (worker, fonts,
// cmaps, wasm decoders) are served from our own origin.
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
const BASE = import.meta.env.BASE_URL

export type { PDFDocumentProxy, PDFPageProxy }

export class RenderError extends Error {
  code: 'encrypted' | 'invalid'
  constructor(code: 'encrypted' | 'invalid') {
    super(
      code === 'encrypted'
        ? 'This PDF is password-protected. Locked PDFs are not supported yet.'
        : 'This file could not be read as a PDF. It may be damaged or not a PDF at all.',
    )
    this.code = code
  }
}

export async function openPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  try {
    // pdf.js takes ownership of the buffer it is given, so hand it a copy.
    return await pdfjs.getDocument({
      data: bytes.slice(),
      cMapUrl: `${BASE}pdfjs/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${BASE}pdfjs/standard_fonts/`,
      wasmUrl: `${BASE}pdfjs/wasm/`,
      iccUrl: `${BASE}pdfjs/iccs/`,
      isEvalSupported: false,
      enableXfa: false,
      password: '',
    } as Parameters<typeof pdfjs.getDocument>[0]).promise
  } catch (e) {
    const name = (e as Error)?.name
    if (name === 'PasswordException') throw new RenderError('encrypted')
    throw new RenderError('invalid')
  }
}

/** Renders a page into a new canvas at the given scale (1 = 72 DPI). */
export async function renderPage(page: PDFPageProxy, scale: number, background = '#ffffff'): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = background
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvas, canvasContext: ctx, viewport } as Parameters<PDFPageProxy['render']>[0]).promise
  return canvas
}

export function canvasToBytes(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg', quality = 0.92): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      async (blob) => (blob ? resolve(new Uint8Array(await blob.arrayBuffer())) : reject(new Error('Could not encode image'))),
      type,
      quality,
    ),
  )
}

/** Visual page size in points (rotation applied), matching core/geometry.ts. */
export function pageSize(page: PDFPageProxy): { width: number; height: number } {
  const v = page.getViewport({ scale: 1 })
  return { width: v.width, height: v.height }
}

/** Renders a small thumbnail and returns an object URL for an <img>. */
export async function thumbnailUrl(page: PDFPageProxy, width = 180): Promise<string> {
  const scale = (width * (window.devicePixelRatio || 1)) / page.getViewport({ scale: 1 }).width
  const canvas = await renderPage(page, scale)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.8))
  canvas.width = canvas.height = 0
  return blob ? URL.createObjectURL(blob) : ''
}
