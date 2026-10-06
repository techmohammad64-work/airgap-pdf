<script lang="ts">
  import ToolShell from '../ui/ToolShell.svelte'
  import StampPreview from '../ui/StampPreview.svelte'
  import Icon from '../ui/Icon.svelte'
  import { CSS_FONT, FONT_OPTIONS } from '../ui/StampFonts'
  import { run } from '../worker/client'
  import { closePdf, confirmLarge, loadPdfFile, type PdfFile } from '../lib/pdfFile'
  import { baseName, errorMessage } from '../lib/files'
  import { parsePageSet } from '../core/ranges'
  import type { ToolResult } from '../lib/types'
  import type { FontFamily } from '../core/fonts'
  import type { NumberPosition } from '../core/pageNumbers'
  import type { ToolPage } from '../lib/site'

  let { page: _page }: { page: ToolPage } = $props()

  const POS_LABEL: Record<NumberPosition, string> = {
    tl: 'Top left',
    tc: 'Top centre',
    tr: 'Top right',
    bl: 'Bottom left',
    bc: 'Bottom centre',
    br: 'Bottom right',
  }
  const TOP: NumberPosition[] = ['tl', 'tc', 'tr']
  const BOTTOM: NumberPosition[] = ['bl', 'bc', 'br']
  const PRESETS = [
    { label: '1', format: '{n}' },
    { label: 'Page 1', format: 'Page {n}' },
    { label: 'Page 1 of N', format: 'Page {n} of {total}' },
    { label: '1 / N', format: '{n} / {total}' },
    { label: '- 1 -', format: '- {n} -' },
  ]
  const MARGINS = [
    { label: 'Small', value: 18 },
    { label: 'Medium', value: 28 },
    { label: 'Large', value: 40 },
  ]

  let file = $state<PdfFile | null>(null)
  let loading = $state(false)
  let busy = $state(false)
  let error = $state('')
  let result = $state<ToolResult | null>(null)

  let position = $state<NumberPosition>('bc')
  let format = $state('{n}')
  let start = $state(1)
  let range = $state('')
  let size = $state(12)
  let margin = $state(28)
  let color = $state('#333333')
  let font = $state<FontFamily>('helvetica')

  const total = $derived(file?.pageCount ?? 0)
  const targets = $derived.by((): { pages: number[]; error: string } => {
    if (!file) return { pages: [], error: '' }
    try {
      return { pages: parsePageSet(range, total), error: '' }
    } catch (e) {
      return { pages: [], error: errorMessage(e) }
    }
  })
  const startNum = $derived(Number.isFinite(start) ? Math.trunc(start) : 1)
  const lastNum = $derived(startNum + targets.pages.length - 1)
  const fmt = (n: number) => format.replace(/\{n\}/g, String(n)).replace(/\{total\}/g, String(lastNum))
  const firstPage = $derived(targets.pages[0] ?? 0)
  const label = $derived(fmt(startNum))

  async function add(list: File[]) {
    if (!confirmLarge(list)) return
    error = ''
    loading = true
    try {
      const pf = await loadPdfFile(list[0])
      closePdf(file)
      file = pf
      result = null
    } catch (e) {
      error = `${list[0].name}: ${errorMessage(e)}`
    } finally {
      loading = false
    }
  }

  function reset() {
    closePdf(file)
    file = null
    result = null
    error = ''
    range = ''
  }

  async function apply() {
    if (!file) return
    error = ''
    if (targets.error) {
      error = targets.error
      return
    }
    if (!format.includes('{n}')) {
      error = 'The format needs {n} where the page number goes.'
      return
    }
    if (!Number.isFinite(start) || start < 0) {
      error = 'The start number must be 0 or more.'
      return
    }
    busy = true
    try {
      const bytes = await run('addPageNumbers', file.bytes, {
        pages: range.trim() ? targets.pages : [],
        start: startNum,
        format,
        position,
        margin,
        size,
        color,
        font,
      })
      result = {
        name: `${baseName(file.name)}-numbered.pdf`,
        data: bytes,
        summary: `${targets.pages.length} pages numbered ${startNum}-${lastNum}`,
      }
    } catch (e) {
      error = errorMessage(e)
    } finally {
      busy = false
    }
  }
</script>

