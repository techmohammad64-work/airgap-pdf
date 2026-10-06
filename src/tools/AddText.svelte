<script lang="ts">
  import ToolShell from '../ui/ToolShell.svelte'
  import PageEditor from '../ui/PageEditor.svelte'
  import EditorText from '../ui/EditorText.svelte'
  import EditorToolButton from '../ui/EditorToolButton.svelte'
  import Icon from '../ui/Icon.svelte'
  import { run } from '../worker/client'
  import { closePdf, confirmLarge, loadPdfFile, uid, type PdfFile } from '../lib/pdfFile'
  import { baseName, errorMessage } from '../lib/files'
  import { FONT_LABEL, newText, today, type EditorItem, type Rect, type TextItem } from '../ui/EditorKit'
  import type { ToolResult } from '../lib/types'
  import type { Overlay } from '../core/overlays'
  import type { FontFamily } from '../core/fonts'
  import type { ToolPage } from '../lib/site'

  let { page: _page }: { page: ToolPage } = $props()

  interface CheckItem extends EditorItem {
    kind: 'check'
    color: string
  }
  interface RectItem extends EditorItem {
    kind: 'whiteout'
    color: string
  }
  type Item = TextItem | CheckItem | RectItem
  type Mode = 'select' | 'text' | 'check' | 'date' | 'whiteout'

  const COLORS = ['#000000', '#1d3fbb', '#c4321f', '#0e7a55']
  const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48]

  let file = $state<PdfFile | null>(null)
  let items = $state<Item[]>([])
  let selected = $state<string | null>(null)
  let mode = $state<Mode>('text')
  let loading = $state(false)
  let busy = $state(false)
  let error = $state('')
  let result = $state<ToolResult | null>(null)
  /** Style used for the next new text box; follows the last edit. */
  let style = $state({ font: 'helvetica' as FontFamily, size: 14, color: '#000000', bold: false })

  const current = $derived(items.find((i) => i.id === selected) ?? null)
  const counts = $derived({
    text: items.filter((i) => i.kind === 'text' && i.text.trim()).length,
    check: items.filter((i) => i.kind === 'check').length,
    whiteout: items.filter((i) => i.kind === 'whiteout').length,
  })
  const hints: Record<Mode, string> = {
    select: '',
    text: 'Click on a page where the text should go, then type.',
    check: 'Click on a page to place a checkmark.',
    date: "Click on a page to place today's date.",
    whiteout: 'Drag on a page to cover an area with white, or click for a small box.',
  }

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
    mode = 'text'
    result = null
    error = ''
  }

  function create(page: number, r: Rect, dragged: boolean) {
    let it: Item
    if (mode === 'text' || mode === 'date') {
      it = newText(page, r.x, r.y - style.size * 0.6, mode === 'date' ? today() : '', style)
    } else if (mode === 'check') {
      it = { id: uid('it'), kind: 'check', page, x: r.x - 9, y: r.y - 9, width: 18, height: 18, resize: 'aspect', color: style.color }
    } else if (mode === 'whiteout') {
      const box = dragged ? r : { x: r.x - 60, y: r.y - 12, width: 120, height: 24 }
      it = { id: uid('it'), kind: 'whiteout', page, ...box, resize: 'free', color: '#ffffff' }
    } else return
    items.push(it)
    selected = it.id
    mode = 'select'
    result = null
  }

  // Drop text boxes that were left empty once they lose the selection.
  let prev: string | null = null
  $effect(() => {
    const s = selected
    if (prev && prev !== s) {
      const id = prev
      const it = items.find((i) => i.id === id)
      if (it?.kind === 'text' && !it.text.trim()) items = items.filter((i) => i.id !== id)
    }
    prev = s
  })

  // The style controls show the selected item's style.
  $effect(() => {
    const c = current
    if (c?.kind === 'text') style = { font: c.font, size: c.size, color: c.color, bold: c.bold }
    else if (c?.kind === 'check') style.color = c.color
  })

  function setStyle<K extends keyof typeof style>(k: K, v: (typeof style)[K]) {
    style[k] = v
    if (current?.kind === 'text') (current as TextItem)[k] = v as never
    if (current?.kind === 'check' && k === 'color') current.color = v as string
  }

  function pick(m: Mode) {
    mode = mode === m ? 'select' : m
    if (mode !== 'select') selected = null
  }

  function overlays(): Overlay[] {
    const out: Overlay[] = []
    // White-out first so text and checkmarks can sit on top of it.
    for (const i of items) if (i.kind === 'whiteout') out.push({ type: 'rect', page: i.page, x: i.x, y: i.y, width: i.width, height: i.height, color: i.color })
    for (const i of items) {
      if (i.kind === 'text' && i.text.trim())
        out.push({ type: 'text', page: i.page, x: i.x, y: i.y, text: i.text.replace(/\s+$/, ''), size: i.size, color: i.color, font: i.font, bold: i.bold })
      if (i.kind === 'check') out.push({ type: 'check', page: i.page, x: i.x, y: i.y, size: i.width, color: i.color })
    }
    return out
  }

  async function save() {
    error = ''
    if (!file) return
    const list = overlays()
    if (!list.length) {
      error = 'Add some text, a checkmark or a white-out box first.'
      return
    }
    busy = true
    try {
      const bytes = await run('applyOverlays', file.bytes, list)
      const parts = [
        counts.text && `${counts.text} text`,
        counts.check && `${counts.check} check${counts.check > 1 ? 'marks' : 'mark'}`,
        counts.whiteout && `${counts.whiteout} white-out`,
      ].filter(Boolean)
      result = { name: `${baseName(file.name)}-edited.pdf`, data: bytes, summary: parts.join(' · ') }
    } catch (e) {
      error = errorMessage(e)
    } finally {
      busy = false
    }
  }
