export const LARGE_FILE = 200 * 1024 * 1024

export async function readBytes(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer())
}

export function isPdf(file: File) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

export function isImage(file: File) {
  return file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.name)
}

export function baseName(name: string) {
  return name.replace(/\.[^.]+$/, '')
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** Saves bytes to the user's device. No network involved: a local object URL. */
export function download(bytes: Uint8Array | Blob, name: string, type = 'application/pdf') {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Converts any browser-decodable image to PNG bytes (for WebP, GIF, etc.). */
export async function imageToPng(file: Blob): Promise<Uint8Array> {
  const bmp = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bmp.width
  canvas.height = bmp.height
  canvas.getContext('2d')!.drawImage(bmp, 0, 0)
  bmp.close()
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) throw new Error('Could not convert image')
  return readBytes(blob)
}

/** Returns PNG/JPG bytes for an image file, converting other formats to PNG. */
export async function imageBytes(file: File): Promise<{ bytes: Uint8Array; format: 'png' | 'jpg' }> {
  const bytes = await readBytes(file)
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return { bytes, format: 'png' }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { bytes, format: 'jpg' }
  return { bytes: await imageToPng(file), format: 'png' }
}

export function errorMessage(e: unknown): string {
  const msg = (e as Error)?.message
  return msg || 'Something went wrong. Please try again.'
}
