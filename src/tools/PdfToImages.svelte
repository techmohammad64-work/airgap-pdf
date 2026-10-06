<script lang="ts">
  import ToolShell from '../ui/ToolShell.svelte'
  import Thumb from '../ui/Thumb.svelte'
  import Icon from '../ui/Icon.svelte'
  import { run } from '../worker/client'
  import { closePdf, confirmLarge, loadPdfFile, type PdfFile } from '../lib/pdfFile'
  import { baseName, errorMessage } from '../lib/files'
  import { canvasToBytes, renderPage } from '../render/pdfjs'
  import { formatRanges, parsePageSet } from '../core/ranges'
  import type { ToolResult } from '../lib/types'
  import type { ToolPage } from '../lib/site'

  let { page: _page }: { page: ToolPage } = $props()

  type Format = 'png' | 'jpg'

  const DPIS = [72, 150, 300] as const
  /** Browsers refuse canvases much larger than this, so very large pages are scaled down. */
  const MAX_SIDE = 16000
  const MAX_AREA = 100_000_000
  const SLOW_PAGES = 20

  let file = $state<PdfFile | null>(null)
  let format = $state<Format>('png')
  let quality = $state(90)
  let dpi = $state<number>(150)
  let which = $state<'all' | 'range'>('all')
  let rangeText = $state('')
  let firstSize = $state<[number, number] | null>(null)
  let progress = $state({ done: 0, total: 0 })
  let loading = $state(false)
  let busy = $state(false)
  let error = $state('')
  let result = $state<ToolResult | null>(null)

  const total = $derived(file?.pageCount ?? 0)

  const chosen = $derived.by((): { pages: number[]; problem: string } => {
    if (!file) return { pages: [], problem: '' }
    if (which === 'all' || !rangeText.trim()) return { pages: Array.from({ length: total }, (_, i) => i), problem: '' }
    try {
      return { pages: parsePageSet(rangeText, total), problem: '' }
    } catch (e) {
      return { pages: [], problem: errorMessage(e) }
    }
  })
  const chosenSet = $derived(new Set(chosen.pages))
  const slow = $derived(dpi >= 300 && chosen.pages.length > SLOW_PAGES)
  const pixels = $derived(firstSize ? `${Math.round((firstSize[0] * dpi) / 72)} × ${Math.round((firstSize[1] * dpi) / 72)} px` : '')
  const busyText = $derived(progress.total > 1 ? `Rendering page ${progress.done + 1} of ${progress.total}…` : 'Rendering…')

  async function add(list: File[]) {
    if (!confirmLarge(list)) return
    error = ''
    loading = true
    try {
      const pf = await loadPdfFile(list[0])
      closePdf(file)
      file = pf
      const v = (await pf.doc.getPage(1)).getViewport({ scale: 1 })
      firstSize = [v.width, v.height]
    } catch (e) {
      error = `${list[0].name}: ${errorMessage(e)}`
    }
    loading = false
    result = null
  }

  function reset() {
    closePdf(file)
    file = null
    firstSize = null
    rangeText = ''
    which = 'all'
    result = null
    error = ''
  }

  async function convert() {
    error = ''
    if (!file) return
    if (chosen.problem) {
      error = chosen.problem
      return
    }
    const pages = chosen.pages
    if (!pages.length) {
      error = 'Choose at least one page.'
      return
    }
    const ext = format === 'png' ? 'png' : 'jpg'
    const type = format === 'png' ? 'image/png' : 'image/jpeg'
    const base = baseName(file.name)
    busy = true
    progress = { done: 0, total: pages.length }
    try {
      const out: { name: string; bytes: Uint8Array }[] = []
      for (const i of pages) {
        const pg = await file.doc.getPage(i + 1)
        const v = pg.getViewport({ scale: 1 })
        let scale = dpi / 72
        scale = Math.min(scale, MAX_SIDE / v.width, MAX_SIDE / v.height, Math.sqrt(MAX_AREA / (v.width * v.height)))
        const canvas = await renderPage(pg, scale)
        try {
          out.push({ name: `${base}-page-${i + 1}.${ext}`, bytes: await canvasToBytes(canvas, type, quality / 100) })
        } finally {
          // Release the bitmap right away; large renders add up fast.
          canvas.width = canvas.height = 0
          pg.cleanup()
        }
        progress.done++
      }
      if (out.length === 1) {
        result = { name: out[0].name, data: out[0].bytes, type, summary: `Page ${pages[0] + 1} · ${dpi} DPI ${ext.toUpperCase()}` }
      } else {
        const zip = await run('makeZip', out)
        result = { name: `${base}-images.zip`, data: zip, type: 'application/zip', summary: `${out.length} ${ext.toUpperCase()} images in a ZIP` }
      }
    } catch (e) {
      error = errorMessage(e)
    } finally {
      busy = false
      progress = { done: 0, total: 0 }
    }
  }
