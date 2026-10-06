import { zipSync } from 'fflate'

/** Builds a ZIP from name -> bytes. PDFs and images are stored without recompression. */
export function makeZip(files: { name: string; bytes: Uint8Array }[]): Uint8Array {
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {}
  const used = new Set<string>()
  for (const f of files) {
    let name = f.name
    for (let n = 2; used.has(name); n++) name = f.name.replace(/(\.[^.]+)?$/, ` (${n})$1`)
    used.add(name)
    entries[name] = [f.bytes, { level: 0 }]
  }
  return zipSync(entries)
}
