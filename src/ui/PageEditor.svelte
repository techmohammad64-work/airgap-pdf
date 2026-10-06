<script lang="ts" generics="T extends EditorItem">
  /**
   * PageEditor: scrolling list of every page of one PDF with an overlay layer
   * per page holding movable / resizable / deletable items.
   *
   * - `items` (bindable): every item, positions in visual points (EditorKit.ts).
   * - `selected` (bindable): id of the selected item or null.
   * - `create`: 'none' | 'click' | 'drag'. With 'click' a tap on an empty page
   *   area calls `oncreate(page, {x, y, width: 0, height: 0}, false, size)`; with
   *   'drag' a press-drag draws a rectangle and calls `oncreate(page, rect, true, size)`
   *   (a plain click still reports dragged=false). The tool pushes the new item.
   * - `item` snippet renders an item's content, filling its box: (item, { scale, selected }).
   * - `toolbar` snippet sits left of the zoom controls; `pageActions` snippet
   *   renders under each page with ({ index, width, height }).
   */
  import type { Snippet } from 'svelte'
  import { onMount } from 'svelte'
  import EditorPage from './EditorPage.svelte'
  import Icon from './Icon.svelte'
  import { clamp, type EditorItem, type Rect } from './EditorKit'
  import { pageSize, type PDFDocumentProxy } from '../render/pdfjs'

  interface PageInfo {
    index: number
    width: number
    height: number
  }

  let {
    doc,
    items = $bindable(),
    selected = $bindable(null),
    create = 'none',
    hint = '',
    oncreate,
    ondelete,
    onescape,
    itemLabel = (it: T) => it.kind,
    item,
    toolbar,
    pageActions,
  }: {
    doc: PDFDocumentProxy
    items: T[]
    selected?: string | null
    create?: 'none' | 'click' | 'drag'
    /** Shown above the pages, e.g. "Click on a page to place the signature". */
    hint?: string
    oncreate?: (page: number, rect: Rect, dragged: boolean, size: { width: number; height: number }) => void
    ondelete?: (item: T) => void
    /** Escape pressed (the editor already cleared the selection). */
    onescape?: () => void
    itemLabel?: (item: T) => string
    item: Snippet<[T, { scale: number; selected: boolean }]>
    toolbar?: Snippet
    pageActions?: Snippet<[PageInfo]>
  } = $props()

  const MIN = 8 // smallest item side, points
  const PAD = 16 // scroller padding, px

  let pages = $state<PageInfo[]>([])
  let cw = $state(0)
  let zoom = $state(1)

  const maxW = $derived(pages.length ? Math.max(...pages.map((p) => p.width)) : 612)
  const fit = $derived(cw > 0 ? Math.max(0.2, (cw - PAD * 2) / maxW) : 0)
  const scale = $derived(fit * zoom)
  const percent = $derived(Math.round((scale / (96 / 72)) * 100))

  onMount(() => {
    let alive = true
    ;(async () => {
      const out: PageInfo[] = []
      for (let i = 0; i < doc.numPages; i++) {
        const p = await doc.getPage(i + 1)
        out.push({ index: i, ...pageSize(p) })
      }
      if (alive) pages = out
    })().catch(() => {})
    return () => (alive = false)
  })

  // Keep every item inside its page, whatever changed it (typing, font size...).
  $effect(() => {
    if (!pages.length) return
    for (const it of items) {
      const p = pages[it.page]
      if (!p) continue
      const w = Math.min(it.width, p.width)
      const h = Math.min(it.height, p.height)
      const x = clamp(it.x, 0, p.width - w)
      const y = clamp(it.y, 0, p.height - h)
      if (w !== it.width) it.width = w
      if (h !== it.height) it.height = h
      if (x !== it.x) it.x = x
      if (y !== it.y) it.y = y
    }
  })

  // ---- Pointer interaction -------------------------------------------------

  type Drag =
    | { mode: 'move' | 'resize'; id: string; page: number; cx: number; cy: number; orig: Rect; moved: boolean }
    | { mode: 'draw' | 'click'; page: number; sx: number; sy: number; cx: number; cy: number; moved: boolean }

  let drag: Drag | null = null
  let preview = $state<(Rect & { page: number }) | null>(null)

  function pointFrom(e: PointerEvent, layer: HTMLElement) {
    const r = layer.getBoundingClientRect()
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }
  }

  function startItem(e: PointerEvent, it: T, mode: 'move' | 'resize') {
    if (e.button !== 0) return
    if (mode === 'move' && (e.target as HTMLElement).closest('[data-no-drag]')) return
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    selected = it.id
    drag = { mode, id: it.id, page: it.page, cx: e.clientX, cy: e.clientY, orig: { x: it.x, y: it.y, width: it.width, height: it.height }, moved: false }
  }

  function startLayer(e: PointerEvent, page: number) {
    if (e.button !== 0) return
    const layer = e.currentTarget as HTMLElement
    const pt = pointFrom(e, layer)
    if (create === 'none' || !oncreate) {
      selected = null
      return
    }
    if (create === 'drag') {
      e.preventDefault()
      layer.setPointerCapture(e.pointerId)
    }
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    drag = { mode: create === 'drag' ? 'draw' : 'click', page, sx: pt.x, sy: pt.y, cx: e.clientX, cy: e.clientY, moved: false }
  }

  function onMove(e: PointerEvent, layer: HTMLElement) {
    const d = drag
    if (!d) return
    const dxPx = e.clientX - d.cx
    const dyPx = e.clientY - d.cy
    if (Math.abs(dxPx) + Math.abs(dyPx) > 3) d.moved = true
    const p = pages[d.page]
    if (d.mode === 'move' || d.mode === 'resize') {
      const it = items.find((i) => i.id === d.id)
      if (!it || !d.moved) return
      const dx = dxPx / scale
      const dy = dyPx / scale
      const o = d.orig
      if (d.mode === 'move') {
        it.x = clamp(o.x + dx, 0, p.width - it.width)
        it.y = clamp(o.y + dy, 0, p.height - it.height)
      } else if (it.resize === 'aspect') {
        const ratio = o.width / o.height
        let w = Math.max(o.width + dx, (o.height + dy) * ratio)
        w = clamp(w, Math.max(MIN, MIN * ratio), Math.min(p.width - o.x, (p.height - o.y) * ratio))
        it.width = w
        it.height = w / ratio
      } else if (it.resize !== 'none') {
        it.width = clamp(o.width + dx, MIN, p.width - o.x)
        it.height = clamp(o.height + dy, MIN, p.height - o.y)
      }
    } else if (d.mode === 'draw' && d.moved) {
      const pt = pointFrom(e, layer)
      const x2 = clamp(pt.x, 0, p.width)
      const y2 = clamp(pt.y, 0, p.height)
      preview = { page: d.page, x: Math.min(d.sx, x2), y: Math.min(d.sy, y2), width: Math.abs(x2 - d.sx), height: Math.abs(y2 - d.sy) }
    }
  }

  function onUp(e: PointerEvent) {
    const d = drag
    drag = null
    if (!d) return
    if (d.mode === 'draw' || d.mode === 'click') {
      const p = pages[d.page]
      const size = { width: p.width, height: p.height }
      if (preview && preview.width >= 2 && preview.height >= 2) {
        const { page: _p, ...rect } = preview
        oncreate?.(d.page, rect, true, size)
      } else if (!d.moved || d.mode === 'draw') {
        oncreate?.(d.page, { x: d.sx, y: d.sy, width: 0, height: 0 }, false, size)
      }
      preview = null
    }
    void e
  }

  function cancel() {
    drag = null
    preview = null
  }

  function remove(it: T) {
    items = items.filter((i) => i.id !== it.id)
    if (selected === it.id) selected = null
    ondelete?.(it)
  }

  const editable = (el: EventTarget | null) =>
    el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (selected) selected = null
      ;(document.activeElement as HTMLElement | null)?.blur?.()
      onescape?.()
      return
    }
    if (!selected || editable(e.target) || (e.target as HTMLElement)?.closest?.('dialog')) return
    const it = items.find((i) => i.id === selected)
    if (!it) return
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      remove(it)
      return
    }
    const step = e.shiftKey ? 10 : 1
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    const m = moves[e.key]
    if (m) {
      e.preventDefault()
      const p = pages[it.page]
      it.x = clamp(it.x + m[0], 0, p.width - it.width)
      it.y = clamp(it.y + m[1], 0, p.height - it.height)
    }
  }

  const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]
  const zoomIn = () => (zoom = ZOOMS.find((z) => z > zoom + 0.01) ?? zoom)
  const zoomOut = () => (zoom = [...ZOOMS].reverse().find((z) => z < zoom - 0.01) ?? zoom)
