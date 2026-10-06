<script lang="ts">
  import ToolShell from '../ui/ToolShell.svelte'
  import PageEditor from '../ui/PageEditor.svelte'
  import EditorToolButton from '../ui/EditorToolButton.svelte'
  import Icon from '../ui/Icon.svelte'
  import { run } from '../worker/client'
  import { closePdf, confirmLarge, loadPdfFile, uid, type PdfFile } from '../lib/pdfFile'
  import { baseName, errorMessage } from '../lib/files'
  import { canvasToBytes, renderPage } from '../render/pdfjs'
  import type { EditorItem, Rect } from '../ui/EditorKit'
  import type { PageImage } from '../core/raster'
  import type { ToolResult } from '../lib/types'
  import type { ToolPage } from '../lib/site'

  let { page: _page }: { page: ToolPage } = $props()

  interface Box extends EditorItem {
    kind: 'box'
  }

  /** Redacted pages are rebuilt from a 200 DPI render. */
  const DPI = 200
  /** Below this many pixels a lossless PNG stays small enough. */
  const PNG_MAX_PIXELS = 1_000_000

  let file = $state<PdfFile | null>(null)
  let items = $state<Box[]>([])
  let selected = $state<string | null>(null)
  let drawing = $state(true)
  let loading = $state(false)
  let busy = $state(false)
  let progress = $state('')
  let error = $state('')
  let result = $state<ToolResult | null>(null)

  const pagesHit = $derived([...new Set(items.map((i) => i.page))].sort((a, b) => a - b))

  async function add(list: File[]) {
    if (!confirmLarge(list)) return
    error = ''
    loading = true
    try {
      file = await loadPdfFile(list[0])
    } catch (e) {
      error = `${list[0].name}: ${errorMessage(e)}`
    }
    loading = false
    result = null
  }

  function reset() {
    closePdf(file)
    file = null
    items = []
    selected = null
    drawing = true
    result = null
    error = ''
  }

  function create(page: number, r: Rect, dragged: boolean) {
    if (!dragged) {
      selected = null
      return
    }
    const b: Box = { id: uid('box'), kind: 'box', page, ...r, resize: 'free' }
    items.push(b)
    selected = b.id
    result = null
  }

  const whole = (p: { index: number; width: number; height: number }) =>
    items.some((i) => i.page === p.index && i.x <= 0.5 && i.y <= 0.5 && i.width >= p.width - 0.5 && i.height >= p.height - 0.5)

  function redactPage(p: { index: number; width: number; height: number }) {
    const b: Box = { id: uid('box'), kind: 'box', page: p.index, x: 0, y: 0, width: p.width, height: p.height, resize: 'free' }
    items = [...items.filter((i) => i.page !== p.index), b]
    selected = b.id
    result = null
  }

  function clearPage(index: number) {
    items = items.filter((i) => i.page !== index)
    selected = null
  }

  async function apply() {
    error = ''
    if (!file) return
    if (!items.length) {
      error = 'Draw at least one box over the content you want to remove.'
      return
    }
    busy = true
    try {
      const images: PageImage[] = []
      let n = 0
      for (const index of pagesHit) {
        progress = `Flattening page ${++n} of ${pagesHit.length}…`
        const pg = await file.doc.getPage(index + 1)
        const canvas = await renderPage(pg, DPI / 72)
        const vp = pg.getViewport({ scale: 1 })
        const kx = canvas.width / vp.width
        const ky = canvas.height / vp.height
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#000000'
        for (const b of items) {
          if (b.page !== index) continue
          // Snap outwards to whole pixels so no sliver of the original survives.
          const x0 = Math.floor(b.x * kx)
          const y0 = Math.floor(b.y * ky)
          ctx.fillRect(x0, y0, Math.ceil((b.x + b.width) * kx) - x0, Math.ceil((b.y + b.height) * ky) - y0)
        }
        const png = canvas.width * canvas.height <= PNG_MAX_PIXELS
        const bytes = await canvasToBytes(canvas, png ? 'image/png' : 'image/jpeg', 0.92)
        canvas.width = canvas.height = 0
        images.push({ index, bytes, format: png ? 'png' : 'jpg' })
      }
      progress = 'Rebuilding PDF…'
      const out = await run('replacePagesWithImages', file.bytes, images)
      const m = pagesHit.length
      result = {
        name: `${baseName(file.name)}-redacted.pdf`,
        data: out,
        summary: `${items.length} area${items.length === 1 ? '' : 's'} on ${m} page${m === 1 ? '' : 's'} removed`,
      }
    } catch (e) {
      error = errorMessage(e)
    } finally {
      busy = false
      progress = ''
    }
  }