</script>

<ToolShell
  empty={!file}
  dropLabel="Drop a PDF file here"
  onfiles={add}
  {loading}
  {busy}
  {busyText}
  {error}
  {result}
  onreset={reset}
  oncontinue={() => (result = null)}
>
  {#snippet workspace()}
    {#if file}
      <div class="toolbar">
        <div class="fname">
          <Icon name="file" size={18} />
          <b title={file.name}>{file.name}</b>
          <span class="muted small">{total} {total === 1 ? 'page' : 'pages'}</span>
        </div>
        {#if busy && progress.total > 1}
          <div class="progress" role="progressbar" aria-label="Rendering progress" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
            <span style:width={`${(progress.done / progress.total) * 100}%`}></span>
          </div>
        {/if}
      </div>
      <ul class="grid" aria-label="Pages">
        {#each { length: total } as _, i (i)}
          <li class="card cell" class:out={!chosenSet.has(i)}>
            <Thumb doc={file.doc} page={i + 1} width={120} />
            <span class="small"><b>{i + 1}</b>{#if !chosenSet.has(i)}<span class="muted">{" · skipped"}</span>{/if}</span>
          </li>
        {/each}
      </ul>
    {/if}
  {/snippet}

  {#snippet options()}
    <div class="field">
      <span>Format</span>
      <div class="segmented" role="group" aria-label="Image format">
        <button aria-pressed={format === 'png'} onclick={() => (format = 'png')}>PNG</button>
        <button aria-pressed={format === 'jpg'} onclick={() => (format = 'jpg')}>JPG</button>
      </div>
      <span class="muted small hint">{format === 'png' ? 'Sharp and lossless. Larger files.' : 'Smaller files. Best for photos and scans.'}</span>
    </div>
    {#if format === 'jpg'}
      <label class="field">
        <span>Quality <span class="val">{quality}</span></span>
        <input type="range" min="50" max="100" step="1" bind:value={quality} />
      </label>
    {/if}
    <div class="field">
      <span>Resolution</span>
      <div class="segmented" role="group" aria-label="Resolution">
        {#each DPIS as d (d)}
          <button aria-pressed={dpi === d} onclick={() => (dpi = d)}>{d} DPI</button>
        {/each}
      </div>
      {#if pixels}<span class="muted small hint">Page 1 will be {pixels}.</span>{/if}
    </div>
    <div class="field">
      <span>Pages</span>
      <div class="segmented" role="group" aria-label="Pages to convert">
        <button aria-pressed={which === 'all'} onclick={() => (which = 'all')}>All pages</button>
        <button aria-pressed={which === 'range'} onclick={() => (which = 'range')}>Choose pages</button>
      </div>
      {#if which === 'range'}
        <input class="input" bind:value={rangeText} placeholder="1-3, 5" autocomplete="off" aria-label="Pages to convert" data-testid="pages" />
        {#if chosen.problem}
          <span class="small err">{chosen.problem}</span>
        {:else}
          <span class="muted small hint">{chosen.pages.length} {chosen.pages.length === 1 ? 'page' : 'pages'}: {formatRanges(chosen.pages)}</span>
        {/if}
      {/if}
    </div>
    {#if slow}
      <p class="notice notice-warn small"><Icon name="alert" size={16} /> <span>300 DPI on {chosen.pages.length} pages can be slow and use a lot of memory. Try 150 DPI if your device struggles.</span></p>
    {/if}
  {/snippet}

  {#snippet actions()}
    <button class="btn btn-primary btn-lg" onclick={convert} data-testid="run">
      <Icon name="image" size={18} />
      {chosen.pages.length === 1 ? `Convert to ${format.toUpperCase()}` : `Convert ${chosen.pages.length} pages to ${format.toUpperCase()}`}
    </button>
  {/snippet}
</ToolShell>

<style>
  .toolbar {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .fname {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
  }
  .fname b {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .progress {
    flex: 1;
    min-width: 140px;
    max-width: 280px;
    height: 8px;
    border-radius: 999px;
    background: var(--surface-2);
    overflow: hidden;
  }
  .progress span {
    display: block;
    height: 100%;
    background: var(--primary);
    transition: width 0.2s;
  }
  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 14px;
  }
  .cell {
    display: grid;
    gap: 6px;
    padding: 8px;
    transition: opacity 0.15s;
  }
  .cell.out {
    opacity: 0.4;
  }
  .hint {
    font-weight: 400;
  }
  .err {
    color: var(--danger);
    font-weight: 400;
  }
  .val {
    float: right;
    color: var(--text);
  }
  .notice {
    margin: 0;
  }
</style>