{#snippet posButton(p: NumberPosition)}
  <button class="pos" aria-pressed={position === p} aria-label={POS_LABEL[p]} title={POS_LABEL[p]} onclick={() => (position = p)} data-testid={`pos-${p}`}>
    <span class="dot"></span>
  </button>
{/snippet}

<ToolShell
  empty={!file}
  dropLabel="Drop a PDF here"
  onfiles={add}
  {loading}
  {busy}
  busyText="Numbering pages…"
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
          <span class="muted small">· {total} {total === 1 ? 'page' : 'pages'}</span>
        </div>
        <span class="muted small">Previewing page {firstPage + 1}</span>
      </div>
      <div class="preview">
        <StampPreview doc={file.doc} page={firstPage + 1}>
          {#snippet overlay(scale, _W, _H)}
            {#if !targets.error}
              <span
                class="num"
                style:font-size={`${size * scale}px`}
                style:font-family={CSS_FONT[font]}
                style:color
                style:left={position[1] === 'l' ? `${margin * scale}px` : position[1] === 'c' ? '50%' : null}
                style:right={position[1] === 'r' ? `${margin * scale}px` : null}
                style:top={position[0] === 't' ? `${margin * scale - 0.08 * size * scale}px` : null}
                style:bottom={position[0] === 'b' ? `${margin * scale - 0.2 * size * scale}px` : null}
                style:transform={position[1] === 'c' ? 'translateX(-50%)' : null}>{label}</span
              >
            {/if}
          {/snippet}
        </StampPreview>
        <p class="caption muted small">
          <Icon name="eye" size={14} /> Live preview of the first numbered page: <b>{label}</b>
        </p>
      </div>
    {/if}
  {/snippet}

  {#snippet options()}
    <div class="field">
      <span>Position</span>
      <div class="pos-wrap">
        <div class="mini" role="group" aria-label="Position">
          <div class="pos-row">
            {#each TOP as p (p)}{@render posButton(p)}{/each}
          </div>
          <div class="lines" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
          <div class="pos-row">
            {#each BOTTOM as p (p)}{@render posButton(p)}{/each}
          </div>
        </div>
        <span class="muted small">{POS_LABEL[position]}</span>
      </div>
    </div>

    <div class="field">
      <span>Format</span>
      <div class="chips" role="group" aria-label="Format presets">
        {#each PRESETS as p (p.format)}
          <button class="chip" aria-pressed={format === p.format} onclick={() => (format = p.format)}>{p.label}</button>
        {/each}
      </div>
      <input class="input" bind:value={format} aria-label="Custom format" data-testid="format" />
      <p class="hint muted">Use <code>{'{n}'}</code> for the number and <code>{'{total}'}</code> for the last number.</p>
    </div>

    <div class="row2">
      <label class="field">
        <span>Start at</span>
        <input class="input" type="number" min="0" step="1" bind:value={start} data-testid="start" />
      </label>
      <label class="field grow">
        <span>Pages</span>
        <input class="input" bind:value={range} placeholder="All pages" data-testid="range" />
      </label>
    </div>
    {#if range.trim() && targets.error}
      <p class="hint err">{targets.error}</p>
    {:else}
      <p class="hint muted tight">{range.trim() ? `${targets.pages.length} of ${total} pages numbered.` : 'e.g. 2- to skip the cover'}</p>
    {/if}

    <label class="field">
      <span class="between">Font size <b>{size} pt</b></span>
      <input type="range" min="6" max="36" step="1" bind:value={size} />
    </label>

    <div class="field">
      <span>Margin</span>
      <div class="segmented full" role="group" aria-label="Margin">
        {#each MARGINS as m (m.value)}
          <button aria-pressed={margin === m.value} onclick={() => (margin = m.value)}>{m.label}</button>
        {/each}
      </div>
    </div>

    <div class="row2">
      <label class="field grow">
        <span>Font</span>
        <select class="input" bind:value={font}>
          {#each FONT_OPTIONS as f (f.value)}<option value={f.value}>{f.label}</option>{/each}
        </select>
      </label>
      <label class="field">
        <span>Colour</span>
        <input type="color" bind:value={color} aria-label="Number colour" />
      </label>
    </div>
  {/snippet}

  {#snippet actions()}
    <button class="btn btn-primary btn-lg" onclick={apply} data-testid="run"><Icon name="hash" size={18} /> Add page numbers</button>
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
    color: var(--text-2);
  }
  .fname b {
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
  }
  .fname span {
    white-space: nowrap;
  }
  .preview {
    max-width: 560px;
    margin: 0 auto;
    padding: 20px;
    background: var(--surface-2);
    border-radius: var(--radius);
  }
  .caption {
    display: flex;
    gap: 6px;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    margin: 12px 0 0;
  }
  .caption b {
    color: var(--text);
  }
  .num {
    position: absolute;
    line-height: 1;
    white-space: pre;
  }
  .pos-wrap {
    display: flex;
    gap: 14px;
    align-items: center;
  }
  .mini {
    width: 96px;
    aspect-ratio: 1 / 1.3;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 4px;
    background: var(--page-bg);
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    box-shadow: var(--shadow-sm);
  }
  .pos-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
  }
  .pos {
    display: grid;
    place-items: center;
    height: 26px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
  }
  .pos:hover {
    background: var(--primary-soft);
  }
  .pos .dot {
    width: 14px;
    height: 5px;
    border-radius: 2px;
    background: #c9d0da;
  }
  .pos[aria-pressed='true'] {
    border-color: var(--primary);
    background: var(--primary-soft);
  }
  .pos[aria-pressed='true'] .dot {
    background: var(--primary);
  }
  .lines {
    display: grid;
    gap: 5px;
    padding: 0 10px;
  }
  .lines i {
    display: block;
    height: 3px;
    border-radius: 2px;
    background: #e1e5eb;
  }
  .lines i:last-child {
    width: 60%;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    padding: 5px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    background: var(--surface);
    font-size: 13px;
    font-weight: 600;
    color: var(--text-2);
    cursor: pointer;
  }
  .chip:hover {
    background: var(--surface-2);
  }
  .chip[aria-pressed='true'] {
    border-color: var(--primary);
    background: var(--primary-soft);
    color: var(--primary);
  }
  .full {
    display: flex;
    flex-wrap: nowrap;
  }
  .full button {
    flex: 1;
    padding: 8px 6px;
  }
  .row2 {
    display: flex;
    gap: 10px;
    align-items: flex-end;
  }
  .row2 > .field:not(.grow) {
    width: 96px;
  }
  .row2 > .field:has(input[type='color']) {
    width: auto;
  }
  .grow {
    flex: 1;
  }
  .between {
    display: flex;
    justify-content: space-between;
  }
  .between b {
    color: var(--text);
    font-weight: 600;
  }
  .hint {
    margin: 0;
    font-size: 13px;
  }
  .tight {
    margin-top: -10px;
  }
  .err {
    color: var(--danger);
    margin-top: -10px;
  }
  code {
    font-family: var(--mono);
    font-size: 12px;
    padding: 1px 4px;
    border-radius: 4px;
    background: var(--surface-2);
  }
  @media (max-width: 600px) {
    .preview {
      padding: 10px;
    }
  }
</style>