</script>

<ToolShell
  empty={!file}
  dropLabel="Drop a PDF file to redact"
  onfiles={add}
  {loading}
  {busy}
  busyText={progress || 'Redacting…'}
  {error}
  {result}
  onreset={reset}
  oncontinue={() => (result = null)}
>
  {#snippet workspace()}
    {#if file}
      <PageEditor
        doc={file.doc}
        bind:items
        bind:selected
        create={drawing ? 'drag' : 'none'}
        hint={drawing ? 'Drag over anything you want to remove: text, images, signatures.' : 'Scroll and select boxes. Switch to Draw to add more.'}
        oncreate={create}
        ondelete={() => (result = null)}
        itemLabel={() => 'Redaction box'}
      >
        {#snippet toolbar()}
          <EditorToolButton icon="redact" label="Draw boxes" pressed={drawing} testid="tool-redact" onclick={() => (drawing = true)} />
          <EditorToolButton icon="grip" label="Select / scroll" pressed={!drawing} testid="tool-select" onclick={() => (drawing = false)} />
        {/snippet}
        {#snippet item(_it, ctx)}
          <div class="box" class:sel={ctx.selected}></div>
        {/snippet}
        {#snippet pageActions(p)}
          {#if whole(p)}
            <button class="btn btn-sm btn-ghost" onclick={() => clearPage(p.index)} data-testid={`clear-page-${p.index + 1}`}><Icon name="undo" size={14} /> Undo page redaction</button>
          {:else}
            <button class="btn btn-sm btn-ghost" onclick={() => redactPage(p)} data-testid={`redact-page-${p.index + 1}`}><Icon name="redact" size={14} /> Redact entire page</button>
          {/if}
        {/snippet}
      </PageEditor>
    {/if}
  {/snippet}

  {#snippet options()}
    <div>
      <p class="label">Summary</p>
      <p class="sum"><b>{items.length}</b> area{items.length === 1 ? '' : 's'} · <b>{pagesHit.length}</b> page{pagesHit.length === 1 ? '' : 's'}</p>
      {#if pagesHit.length}
        <p class="muted small">Pages {pagesHit.map((i) => i + 1).join(', ')}</p>
      {/if}
    </div>
    <p class="notice notice-warn small note" data-testid="redact-note">
      <Icon name="alert" size={18} />
      <span>Redacted pages become images: their text can no longer be selected or searched. Pages without redactions are unchanged.</span>
    </p>
    <p class="muted small">This is true redaction: covered content is permanently removed from the file, not just hidden. Document metadata is also dropped.</p>
  {/snippet}

  {#snippet actions()}
    <button class="btn btn-primary btn-lg" onclick={apply} data-testid="run"><Icon name="redact" size={18} /> Redact PDF</button>
  {/snippet}
</ToolShell>

<style>
  .box {
    width: 100%;
    height: 100%;
    background: rgb(0 0 0 / 82%);
    background-image: repeating-linear-gradient(-45deg, transparent 0 8px, rgb(255 255 255 / 7%) 8px 16px);
  }
  .box.sel {
    background-color: rgb(0 0 0 / 70%);
  }
  .label {
    margin: 0;
  }
  .sum {
    margin: 4px 0 4px;
    font-size: 16px;
  }
  .note {
    margin: 0;
  }
  .note :global(svg) {
    flex-shrink: 0;
    margin-top: 2px;
  }
</style>
