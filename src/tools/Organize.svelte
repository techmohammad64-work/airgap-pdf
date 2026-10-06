<script lang="ts">
  import ToolShell from '../ui/ToolShell.svelte'
  import SortableGrid from '../ui/SortableGrid.svelte'
  import Thumb from '../ui/Thumb.svelte'
  import Icon from '../ui/Icon.svelte'
  import { run } from '../worker/client'
  import { closePdf, confirmLarge, loadPdfFile, uid, type PdfFile } from '../lib/pdfFile'
  import { baseName, errorMessage } from '../lib/files'
  import { parsePageSet } from '../core/ranges'
  import { normRotation, type PageRef } from '../core/assemble'
  import type { ToolResult } from '../lib/types'
  import type { ToolPage } from '../lib/site'

  let { page }: { page: ToolPage } = $props()

  type Mode = 'organize' | 'rotate' | 'delete' | 'extract'

  interface Item {
    id: string
    /** 0-based source page, or null for an inserted blank page. */
    index: number | null
    /** Extra clockwise rotation in degrees (may exceed 360 so the preview animates). */
    rotate: number
    /** Marked for deletion (delete mode) or selected (extract mode). */
    mark: boolean
  }

  const mode = $derived<Mode>(page.mode === 'rotate' || page.mode === 'delete' || page.mode === 'extract' ? page.mode : 'organize')
  const toggling = $derived(mode === 'delete' || mode === 'extract')

  let file = $state<PdfFile | null>(null)
  let items = $state<Item[]>([])
  let past = $state<Item[][]>([])
  let future = $state<Item[][]>([])
  let blankSize = $state<[number, number]>([595.28, 841.89])
  let rangeText = $state('')
  let loading = $state(false)
  let busy = $state(false)
  let error = $state('')
  let result = $state<ToolResult | null>(null)

  const marked = $derived(items.filter((p) => p.mark).length)
  const HISTORY_LIMIT = 100

  async function add(list: File[]) {
    if (!confirmLarge(list)) return
    error = ''
    loading = true
    try {
      const pf = await loadPdfFile(list[0])
      closePdf(file)
      file = pf
      items = Array.from({ length: pf.pageCount }, (_, i) => ({ id: uid('pg'), index: i, rotate: 0, mark: false }))
      past = []
      future = []
      const first = await pf.doc.getPage(1)
      const v = first.getViewport({ scale: 1 })
      blankSize = [v.width, v.height]
    } catch (e) {
      error = `${list[0].name}: ${errorMessage(e)}`
    }
    loading = false
    result = null
  }

  /** Records the current state for undo, then applies a change. */
  function edit(change: () => void) {
    past.push($state.snapshot(items))
    if (past.length > HISTORY_LIMIT) past.shift()
    future = []
    change()
    error = ''
  }

  function undo() {
    const prev = past.pop()
    if (!prev) return
    future.push($state.snapshot(items))
    items = prev
  }

  function redo() {
    const next = future.pop()
    if (!next) return
    past.push($state.snapshot(items))
    items = next
  }

  const pos = (id: string) => items.findIndex((p) => p.id === id)

  function rotate(id: string, delta: number) {
    edit(() => (items[pos(id)].rotate += delta))
  }

  function rotateAll(delta: number) {
    edit(() => items.forEach((p) => (p.rotate += delta)))
  }

  function duplicate(id: string) {
    edit(() => {
      const i = pos(id)
      items.splice(i + 1, 0, { ...$state.snapshot(items[i]), id: uid('pg') })
    })
  }

  function remove(id: string) {
    if (items.length <= 1) {
      error = 'A PDF needs at least one page.'
      return
    }
    edit(() => (items = items.filter((p) => p.id !== id)))
  }

  function insertBlank(at: number) {
    edit(() => items.splice(at, 0, { id: uid('blank'), index: null, rotate: 0, mark: false }))
  }

  function move(from: number, to: number) {
    edit(() => {
      const [p] = items.splice(from, 1)
      items.splice(to, 0, p)
    })
  }

  function toggle(id: string) {
    edit(() => {
      const p = items[pos(id)]
      p.mark = !p.mark
    })
  }

  function markAll(v: boolean) {
    edit(() => items.forEach((p) => (p.mark = v)))
  }

  function markRange() {
    if (!rangeText.trim()) {
      error = 'Enter pages to select, for example 1-3, 7.'
      return
    }
    try {
      const set = new Set(parsePageSet(rangeText, items.length))
      edit(() => items.forEach((p, i) => (p.mark = set.has(i))))
    } catch (e) {
      error = errorMessage(e)
    }
  }

  function onkey(e: KeyboardEvent) {
    if (!file || result || busy) return
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
    if (!(e.ctrlKey || e.metaKey)) return
    const k = e.key.toLowerCase()
    if (k === 'z' && !e.shiftKey) {
      e.preventDefault()
      undo()
    } else if ((k === 'z' && e.shiftKey) || k === 'y') {
      e.preventDefault()
      redo()
    }
  }

  function reset() {
    closePdf(file)
    file = null
    items = []
    past = []
    future = []
    rangeText = ''
    result = null
    error = ''
  }

  const SUFFIX: Record<Mode, string> = { organize: 'organized', rotate: 'rotated', delete: 'edited', extract: 'extracted' }

  async function save() {
    error = ''
    if (!file) return
    let keep = items
    if (mode === 'delete') {
      if (!marked) {
        error = 'Click the pages you want to delete first.'
        return
      }
      if (marked === items.length) {
        error = "You can't delete every page. Leave at least one page unmarked."
        return
      }
      keep = items.filter((p) => !p.mark)
    } else if (mode === 'extract') {
      if (!marked) {
        error = 'Click the pages you want to extract first.'
        return
      }
      keep = items.filter((p) => p.mark)
    }
    if (!keep.length) {
      error = 'There are no pages left to save.'
      return
    }
    busy = true
    try {
      const refs: PageRef[] = keep.map((p) => {
        const r = normRotation(p.rotate)
        return p.index === null
          ? { kind: 'blank', width: blankSize[0], height: blankSize[1], rotate: r }
          : { kind: 'page', file: 0, index: p.index, rotate: r }
      })
      const bytes = await run('assemble', [file.bytes], refs)
      const n = refs.length
      const summary =
        mode === 'delete'
          ? `${marked} ${marked === 1 ? 'page' : 'pages'} deleted · ${n} left`
          : mode === 'extract'
            ? `${n} ${n === 1 ? 'page' : 'pages'} extracted`
            : `${n} ${n === 1 ? 'page' : 'pages'}`
      result = { name: `${baseName(file.name)}-${SUFFIX[mode]}.pdf`, data: bytes, summary }
    } catch (e) {
      error = errorMessage(e)
    } finally {
      busy = false
    }
  }

  const pageWord = (n: number) => `${n} ${n === 1 ? 'page' : 'pages'}`
