export interface WorkerRequest {
  id: number
  fn: string
  args: unknown[]
}

export type WorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: { message: string; code?: string } }
