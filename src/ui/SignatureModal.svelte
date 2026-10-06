<script lang="ts">
  // Create a signature by drawing, typing or uploading an image. Everything is
  // drawn on local canvases; the result is a trimmed transparent PNG.
  import Icon from './Icon.svelte'
  import { canvasToSignature, loadSignatureFonts, PEN_COLORS, removeWhite, SIGNATURE_STYLES, trimCanvas, type Signature } from './SignatureKit'
  import { errorMessage } from '../lib/files'

  let { open = $bindable(false), onsave }: { open?: boolean; onsave: (sig: Signature, remember: boolean) => void } = $props()

  type Tab = 'draw' | 'type' | 'upload'
  let dialog: HTMLDialogElement
  let tab = $state<Tab>('draw')
  let color = $state(PEN_COLORS[0].value)
  let remember = $state(false)
  let error = $state('')

  // ---- Draw ----
  let pad = $state<HTMLCanvasElement>()
  let inked = $state(false)
  let pts: { x: number; y: number }[] = []
  let ratio = 2

  function setupPad() {
    if (!pad) return
    ratio = Math.max(2, window.devicePixelRatio || 1)
    const w = pad.clientWidth || 520
    const h = pad.clientHeight || 200
    if (pad.width === Math.round(w * ratio) && pad.height === Math.round(h * ratio)) return
    pad.width = Math.round(w * ratio)
    pad.height = Math.round(h * ratio)
    inked = false
  }

  function padPoint(e: PointerEvent) {
    const r = pad!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * pad!.width, y: ((e.clientY - r.top) / r.height) * pad!.height }
  }

  function penStart(e: PointerEvent) {
    if (!pad) return
    e.preventDefault()
    pad.setPointerCapture(e.pointerId)
    const p = padPoint(e)
    pts = [p]
    const ctx = pad.getContext('2d')!
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(p.x, p.y, 1.3 * ratio, 0, Math.PI * 2)
    ctx.fill()
    inked = true
  }

  function penMove(e: PointerEvent) {
    if (!pts.length || !pad) return
    const ctx = pad.getContext('2d')!
    const events = e.getCoalescedEvents?.() ?? [e]
    for (const ev of events.length ? events : [e]) {
      const p = padPoint(ev)
      const prev = pts[pts.length - 1]
      if (Math.hypot(p.x - prev.x, p.y - prev.y) < 1.5) continue
      pts.push(p)
      // Smooth: quadratic curve through midpoints of consecutive segments.
      const a = pts.length > 2 ? pts[pts.length - 3] : prev
      const m1 = { x: (a.x + prev.x) / 2, y: (a.y + prev.y) / 2 }
      const m2 = { x: (prev.x + p.x) / 2, y: (prev.y + p.y) / 2 }
      ctx.strokeStyle = color
      ctx.lineWidth = 2.6 * ratio
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(m1.x, m1.y)
      ctx.quadraticCurveTo(prev.x, prev.y, m2.x, m2.y)
      ctx.stroke()
    }
  }

  function penEnd() {
    if (pts.length > 1 && pad) {
      const ctx = pad.getContext('2d')!
      const [a, b] = pts.slice(-2)
      ctx.beginPath()
      ctx.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
    pts = []
  }

  function clearPad() {
    if (!pad) return
    pad.getContext('2d')!.clearRect(0, 0, pad.width, pad.height)
    inked = false
  }

  // ---- Type ----
  let typed = $state('')
  let styleIdx = $state(0)

  function renderTyped(): HTMLCanvasElement | null {
    const text = typed.trim()
    if (!text) return null
    const s = SIGNATURE_STYLES[styleIdx]
    const size = 120
    const font = `${s.italic ? 'italic ' : ''}${size}px ${s.css}`
    const c = document.createElement('canvas')
    let ctx = c.getContext('2d')!
    ctx.font = font
    const w = Math.ceil(ctx.measureText(text).width)
    c.width = w + size
    c.height = Math.ceil(size * 1.8)
    ctx = c.getContext('2d')!
    ctx.font = font
    ctx.fillStyle = color
    ctx.textBaseline = 'middle'
    ctx.fillText(text, size / 2, c.height / 2)
    return trimCanvas(c)
  }

  // ---- Upload ----
  let upload = $state<ImageBitmap | null>(null)
  let clean = $state(true)
  let uploadPreview = $state('')

  async function pickImage(f: File | undefined) {
    error = ''
    if (!f) return
    if (!/^image\/(png|jpeg)$/.test(f.type) && !/\.(png|jpe?g)$/i.test(f.name)) {
      error = 'Please choose a PNG or JPG image.'
      return
    }
    try {
      upload?.close()
      upload = await createImageBitmap(f)
    } catch (e) {
      error = `This image could not be opened. ${errorMessage(e)}`
    }
  }

  function renderUpload(): HTMLCanvasElement | null {
    if (!upload) return null
    const k = Math.min(1, 1600 / upload.width, 1600 / upload.height)
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(upload.width * k))
    c.height = Math.max(1, Math.round(upload.height * k))
    c.getContext('2d')!.drawImage(upload, 0, 0, c.width, c.height)
    if (!clean) return c
    removeWhite(c)
    return trimCanvas(c, 4)
  }

  $effect(() => {
    void clean
    if (!upload) {
      uploadPreview = ''
      return
    }
    const c = renderUpload()
    uploadPreview = c ? c.toDataURL('image/png') : ''
  })

  // ---- Dialog ----
  $effect(() => {
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      error = ''
      requestAnimationFrame(setupPad)
    } else if (!open && dialog.open) dialog.close()
  })

  $effect(() => {
    if (tab === 'draw' && open) requestAnimationFrame(setupPad)
  })
  $effect(() => {
    if (open) loadSignatureFonts()
  })

  const canSave = $derived(tab === 'draw' ? inked : tab === 'type' ? !!typed.trim() : !!uploadPreview)

  async function save() {
    error = ''
    if (tab === 'type') await loadSignatureFonts()
    const c = tab === 'draw' ? (pad ? trimCanvas(pad) : null) : tab === 'type' ? renderTyped() : renderUpload()
    if (!c) {
      error = tab === 'draw' ? 'Draw your signature first.' : tab === 'type' ? 'Type your name first.' : 'Choose an image first.'
      return
    }
    onsave(canvasToSignature(c), remember)
    clearPad()
    open = false
  }