</script>

<svelte:window onkeydown={onkey} />

<ToolShell
  empty={!file}
  dropLabel="Drop a PDF file here"
  onfiles={add}
  {loading}
  {busy}
  busyText="Saving…"
  {error}
  {result}
  onreset={reset}
  oncontinue={() => (result = null)}
>
  {#snippet workspace()}
    {#if file}
      <div class="toolbar">
        <div class="group" role="group" aria-label="History">
          <button class="icon-btn" onclick={undo} disabled={!past.length} aria-label="Undo" title="Undo (Ctrl+Z)"><Icon name="undo" size={16} /></button>
          <button class="icon-btn" onclick={redo} disabled={!future.length} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><Icon name="redo" size={16} /></button>
        </div>
        {#if mode === 'organize' || mode === 'rotate'}
          <div class="group">
            <button class="btn" class:btn-sm={mode === 'organize'} onclick={() => rotateAll(-90)}><Icon name="rotate-left" size={16} /> Rotate all left</button>
            <button class="btn" class:btn-sm={mode === 'organize'} onclick={() => rotateAll(90)}><Icon name="rotate" size={16} /> Rotate all right</button>
          </div>
        {/if}
        {#if mode === 'organize'}
          <button class="btn btn-sm" onclick={() => insertBlank(items.length)}><Icon name="file-plus" size={16} /> Insert blank page</button>
        {/if}
        {#if toggling}
          <div class="group">
            <button class="btn btn-sm" onclick={() => markAll(true)}>{mode === 'extract' ? 'Select all' : 'Mark all'}</button>
            <button class="btn btn-sm" onclick={() => markAll(false)} disabled={!marked}>{mode === 'extract' ? 'Select none' : 'Clear marks'}</button>
          </div>
        {/if}
        <span class="muted small hint">
          {mode === 'delete' ? 'Click pages to delete' : mode === 'extract' ? 'Click pages to extract' : 'Drag to reorder'}
        </span>
      </div>

      <SortableGrid items={items} key={(p) => p.id} onmove={move} min={140}>
        {#snippet item(p, i)}
          <div
            class="card cell"
            class:del={mode === 'delete' && p.mark}
            class:sel={mode === 'extract' && p.mark}
            data-testid="page"
          >
            {#if toggling}
              <button
                class="hit"
                aria-pressed={p.mark}
                aria-label={`${mode === 'delete' ? 'Mark for deletion' : 'Select'}: page ${i + 1}`}
                onclick={() => toggle(p.id)}
              ></button>
            {/if}
            <div class="frame">
              {#if p.index === null}
                <div class="blank" style:aspect-ratio={`${blankSize[0]} / ${blankSize[1]}`} style:transform={`rotate(${p.rotate}deg)`}>
                  <span class="muted small">Blank</span>
                </div>
              {:else}
                <Thumb doc={file!.doc} page={p.index + 1} rotate={p.rotate} width={140} />
              {/if}
              {#if mode === 'delete' && p.mark}
                <span class="badge del-badge"><Icon name="trash" size={14} /></span>
              {:else if mode === 'extract' && p.mark}
                <span class="badge sel-badge"><Icon name="check" size={14} stroke={3} /></span>
              {/if}
            </div>
            <div class="meta small">
              <b>{i + 1}</b>
              {#if p.index === null}<span class="muted">blank</span>{:else if p.index !== i}<span class="muted">was p{p.index + 1}</span>{/if}
              {#if normRotation(p.rotate)}<span class="muted">· {normRotation(p.rotate)}°</span>{/if}
            </div>
            {#if !toggling}
              <div class="btns">
                <button class="icon-btn" onclick={() => rotate(p.id, -90)} aria-label={`Rotate page ${i + 1} left`} title="Rotate left"><Icon name="rotate-left" size={16} /></button>
                <button class="icon-btn" onclick={() => rotate(p.id, 90)} aria-label={`Rotate page ${i + 1} right`} title="Rotate right"><Icon name="rotate" size={16} /></button>
                {#if mode === 'organize'}
                  <button class="icon-btn" onclick={() => duplicate(p.id)} aria-label={`Duplicate page ${i + 1}`} title="Duplicate"><Icon name="copy" size={16} /></button>
                  <button class="icon-btn" onclick={() => insertBlank(i + 1)} aria-label={`Insert blank page after page ${i + 1}`} title="Insert blank page after"><Icon name="file-plus" size={16} /></button>
                  <button class="icon-btn danger" onclick={() => remove(p.id)} aria-label={`Delete page ${i + 1}`} title="Delete"><Icon name="trash" size={16} /></button>
                {/if}
              </div>
            {/if}
          </div>
        {/snippet}
      </SortableGrid>
    {/if}
  {/snippet}

  {#snippet options()}
    <div>
      <p class="label">Summary</p>
      {#if mode === 'delete'}
        <p class="sum"><b>{marked}</b> of {items.length} pages marked</p>
        <p class="muted small">Marked pages are removed. Everything else stays as it is.</p>
      {:else if mode === 'extract'}
        <p class="sum"><b>{marked}</b> of {items.length} pages selected</p>
        <p class="muted small">Selected pages are saved as a new PDF, in the order shown.</p>
      {:else}
        <p class="sum"><b>{items.length}</b> pages</p>
        <p class="muted small">
          {mode === 'rotate'
            ? 'Rotate every page at once, or use the buttons under each page.'
            : 'Drag pages to reorder. Use the buttons under each page to rotate, duplicate, add a blank page or delete.'}
        </p>
      {/if}
    </div>
    {#if toggling}
      <div class="field">
        <span>{mode === 'extract' ? 'Select pages by number' : 'Mark pages by number'}</span>
        <div class="range">
          <input
            class="input"
            bind:value={rangeText}
            placeholder="1-3, 7"
            autocomplete="off"
            aria-label="Page numbers"
            onkeydown={(e) => e.key === 'Enter' && markRange()}
          />
          <button class="btn" onclick={markRange}>Apply</button>
        </div>
      </div>
    {/if}
    <p class="muted small keys">Undo with Ctrl+Z, redo with Ctrl+Shift+Z.</p>
  {/snippet}

  {#snippet actions()}
    {#if mode === 'delete'}
      <button class="btn btn-primary btn-lg" onclick={save} data-testid="run"><Icon name="trash" size={18} /> Delete {pageWord(marked)}</button>
    {:else if mode === 'extract'}
      <button class="btn btn-primary btn-lg" onclick={save} data-testid="run"><Icon name="extract" size={18} /> Extract {pageWord(marked)}</button>
    {:else if mode === 'rotate'}
      <button class="btn btn-primary btn-lg" onclick={save} data-testid="run"><Icon name="rotate" size={18} /> Save rotated PDF</button>
    {:else}
      <button class="btn btn-primary btn-lg" onclick={save} data-testid="run"><Icon name="download" size={18} /> Save PDF</button>
    {/if}
  {/snippet}
</ToolShell>

<style>
  .toolbar {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .group {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .hint {
    margin-left: auto;
  }
  .icon-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .cell {
    position: relative;
    height: 100%;
    padding: 10px;
    display: grid;
    grid-template-rows: 1fr auto auto;
    gap: 8px;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }
  .hit {
    position: absolute;
    inset: 0;
    z-index: 2;
    border: 0;
    border-radius: inherit;
    background: transparent;
    cursor: pointer;
  }
  .cell:has(.hit):hover {
    border-color: var(--border-strong);
  }
  .frame {
    position: relative;
    display: grid;
    place-items: center;
  }
  .blank {
    width: 100%;
    display: grid;
    place-items: center;
    background: var(--page-bg);
    border-radius: 4px;
    box-shadow: 0 0 0 1px var(--border), var(--shadow-sm);
    transition: transform 0.2s;
  }
  .meta {
    display: flex;
    gap: 6px;
    align-items: baseline;
    white-space: nowrap;
    overflow: hidden;
  }
  .btns {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .btns .danger {
    margin-left: auto;
  }
  .danger:hover {
    color: var(--danger);
  }
  .badge {
    position: absolute;
    top: 6px;
    right: 6px;
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    color: #fff;
    box-shadow: var(--shadow-sm);
  }
  .del {
    border-color: var(--danger);
    box-shadow: 0 0 0 2px var(--danger);
  }
  .del .frame::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 4px;
    background:
      linear-gradient(to top right, transparent calc(50% - 1.5px), var(--danger) calc(50% - 1.5px), var(--danger) calc(50% + 1.5px), transparent calc(50% + 1.5px)),
      color-mix(in srgb, var(--danger) 22%, transparent);
  }
  .del .meta b {
    text-decoration: line-through;
    color: var(--danger);
  }
  .del-badge {
    background: var(--danger);
    z-index: 1;
  }
  .sel {
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--primary);
  }
  .sel .frame::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 4px;
    background: color-mix(in srgb, var(--primary) 14%, transparent);
  }
  .sel-badge {
    background: var(--primary);
    z-index: 1;
  }
  .sum {
    margin: 4px 0 8px;
    font-size: 18px;
  }
  .label {
    margin: 0;
  }
  .range {
    display: flex;
    gap: 8px;
  }
  .keys {
    margin: 0;
  }
  @media (hover: none) {
    .keys {
      display: none;
    }
  }
</style>
