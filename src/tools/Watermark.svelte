<script lang="ts">
  import ToolShell from '../ui/ToolShell.svelte'
  import StampPreview from '../ui/StampPreview.svelte'
  import Dropzone from '../ui/Dropzone.svelte'
  import Icon from '../ui/Icon.svelte'
  import { CSS_FONT, FONT_OPTIONS } from '../ui/StampFonts'
  import { run } from '../worker/client'
  import { closePdf, confirmLarge, loadPdfFile, type PdfFile } from '../lib/pdfFile'
  import { baseName, errorMessage, imageBytes } from '../lib/files'
  import { parsePageSet } from '../core/ranges'
  import type { ToolResult } from '../lib/types'
  import type { FontFamily } from '../core/fonts'
  import type { WatermarkOptions, WatermarkPosition } from '../core/watermark'
  import type { ToolPage } from '../lib/site'

  let { page: _page }: { page: ToolPage } = $props()

  const POSITIONS: { value: WatermarkPosition; label: string }[] = [
    { value: 'center', label: 'Center' },
    { value: 'top', label: 'Top' },
    { value: 'bottom', label: 'Bottom' },
    { value: 'tile', label: 'Tiled' },
  ]
  const ANGLES = [0, 45, 90]

  let file = $state<PdfFile | null>(null)
  let loading = $state(false)
  let busy = $state(false)
  let error = $state('')
  let result = $state<ToolResult | null>(null)

  let kind = $state<'text' | 'image'>('text')
  let text = $state('CONFIDENTIAL')
  let font = $state<FontFamily>('helvetica')
  let size = $state(60)
  let bold = $state(true)
  let color = $state('#d1352b')
  let image = $state<{ name: string; bytes: Uint8Array; format: 'png' | 'jpg'; url: string } | null>(null)
  let imagePct = $state(40)
  let opacityPct = $state(30)
  let angle = $state(45)
  let position = $state<WatermarkPosition>('center')
  let pageMode = $state<'all' | 'range'>('all')
  let range = $state('')
  let previewIndex = $state(0)

  const total = $derived(file?.pageCount ?? 0)
  const targets = $derived.by((): { pages: number[]; error: string } => {
    if (!file) return { pages: [], error: '' }
    if (pageMode === 'all' || !range.trim()) return { pages: [], error: pageMode === 'range' ? 'Enter the pages to watermark, for example 1-3, 5.' : '' }
    try {
      return { pages: parsePageSet(range, total), error: '' }
    } catch (e) {
      return { pages: [], error: errorMessage(e) }
    }
  })
  const isTarget = (i: number) => pageMode === 'all' || targets.pages.includes(i)
  const targetCount = $derived(pageMode === 'all' ? total : targets.pages.length)

  // Jump the preview to the first affected page whenever the selection changes.
  $effect(() => {
    if (pageMode === 'range' && targets.pages.length && !targets.pages.includes(previewIndex)) previewIndex = targets.pages[0]
  })

  /** Centres (in points) where the watermark is drawn, plus the width basis for images. */
  function spots(W: number, H: number): { cx: number; cy: number; basis: number }[] {
    if (position === 'tile') {
      const out = []
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) out.push({ cx: ((c + 0.5) * W) / 3, cy: ((r + 0.5) * H) / 4, basis: W / 2 })
      return out
    }
    const cy = position === 'top' ? H * 0.15 : position === 'bottom' ? H * 0.85 : H / 2
    return [{ cx: W / 2, cy, basis: W }]
  }

  async function add(list: File[]) {
    if (!confirmLarge(list)) return
    error = ''
    loading = true
    try {
      const pf = await loadPdfFile(list[0])
      closePdf(file)
      file = pf
      previewIndex = 0
      result = null
    } catch (e) {
      error = `${list[0].name}: ${errorMessage(e)}`
    } finally {
      loading = false
    }
  }

  async function pickImage(list: File[]) {
    const f = list[0]
    if (!f) return
    error = ''
    try {
      const { bytes, format } = await imageBytes(f)
      if (image) URL.revokeObjectURL(image.url)
      image = { name: f.name, bytes, format, url: URL.createObjectURL(f) }
    } catch {
      error = `${f.name}: this image could not be read. Try a PNG or JPG.`
    }
  }

  function clearImage() {
    if (image) URL.revokeObjectURL(image.url)
    image = null
  }

  function reset() {
    closePdf(file)
    file = null
    clearImage()
    result = null
    error = ''
    range = ''
    pageMode = 'all'
  }

  async function apply() {
    if (!file) return
    error = ''
    if (kind === 'text' && !text.trim()) {
      error = 'Enter the watermark text.'
      return
    }
    if (kind === 'image' && !image) {
      error = 'Choose an image to use as the watermark.'
      return
    }
    if (targets.error) {
      error = targets.error
      return
    }
    busy = true
    try {
      const opts: WatermarkOptions = {
        pages: pageMode === 'all' ? [] : targets.pages,
        kind,
        opacity: opacityPct / 100,
        angle,
        position,
        ...(kind === 'text'
          ? { text: text.trim(), size, color, font, bold }
          : { image: image!.bytes, imageFormat: image!.format, imageScale: imagePct / 100 }),
      }
      const bytes = await run('watermark', file.bytes, opts)
      result = {
        name: `${baseName(file.name)}-watermarked.pdf`,
        data: bytes,
        summary: `${targetCount} of ${total} pages watermarked`,
      }
    } catch (e) {
      error = errorMessage(e)
    } finally {
      busy = false
    }
  }