</script>

<dialog bind:this={dialog} class="sig-dialog card" aria-labelledby="sig-title" onclose={() => (open = false)} data-testid="sig-dialog">
  <div class="head">
    <h2 id="sig-title">Create your signature</h2>
    <button class="icon-btn" aria-label="Close" onclick={() => (open = false)}><Icon name="x" size={18} /></button>
  </div>

  <div class="tabs segmented" role="group" aria-label="Signature method">
    <button aria-pressed={tab === 'draw'} data-testid="sig-tab-draw" onclick={() => (tab = 'draw')}><Icon name="pen" size={16} /> Draw</button>
    <button aria-pressed={tab === 'type'} data-testid="sig-tab-type" onclick={() => (tab = 'type')}><Icon name="type" size={16} /> Type</button>
    <button aria-pressed={tab === 'upload'} data-testid="sig-tab-upload" onclick={() => (tab = 'upload')}
      ><Icon name="upload" size={16} /> Upload</button
    >
  </div>

  <div class="body">
    {#if tab !== 'upload'}
      <div class="pens" role="group" aria-label="Ink colour">
        <span class="label">Ink</span>
        {#each PEN_COLORS as p (p.value)}
          <button class="pen" style:--c={p.value} aria-pressed={color === p.value} aria-label={p.name} title={p.name} onclick={() => (color = p.value)}></button>
        {/each}
      </div>
    {/if}

    {#if tab === 'draw'}
      <div class="padwrap">
        <canvas
          bind:this={pad}
          class="pad"
          data-testid="sig-pad"
          aria-label="Signature drawing area. Draw with your mouse, finger or pen."
          onpointerdown={penStart}
          onpointermove={penMove}
          onpointerup={penEnd}
          onpointercancel={penEnd}
        ></canvas>
        <span class="line" aria-hidden="true"></span>
        {#if !inked}<span class="ph" aria-hidden="true">Sign here</span>{/if}
        <button class="btn btn-sm btn-ghost clear" onclick={clearPad} disabled={!inked} data-testid="sig-clear"><Icon name="undo" size={14} /> Clear</button>
      </div>
    {:else if tab === 'type'}
      <label class="field">
        <span>Your name</span>
        <input class="input" bind:value={typed} placeholder="Jane Doe" maxlength="60" autocomplete="name" data-testid="sig-type-input" />
      </label>
      <div class="styles" role="radiogroup" aria-label="Signature style">
        {#each SIGNATURE_STYLES as s, i (s.name)}
          <button
            class="style"
            role="radio"
            aria-checked={styleIdx === i}
            data-testid={`sig-style-${i}`}
            onclick={() => (styleIdx = i)}
            style:font-family={s.css}
            style:font-style={s.italic ? 'italic' : 'normal'}
            style:color={color}>{typed.trim() || 'Your name'}</button
          >
        {/each}
      </div>
    {:else}
      <label class="upload">
        <input type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" class="sr-only" data-testid="sig-upload-input" onchange={(e) => pickImage(e.currentTarget.files?.[0])} />
        {#if uploadPreview}
          <img src={uploadPreview} alt="Uploaded signature preview" class="checker" />
        {:else}
          <span class="big"><Icon name="image" size={26} /></span>
          <span><b>Choose an image</b> of your signature (PNG or JPG)</span>
        {/if}
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={clean} data-testid="sig-remove-bg" />
        Remove white background
      </label>
    {/if}
  </div>

  {#if error}<p class="notice notice-error small" role="alert">{error}</p>{/if}

  <div class="foot">
    <label class="check small">
      <input type="checkbox" bind:checked={remember} data-testid="sig-remember" />
      Remember on this device
    </label>
    <div class="btns">
      <button class="btn" onclick={() => (open = false)}>Cancel</button>
      <button class="btn btn-primary" onclick={save} disabled={!canSave} data-testid="sig-save"><Icon name="check" size={18} /> Use signature</button>
    </div>
  </div>
  {#if remember}<p class="muted small note">Stored only in this browser's local storage. You can forget it at any time.</p>{/if}
</dialog>

<style>
  .sig-dialog {
    width: min(600px, calc(100vw - 24px));
    max-height: calc(100dvh - 24px);
    padding: 20px;
    color: var(--text);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-lg);
    overflow: auto;
  }
  .sig-dialog::backdrop {
    background: rgb(11 18 32 / 55%);
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;
  }
  h2 {
    font-size: 20px;
    margin: 0;
  }
  .tabs {
    display: flex;
    width: 100%;
  }
  .tabs button {
    flex: 1;
    display: inline-flex;
    gap: 6px;
    align-items: center;
    justify-content: center;
  }
  .body {
    display: grid;
    gap: 12px;
    margin: 16px 0;
  }
  .pens {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .pen {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--c);
    border: 2px solid var(--surface);
    box-shadow: 0 0 0 1px var(--border-strong);
    cursor: pointer;
    padding: 0;
  }
  .pen[aria-pressed='true'] {
    box-shadow: 0 0 0 2px var(--primary);
  }
  .padwrap {
    position: relative;
  }
  .pad {
    display: block;
    width: 100%;
    height: 200px;
    background: #fff;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    touch-action: none;
    cursor: crosshair;
  }
  .line {
    position: absolute;
    left: 24px;
    right: 24px;
    bottom: 48px;
    border-bottom: 1.5px dashed #c9d0da;
    pointer-events: none;
  }
  .ph {
    position: absolute;
    left: 28px;
    bottom: 54px;
    color: #8592a6;
    pointer-events: none;
    font-size: 14px;
  }
  .clear {
    position: absolute;
    right: 8px;
    top: 8px;
    color: #4a5568;
  }
  .styles {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .style {
    min-height: 72px;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-strong);
    background: #fff;
    font-size: 30px;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }
  .style[aria-checked='true'] {
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--primary-soft), 0 0 0 1px var(--primary);
  }
  .upload {
    display: grid;
    place-items: center;
    gap: 8px;
    min-height: 180px;
    padding: 16px;
    border: 2px dashed var(--border-strong);
    border-radius: var(--radius-sm);
    text-align: center;
    color: var(--text-2);
    cursor: pointer;
  }
  .upload:hover,
  .upload:focus-within {
    border-color: var(--primary);
  }
  .big {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: var(--primary-soft);
    color: var(--primary);
  }
  .checker {
    max-height: 160px;
    background: repeating-conic-gradient(#eef1f5 0 25%, #fff 0 50%) 0 0 / 16px 16px;
    border-radius: 6px;
  }
  .foot {
    display: flex;
    gap: 12px;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
  }
  .btns {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }
  .note {
    margin: 8px 0 0;
  }
  .notice {
    margin: 0 0 12px;
  }
  @media (max-width: 520px) {
    .styles {
      grid-template-columns: 1fr;
    }
    .pad {
      height: 170px;
    }
  }
</style>