</script>

<svelte:window onkeydown={onKey} />

<div class="editor">
  <div class="bar">
    <div class="tools">{@render toolbar?.()}</div>
    <div class="zoom" role="group" aria-label="Zoom">
      <button class="icon-btn" onclick={zoomOut} disabled={zoom <= ZOOMS[0]} aria-label="Zoom out" data-testid="zoom-out"><Icon name="zoom-out" size={18} /></button>
      <span class="pct small" aria-live="polite">{percent}%</span>
      <button class="icon-btn" onclick={zoomIn} disabled={zoom >= ZOOMS[ZOOMS.length - 1]} aria-label="Zoom in" data-testid="zoom-in"><Icon name="zoom-in" size={18} /></button>
      <button class="btn btn-sm btn-ghost" onclick={() => (zoom = 1)} aria-pressed={zoom === 1} data-testid="zoom-fit">Fit</button>
    </div>
  </div>
  {#if hint}<p class="hint small" role="status"><Icon name="info" size={16} /> {hint}</p>{/if}

  <div class="scroller" bind:clientWidth={cw}>
    {#if !pages.length || !scale}
      <div class="loading"><span class="spinner"></span> Preparing pages…</div>
    {:else}
      <div class="pages">
        {#each pages as pg (pg.index)}
          <div class="page-wrap">
            <div class="page" style:width={`${pg.width * scale}px`} style:height={`${pg.height * scale}px`}>
              <EditorPage {doc} index={pg.index} width={pg.width} height={pg.height} {scale} />
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="layer"
                class:create-click={create === 'click'}
                class:create-drag={create === 'drag'}
                data-testid={`editor-page-${pg.index + 1}`}
                aria-label={`Page ${pg.index + 1}`}
                onpointerdown={(e) => startLayer(e, pg.index)}
                onpointermove={(e) => onMove(e, e.currentTarget)}
                onpointerup={onUp}
                onpointercancel={cancel}
              >
                {#each items.filter((i) => i.page === pg.index) as it (it.id)}
                  {@const sel = selected === it.id}
                  <div
                    class="item"
                    class:sel
                    role="button"
                    tabindex="0"
                    aria-label={itemLabel(it)}
                    aria-pressed={sel}
                    data-testid="editor-item"
                    data-kind={it.kind}
                    style:left={`${it.x * scale}px`}
                    style:top={`${it.y * scale}px`}
                    style:width={`${it.width * scale}px`}
                    style:height={`${it.height * scale}px`}
                    onpointerdown={(e) => startItem(e, it, 'move')}
                    onfocus={() => (selected = it.id)}
                  >
                    {@render item(it, { scale, selected: sel })}
                    {#if sel}
                      <button
                        class="h grip"
                        tabindex="-1"
                        aria-label="Move"
                        title="Drag to move"
                        onpointerdown={(e) => startItem(e, it, 'move')}><Icon name="grip" size={14} /></button
                      >
                      <button
                        class="h del"
                        aria-label={`Delete ${itemLabel(it)}`}
                        title="Delete"
                        data-testid="editor-delete"
                        onpointerdown={(e) => e.stopPropagation()}
                        onclick={() => remove(it)}><Icon name="x" size={14} /></button
                      >
                      {#if it.resize !== 'none'}
                        <span
                          class="h size"
                          aria-hidden="true"
                          title="Drag to resize"
                          data-testid="editor-resize"
                          onpointerdown={(e) => startItem(e, it, 'resize')}
                        ></span>
                      {/if}
                    {/if}
                  </div>
                {/each}
                {#if preview && preview.page === pg.index}
                  <div
                    class="preview"
                    style:left={`${preview.x * scale}px`}
                    style:top={`${preview.y * scale}px`}
                    style:width={`${preview.width * scale}px`}
                    style:height={`${preview.height * scale}px`}
                  ></div>
                {/if}
              </div>
            </div>
            <div class="foot" style:width={`${pg.width * scale}px`}>
              <span class="muted small">Page {pg.index + 1} of {pages.length}</span>
              {@render pageActions?.(pg)}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .editor {
    display: grid;
    gap: 10px;
    min-width: 0;
  }
  .bar {
    position: sticky;
    top: 64px;
    z-index: 6;
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    padding: 8px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
  }
  .tools {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
    min-width: 0;
  }
  .zoom {
    display: flex;
    gap: 4px;
    align-items: center;
    margin-left: auto;
  }
  .pct {
    min-width: 46px;
    text-align: center;
    font-variant-numeric: tabular-nums;
    color: var(--text-2);
  }
  .hint {
    margin: 0;
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    background: var(--primary-soft);
    color: var(--primary);
    font-weight: 600;
  }
  .scroller {
    overflow-x: auto;
    padding: 16px;
    border-radius: var(--radius);
    background: var(--surface-2);
    border: 1px solid var(--border);
  }
  .loading {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: center;
    min-height: 280px;
    color: var(--text-2);
  }
  .pages {
    display: flex;
    flex-direction: column;
    align-items: safe center;
    gap: 20px;
    min-width: min-content;
  }
  .page-wrap {
    display: grid;
    gap: 6px;
  }
  .page {
    position: relative;
    background: var(--page-bg);
    box-shadow: 0 0 0 1px var(--border), var(--shadow);
    border-radius: 2px;
    color: #000;
  }
  .layer {
    position: absolute;
    inset: 0;
    user-select: none;
    -webkit-user-select: none;
  }
  .layer.create-click {
    cursor: copy;
  }
  .layer.create-drag {
    cursor: crosshair;
    touch-action: none;
  }
  .foot {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    min-height: 32px;
  }
  .item {
    position: absolute;
    cursor: move;
    touch-action: none;
    border-radius: 2px;
    outline: 1px dashed transparent;
    outline-offset: 2px;
  }
  .item:hover {
    outline-color: color-mix(in srgb, var(--primary) 60%, transparent);
  }
  .item.sel {
    outline: 2px solid var(--primary);
    z-index: 2;
  }
  .item:focus-visible {
    outline: 2px solid var(--focus);
  }
  .h {
    position: absolute;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border-radius: 50%;
    border: 2px solid #fff;
    background: var(--primary);
    color: #fff;
    box-shadow: var(--shadow);
    touch-action: none;
  }
  .grip {
    left: -14px;
    top: -14px;
    cursor: move;
  }
  .del {
    right: -14px;
    top: -14px;
    background: var(--danger);
    cursor: pointer;
  }
  .size {
    right: -10px;
    bottom: -10px;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    cursor: nwse-resize;
  }
  /* Bigger touch targets on coarse pointers. */
  @media (pointer: coarse) {
    .h {
      width: 32px;
      height: 32px;
    }
    .grip {
      left: -18px;
      top: -18px;
    }
    .del {
      right: -18px;
      top: -18px;
    }
    .size {
      width: 26px;
      height: 26px;
      right: -14px;
      bottom: -14px;
    }
  }
  .preview {
    position: absolute;
    background: color-mix(in srgb, var(--primary) 20%, transparent);
    border: 2px dashed var(--primary);
    pointer-events: none;
  }
</style>
