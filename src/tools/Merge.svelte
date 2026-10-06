<script lang="ts">
  import ToolShell from '../ui/ToolShell.svelte'
  import SortableGrid from '../ui/SortableGrid.svelte'
  import Thumb from '../ui/Thumb.svelte'
  import Dropzone from '../ui/Dropzone.svelte'
  import Icon from '../ui/Icon.svelte'
  import { run } from '../worker/client'
  import { closePdf, confirmLarge, loadPdfFile, uid, type PdfFile } from '../lib/pdfFile'
  import { baseName, errorMessage } from '../lib/files'
  import type { ToolResult } from '../lib/types'
  import type { PageRef } from '../core/assemble'
  import type { ToolPage } from '../lib/site'

  let { page: _page }: { page: ToolPage } = $props()

  interface PageItem {
    id: string
    file: string
    index: number
  }

  const COLORS = ['#1f5eff', '#0e7a55', '#c4321f', '#a35a00', '#7a3fd1', '#0b7d8c', '#b8327a', '#4a5568']

  let files = $state<PdfFile[]>([])
  let pages = $state<PageItem[]>([])
  let view = $state<'files' | 'pages'>('files')
  let loading = $state(false)
  let busy = $state(false)
  let error = $state('')
  let result = $state<ToolResult | null>(null)

  const fileById = (id: string) => files.find((f) => f.id === id)!
  const colorOf = (id: string) => COLORS[files.findIndex((f) => f.id === id) % COLORS.length]
  const totalPages = $derived(pages.length)

  async function add(list: File[]) {
    if (!confirmLarge(list)) return
    error = ''
    loading = true
    for (const f of list) {
      try {
        const pf = await loadPdfFile(f)
        files.push(pf)
        for (let i = 0; i < pf.pageCount; i++) pages.push({ id: uid('pg'), file: pf.id, index: i })
      } catch (e) {
        error = `${f.name}: ${errorMessage(e)}`
      }
    }
    loading = false
    result = null
  }

  function moveFile(from: number, to: number) {
    const [f] = files.splice(from, 1)
    files.splice(to, 0, f)
    // Regroup pages by the new file order, keeping each file's own page order.
    const order = files.map((x) => x.id)
    pages = [...pages].sort((a, b) => order.indexOf(a.file) - order.indexOf(b.file))
  }

  function movePage(from: number, to: number) {
    const [p] = pages.splice(from, 1)
    pages.splice(to, 0, p)
  }

  function removeFile(id: string) {
    closePdf(fileById(id))
    files = files.filter((f) => f.id !== id)
    pages = pages.filter((p) => p.file !== id)
  }

  function removePage(id: string) {
    pages = pages.filter((p) => p.id !== id)
  }

  function reset() {
    files.forEach(closePdf)
    files = []
    pages = []
    result = null
    error = ''
  }

  async function merge() {
    error = ''
    if (files.length < 2 && view === 'files') {
      error = 'Add at least two PDF files to merge.'
      return
    }
    if (!pages.length) {
      error = 'There are no pages left to merge.'
      return
    }
    busy = true
    try {
      const idx = new Map(files.map((f, i) => [f.id, i]))
      const refs: PageRef[] = pages.map((p) => ({ kind: 'page', file: idx.get(p.file)!, index: p.index }))
      const bytes = await run(
        'assemble',
        files.map((f) => f.bytes),
        refs,
      )
      result = {
        name: `${baseName(files[0].name)}-merged.pdf`,
        data: bytes,
        summary: `${refs.length} pages from ${new Set(pages.map((p) => p.file)).size} files`,
      }
    } catch (e) {
      error = errorMessage(e)
    } finally {
      busy = false
    }
  }
</script>

<ToolShell
  empty={!files.length}
  multiple
  dropLabel="Drop PDF files here"
  onfiles={add}
  {loading}
  {busy}
  busyText="Merging…"
  {error}
  {result}
  onreset={reset}
  oncontinue={() => (result = null)}
>
  {#snippet workspace()}
    <div class="toolbar">
      <div class="segmented" role="group" aria-label="View">
        <button aria-pressed={view === 'files'} onclick={() => (view = 'files')}>Files ({files.length})</button>
        <button aria-pressed={view === 'pages'} onclick={() => (view = 'pages')}>Pages ({totalPages})</button>
      </div>
      <span class="muted small">Drag to reorder</span>
    </div>

    {#if view === 'files'}
      <SortableGrid items={files} key={(f) => f.id} onmove={moveFile} min={170} label="Files">
        {#snippet item(f, i)}
          <div class="card cell" style:--c={colorOf(f.id)}>
            <Thumb doc={f.doc} page={1} width={170} />
            <div class="meta">
              <b title={f.name}>{f.name}</b>
              <span class="muted small">{pages.filter((p) => p.file === f.id).length} of {f.pageCount} pages</span>
            </div>
            <div class="btns">
              <button class="icon-btn" disabled={i === 0} onclick={() => moveFile(i, i - 1)} aria-label={`Move ${f.name} earlier`}><Icon name="chevron-left" size={16} /></button>
              <button class="icon-btn" disabled={i === files.length - 1} onclick={() => moveFile(i, i + 1)} aria-label={`Move ${f.name} later`}><Icon name="chevron-right" size={16} /></button>
              <button class="icon-btn danger" onclick={() => removeFile(f.id)} aria-label={`Remove ${f.name}`}><Icon name="trash" size={16} /></button>
            </div>
          </div>
        {/snippet}
      </SortableGrid>
    {:else}
      <SortableGrid items={pages} key={(p) => p.id} onmove={movePage} min={130}>
        {#snippet item(p, i)}
          <div class="card cell page" style:--c={colorOf(p.file)}>
            <Thumb doc={fileById(p.file).doc} page={p.index + 1} width={130} />
            <div class="meta">
              <span class="small"><b>{i + 1}</b> <span class="muted">· {fileById(p.file).name} p{p.index + 1}</span></span>
            </div>
            <button class="icon-btn danger corner" onclick={() => removePage(p.id)} aria-label={`Remove page ${i + 1}`}><Icon name="x" size={14} /></button>
          </div>
        {/snippet}
      </SortableGrid>
    {/if}
    <div class="more"><Dropzone multiple compact label="Add more PDFs" onfiles={add} /></div>
  {/snippet}

  {#snippet options()}
    <div>
      <p class="label">Summary</p>
      <p class="sum"><b>{files.length}</b> files · <b>{totalPages}</b> pages</p>
      <p class="muted small">Files are combined in the order shown. Switch to Pages to reorder or drop individual pages.</p>
    </div>
  {/snippet}

  {#snippet actions()}
    <button class="btn btn-primary btn-lg" onclick={merge} data-testid="run"><Icon name="merge" size={18} /> Merge PDF</button>
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
  .cell {
    padding: 10px;
    border-top: 3px solid var(--c);
    display: grid;
    gap: 8px;
    position: relative;
  }
  .meta {
    display: grid;
    min-width: 0;
  }
  .meta b {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
  }
  .page .meta span {
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
  .corner {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 26px;
    height: 26px;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .page:hover .corner,
  .corner:focus-visible {
    opacity: 1;
  }
  @media (hover: none) {
    .corner {
      opacity: 1;
    }
  }
  .more {
    margin-top: 16px;
  }
  .sum {
    margin: 4px 0 8px;
    font-size: 18px;
  }
  .label {
    margin: 0;
  }
</style>