</script>

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
      <PageEditor
        doc={file.doc}
        bind:items
        bind:selected
        create={mode === 'select' ? 'none' : mode === 'whiteout' ? 'drag' : 'click'}
        hint={hints[mode]}
        oncreate={create}
        onescape={() => (mode = 'select')}
        ondelete={() => (result = null)}
        itemLabel={(i) => (i.kind === 'text' ? `Text: ${i.text || 'empty'}` : i.kind === 'check' ? 'Checkmark' : 'White-out box')}
      >
        {#snippet toolbar()}
          <EditorToolButton icon="type" label="Text" pressed={mode === 'text'} testid="tool-text" onclick={() => pick('text')} />
          <EditorToolButton icon="check" label="Check" pressed={mode === 'check'} testid="tool-check" onclick={() => pick('check')} />
          <EditorToolButton icon="calendar" label="Date" pressed={mode === 'date'} testid="tool-date" onclick={() => pick('date')} />
          <EditorToolButton icon="square" label="White-out" pressed={mode === 'whiteout'} testid="tool-whiteout" onclick={() => pick('whiteout')} />
        {/snippet}
        {#snippet item(it, ctx)}
          {#if it.kind === 'text'}
            <EditorText item={it} scale={ctx.scale} selected={ctx.selected} />
          {:else if it.kind === 'check'}
            <svg class="fill" viewBox="0 0 100 100" aria-hidden="true">
              <path d="M 10 52 L 38 80 L 92 18" fill="none" stroke={it.color} stroke-width="14" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          {:else}
            <div class="fill whiteout" style:background={it.color}></div>
          {/if}
        {/snippet}
      </PageEditor>
    {/if}
  {/snippet}

  {#snippet options()}
    {#if current?.kind === 'whiteout'}
      <div>
        <p class="label">White-out box</p>
        <p class="muted small">Covers what is underneath with white. Drag the corner to resize. The original content is still in the file: use Redact PDF to remove it for good.</p>
      </div>
    {:else}
      <div class="opts">
        <p class="label">{current?.kind === 'text' ? 'Selected text' : current?.kind === 'check' ? 'Checkmark' : 'Text style'}</p>
        {#if current?.kind !== 'check'}
          <label class="field">
            <span>Font</span>
            <select class="input" data-testid="text-font" value={style.font} onchange={(e) => setStyle('font', e.currentTarget.value as FontFamily)}>
              {#each Object.entries(FONT_LABEL) as [k, v] (k)}<option value={k}>{v}</option>{/each}
            </select>
          </label>
          <div class="row">
            <label class="field grow">
              <span>Size</span>
              <select class="input" data-testid="text-size" value={style.size} onchange={(e) => setStyle('size', Number(e.currentTarget.value))}>
                {#each SIZES as s (s)}<option value={s}>{s} pt</option>{/each}
              </select>
            </label>
            <button
              class="btn bold"
              aria-pressed={style.bold}
              aria-label="Bold"
              data-testid="text-bold"
              onclick={() => setStyle('bold', !style.bold)}><b>B</b></button
            >
          </div>
        {/if}
        <div class="field">
          <span>Colour</span>
          <div class="swatches" role="group" aria-label="Colour">
            {#each COLORS as c (c)}
              <button class="sw" style:background={c} aria-label={`Colour ${c}`} aria-pressed={style.color === c} onclick={() => setStyle('color', c)}></button>
            {/each}
            <input type="color" aria-label="Custom colour" value={style.color} oninput={(e) => setStyle('color', e.currentTarget.value)} />
          </div>
        </div>
      </div>
    {/if}
    <div>
      <p class="label">On this document</p>
      <p class="sum"><b>{counts.text}</b> text · <b>{counts.check}</b> checks · <b>{counts.whiteout}</b> white-out</p>
      <p class="muted small">Pick a tool above the pages, then click on a page. Drag items to move them; press Delete to remove the selected one.</p>
    </div>
  {/snippet}

  {#snippet actions()}
    <button class="btn btn-primary btn-lg" onclick={save} data-testid="run"><Icon name="download" size={18} /> Save PDF</button>
  {/snippet}
</ToolShell>

<style>
  .fill {
    display: block;
    width: 100%;
    height: 100%;
  }
  .whiteout {
    box-shadow: inset 0 0 0 1px rgb(15 27 45 / 18%);
  }
  .opts {
    display: grid;
    gap: 12px;
  }
  .label {
    margin: 0;
  }
  .row {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }
  .grow {
    flex: 1;
  }
  .bold {
    width: 44px;
    padding: 0;
  }
  .bold[aria-pressed='true'] {
    background: var(--primary-soft);
    border-color: var(--primary);
    color: var(--primary);
  }
  .swatches {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .sw {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 2px solid var(--surface);
    box-shadow: 0 0 0 1px var(--border-strong);
    cursor: pointer;
    padding: 0;
  }
  .sw[aria-pressed='true'] {
    box-shadow: 0 0 0 2px var(--primary);
  }
  .sum {
    margin: 4px 0 8px;
    font-size: 16px;
  }
</style>