</script>

<ToolShell
  empty={!file}
  dropLabel="Drop a PDF here"
  onfiles={add}
  {loading}
  {busy}
  busyText="Adding watermark…"
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
        {#if total > 1}
          <div class="pager" role="group" aria-label="Preview page">
            <button class="icon-btn" disabled={previewIndex === 0} onclick={() => previewIndex--} aria-label="Previous page"><Icon name="chevron-left" size={16} /></button>
            <span class="small">Page <b>{previewIndex + 1}</b> of {total}</span>
            <button class="icon-btn" disabled={previewIndex >= total - 1} onclick={() => previewIndex++} aria-label="Next page"><Icon name="chevron-right" size={16} /></button>
          </div>
        {/if}
      </div>

      <div class="preview">
        <StampPreview doc={file.doc} page={previewIndex + 1} dimmed={!isTarget(previewIndex)}>
          {#snippet overlay(scale, W, H)}
            {#if isTarget(previewIndex)}
              {#each spots(W, H) as s, i (i)}
                {#if kind === 'text'}
                  <span
                    class="wm-text"
                    style:left={`${s.cx * scale}px`}
                    style:top={`${s.cy * scale}px`}
                    style:font-size={`${size * scale}px`}
                    style:font-family={CSS_FONT[font]}
                    style:font-weight={bold ? 700 : 400}
                    style:color
                    style:opacity={opacityPct / 100}
                    style:transform={`translate(-50%, -50%) rotate(${-angle}deg)`}>{text.trim()}</span
                  >
                {:else if image}
                  <img
                    class="wm-img"
                    src={image.url}
                    alt=""
                    style:left={`${s.cx * scale}px`}
                    style:top={`${s.cy * scale}px`}
                    style:width={`${s.basis * (imagePct / 100) * scale}px`}
                    style:opacity={opacityPct / 100}
                    style:transform={`translate(-50%, -50%) rotate(${-angle}deg)`}
                  />
                {/if}
              {/each}
            {/if}
          {/snippet}
        </StampPreview>
        <p class="caption muted small">
          {#if isTarget(previewIndex)}
            <Icon name="eye" size={14} /> Live preview. The final file may differ slightly.
          {:else}
            <Icon name="info" size={14} /> Page {previewIndex + 1} is not in the selected range and stays unchanged.
          {/if}
        </p>
      </div>
    {/if}
  {/snippet}

  {#snippet options()}
    <div class="segmented full" role="group" aria-label="Watermark type">
      <button aria-pressed={kind === 'text'} onclick={() => (kind = 'text')}><Icon name="type" size={16} /> Text</button>
      <button aria-pressed={kind === 'image'} onclick={() => (kind = 'image')}><Icon name="image" size={16} /> Image</button>
    </div>

    {#if kind === 'text'}
      <label class="field">
        <span>Text</span>
        <input class="input" bind:value={text} maxlength="120" data-testid="wm-text" />
      </label>
      <div class="row2">
        <label class="field grow">
          <span>Font</span>
          <select class="input" bind:value={font}>
            {#each FONT_OPTIONS as f (f.value)}<option value={f.value}>{f.label}</option>{/each}
          </select>
        </label>
        <label class="field">
          <span>Colour</span>
          <input type="color" bind:value={color} aria-label="Text colour" />
        </label>
      </div>
      <label class="field">
        <span class="between">Size <b>{size} pt</b></span>
        <input type="range" min="12" max="160" step="2" bind:value={size} />
      </label>
      <label class="check"><input type="checkbox" bind:checked={bold} /> Bold</label>
    {:else}
      <div class="field">
        <span>Image</span>
        {#if image}
          <div class="img-pick">
            <img src={image.url} alt="" />
            <span class="small" title={image.name}>{image.name}</span>
            <button class="icon-btn" onclick={clearImage} aria-label="Remove image"><Icon name="x" size={14} /></button>
          </div>
        {:else}
          <Dropzone accept="image" compact label="Choose PNG, JPG or WebP" onfiles={pickImage} />
        {/if}
      </div>
      <label class="field">
        <span class="between">Size <b>{imagePct}% of page width</b></span>
        <input type="range" min="5" max="100" step="1" bind:value={imagePct} />
      </label>
    {/if}

    <label class="field">
      <span class="between">Opacity <b>{opacityPct}%</b></span>
      <input type="range" min="5" max="100" step="1" bind:value={opacityPct} />
    </label>

    <div class="field">
      <span class="between">Angle <b>{angle}°</b></span>
      <div class="segmented full" role="group" aria-label="Angle presets">
        {#each ANGLES as a (a)}
          <button aria-pressed={angle === a} onclick={() => (angle = a)}>{a}°</button>
        {/each}
      </div>
      <input type="range" min="-90" max="90" step="1" bind:value={angle} aria-label="Custom angle in degrees" />
    </div>

    <div class="field">
      <span>Position</span>
      <div class="segmented full" role="group" aria-label="Position">
        {#each POSITIONS as p (p.value)}
          <button aria-pressed={position === p.value} onclick={() => (position = p.value)}>{p.label}</button>
        {/each}
      </div>
    </div>

    <div class="field">
      <span>Pages</span>
      <div class="segmented full" role="group" aria-label="Pages">
        <button aria-pressed={pageMode === 'all'} onclick={() => (pageMode = 'all')}>All pages</button>
        <button aria-pressed={pageMode === 'range'} onclick={() => (pageMode = 'range')} data-testid="pages-range">Choose pages</button>
      </div>
      {#if pageMode === 'range'}
        <input class="input" bind:value={range} placeholder="e.g. 1-3, 5" aria-label="Pages to watermark" data-testid="range" />
        {#if range.trim() && targets.error}
          <p class="hint err">{targets.error}</p>
        {:else}
          <p class="hint muted">{range.trim() ? `${targetCount} of ${total} pages` : 'Separate pages and ranges with commas.'}</p>
        {/if}
      {/if}
    </div>
  {/snippet}

  {#snippet actions()}
    <button class="btn btn-primary btn-lg" onclick={apply} data-testid="run"><Icon name="drop" size={18} /> Add watermark</button>
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
  .pager {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .pager button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
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
    margin: 12px 0 0;
    text-align: center;
  }
  .wm-text {
    position: absolute;
    line-height: 1;
    white-space: pre;
    transform-origin: center;
  }
  .wm-img {
    position: absolute;
    height: auto;
    max-width: none;
    transform-origin: center;
  }
  .full {
    display: flex;
    flex-wrap: nowrap;
  }
  .full button {
    flex: 1;
    padding: 8px 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .row2 {
    display: flex;
    gap: 10px;
    align-items: flex-end;
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
  .err {
    color: var(--danger);
  }
  .img-pick {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    min-width: 0;
  }
  .img-pick img {
    width: 40px;
    height: 40px;
    object-fit: contain;
    background: var(--page-bg);
    border-radius: 4px;
  }
  .img-pick span {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @media (max-width: 600px) {
    .preview {
      padding: 10px;
    }
  }
</style>
