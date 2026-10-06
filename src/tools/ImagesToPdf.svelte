<script lang="ts">
  import { onDestroy } from 'svelte'
  import ToolShell from '../ui/ToolShell.svelte'
  import SortableGrid from '../ui/SortableGrid.svelte'
  import Dropzone from '../ui/Dropzone.svelte'
  import Icon from '../ui/Icon.svelte'
  import { run } from '../worker/client'
  import { confirmLarge, uid } from '../lib/pdfFile'
  import { baseName, errorMessage, imageBytes } from '../lib/files'
  import type { ImagesToPdfOptions, Orientation, PageSize } from '../core/images'
  import type { ToolResult } from '../lib/types'
  import type { ToolPage } from '../lib/site'

  let { page: _page }: { page: ToolPage } = $props()

  interface ImageItem {
    id: string
    file: File
    url: string
    /** Natural size in pixels, known once the preview has loaded. */
    w: number
    h: number
  }

  const SIZES: Record<Exclude<PageSize, 'fit'>, [number, number]> = { a4: [595.28, 841.89], letter: [612, 792] }

  let images = $state<ImageItem[]>([])
  let pageSize = $state<PageSize>('a4')
  let orientation = $state<Orientation>('auto')
  let margin = $state(0)
  let busy = $state(false)
  let error = $state('')
  let result = $state<ToolResult | null>(null)

  function add(list: File[]) {
    if (!confirmLarge(list)) return
    error = ''
    for (const file of list) images.push({ id: uid('img'), file, url: URL.createObjectURL(file), w: 0, h: 0 })
    result = null
  }

  function move(from: number, to: number) {
    const [it] = images.splice(from, 1)
    images.splice(to, 0, it)
  }

  function remove(id: string) {
    const it = images.find((x) => x.id === id)
    if (it) URL.revokeObjectURL(it.url)
    images = images.filter((x) => x.id !== id)
  }

  function reset() {
    images.forEach((x) => URL.revokeObjectURL(x.url))
    images = []
    result = null
    error = ''
  }

  onDestroy(() => images.forEach((x) => URL.revokeObjectURL(x.url)))

  function loaded(it: ImageItem, e: Event) {
    const img = e.currentTarget as HTMLImageElement
    it.w = img.naturalWidth
    it.h = img.naturalHeight
  }

  function broken(it: ImageItem) {
    error = `${it.file.name}: this image could not be opened. It may be damaged or in an unsupported format.`
  }

  /** Page size in points for a preview, matching core/images.ts. */
  function pageOf(it: ImageItem): [number, number] {
    const w = it.w || 3
    const h = it.h || 4
    if (pageSize === 'fit') return [w + 2 * margin, h + 2 * margin]
    const [a, b] = SIZES[pageSize]
    const landscape = orientation === 'landscape' || (orientation === 'auto' && w > h)
    return landscape ? [b, a] : [a, b]
  }

  async function convert() {
    error = ''
    if (!images.length) {
      error = 'Add at least one image.'
      return
    }
    busy = true
    try {
      const bytes: Uint8Array[] = []
      for (const it of images) {
        try {
          bytes.push((await imageBytes(it.file)).bytes)
        } catch {
          throw new Error(`${it.file.name}: this image could not be read. It may be damaged or in an unsupported format.`)
        }
      }
      const opts: ImagesToPdfOptions = { pageSize, orientation, margin }
      const pdf = await run('imagesToPdf', bytes, opts)
      const n = images.length
      result = {
        name: n === 1 ? `${baseName(images[0].file.name)}.pdf` : 'images.pdf',
        data: pdf,
        summary: `${n} ${n === 1 ? 'page' : 'pages'}`,
      }
    } catch (e) {
      error = errorMessage(e)
    } finally {
      busy = false
    }
  }
</script>

<ToolShell
  empty={!images.length}
  accept="image"
  multiple
  dropLabel="Drop images here"
  onfiles={add}
  {busy}
  busyText="Creating PDF…"
  {error}
  {result}
  onreset={reset}
  oncontinue={() => (result = null)}
