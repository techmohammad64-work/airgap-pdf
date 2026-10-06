export interface ToolResult {
  name: string
  data: Uint8Array | Blob
  type?: string
  /** One-line description, e.g. "18 pages · 3 files merged". */
  summary?: string
}