>
  {#snippet workspace()}
    <div class="toolbar">
      <b>{images.length} {images.length === 1 ? 'image' : 'images'}</b>
      <span class="muted small">Drag to reorder. Each image becomes one page.</span>
    </div>
    <SortableGrid items={images} key={(x) => x.id} onmove={move} min={150} label="Images">
      {#snippet item(it, i)}
        {@const [pw, ph] = pageOf(it)}
        <div class="card cell">
          <div class="sheet" style:aspect-ratio={`${pw} / ${ph}`}>
            <div class="area" style:inset={`${(margin / ph) * 100}% ${(margin / pw) * 100}%`}>
              <img src={it.url} alt={it.file.name} draggable="false" onload={(e) => loaded(it, e)} onerror={() => broken(it)} />
            </div>
          </div>
          <div class="meta">
            <span class="small"><b>{i + 1}</b> <span class="muted" title={it.file.name}>· {it.file.name}</span></span>
          </div>
          <div class="btns">
            <button class="icon-btn" disabled={i === 0} onclick={() => move(i, i - 1)} aria-label={`Move ${it.file.name} earlier`}><Icon name="chevron-left" size={16} /></button>
            <button class="icon-btn" disabled={i === images.length - 1} onclick={() => move(i, i + 1)} aria-label={`Move ${it.file.name} later`}><Icon name="chevron-right" size={16} /></button>
            <button class="icon-btn danger" onclick={() => remove(it.id)} aria-label={`Remove ${it.file.name}`}><Icon name="trash" size={16} /></button>
          </div>
        </div>
      {/snippet}
    </SortableGrid>
    <div class="more"><Dropzone accept="image" multiple compact label="Add more images" onfiles={add} /></div>
  {/snippet}

  {#snippet options()}
    <div class="field">
      <span>Page size</span>
      <div class="segmented" role="group" aria-label="Page size">
        <button aria-pressed={pageSize === 'a4'} onclick={() => (pageSize = 'a4')}>A4</button>
        <button aria-pressed={pageSize === 'letter'} onclick={() => (pageSize = 'letter')}>Letter</button>
        <button aria-pressed={pageSize === 'fit'} onclick={() => (pageSize = 'fit')}>Fit to image</button>
      </div>
    </div>
    {#if pageSize !== 'fit'}
      <div class="field">
        <span>Orientation</span>
        <div class="segmented" role="group" aria-label="Orientation">
          <button aria-pressed={orientation === 'auto'} onclick={() => (orientation = 'auto')}>Auto</button>
          <button aria-pressed={orientation === 'portrait'} onclick={() => (orientation = 'portrait')}>Portrait</button>
          <button aria-pressed={orientation === 'landscape'} onclick={() => (orientation = 'landscape')}>Landscape</button>
        </div>
        {#if orientation === 'auto'}<span class="muted small hint">Wide images get landscape pages.</span>{/if}
      </div>
    {/if}
    <div class="field">
      <span>Margin</span>
      <div class="segmented" role="group" aria-label="Margin">
        <button aria-pressed={margin === 0} onclick={() => (margin = 0)}>None</button>
        <button aria-pressed={margin === 18} onclick={() => (margin = 18)}>Small</button>
        <button aria-pressed={margin === 36} onclick={() => (margin = 36)}>Large</button>
      </div>
    </div>
  {/snippet}

  {#snippet actions()}
    <button class="btn btn-primary btn-lg" onclick={convert} data-testid="run"><Icon name="file" size={18} /> Convert to PDF</button>
  {/snippet}
</ToolShell>

<style>
  .toolbar {
    display: flex;
    gap: 12px;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .cell {
    height: 100%;
    padding: 10px;
    display: grid;
    grid-template-rows: 1fr auto auto;
    align-items: center;
    gap: 8px;
  }
  .sheet {
    position: relative;
    width: 100%;
    margin: 0 auto;
    background: var(--page-bg);
    border-radius: 4px;
    box-shadow: 0 0 0 1px var(--border), var(--shadow-sm);
    overflow: hidden;
    transition: aspect-ratio 0.2s;
  }
  .area {
    position: absolute;
    display: grid;
    place-items: center;
    transition: inset 0.2s;
  }
  .area img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .meta {
    min-width: 0;
  }
  .meta > span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .btns {
    display: flex;
    gap: 6px;
  }
  .btns .danger {
    margin-left: auto;
  }
  .danger:hover {
    color: var(--danger);
  }
  .icon-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .hint {
    font-weight: 400;
  }
  .more {
    margin-top: 16px;
  }
</style>
