<script lang="ts">
  import ToolShell from '../ui/ToolShell.svelte'
  import PageEditor from '../ui/PageEditor.svelte'
  import EditorText from '../ui/EditorText.svelte'
  import EditorToolButton from '../ui/EditorToolButton.svelte'
  import SignatureModal from '../ui/SignatureModal.svelte'
  import Icon from '../ui/Icon.svelte'
  import { run } from '../worker/client'
  import { closePdf, confirmLarge, loadPdfFile, uid, type PdfFile } from '../lib/pdfFile'
  import { baseName, errorMessage } from '../lib/files'
  import { newText, today, type EditorItem, type Rect, type TextItem } from '../ui/EditorKit'
  import { loadRemembered, storeRemembered, type Signature } from '../ui/SignatureKit'
  import type { ToolResult } from '../lib/types'
  import type { Overlay } from '../core/overlays'
  import type { ToolPage } from '../lib/site'

  let { page: _page }: { page: ToolPage } = $props()

  interface SigItem extends EditorItem {
    kind: 'sig'
    url: string
    bytes: Uint8Array
  }
  type Item = SigItem | TextItem

  /** Default signature width on the page, in points. */
  const SIG_WIDTH = 150

  let file = $state<PdfFile | null>(null)
  let items = $state<Item[]>([])
  let selected = $state<string | null>(null)
  let sigs = $state<Signature[]>(loadRemembered())
  /** What the next click on a page places: a signature id, 'date', or nothing. */
  let placing = $state<string | null>(null)
  let modal = $state(false)
  let loading = $state(false)
  let busy = $state(false)
  let error = $state('')
  let result = $state<ToolResult | null>(null)

  const placed = $derived(items.filter((i) => i.kind === 'sig').length)
  const hint = $derived(
    placing === 'date'
      ? "Click on a page to place today's date."
      : placing
        ? 'Click on a page to place your signature.'
        : sigs.length
          ? ''
          : 'Start by creating your signature.',
  )

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
    placing = null
    result = null
    error = ''
  }

  function saved(sig: Signature, remember: boolean) {
    sig.remembered = remember
    sigs.push(sig)
    if (remember) storeRemembered(sigs)
    placing = sig.id
    selected = null
  }

  function forget(id: string) {
    sigs = sigs.filter((s) => s.id !== id)
    storeRemembered(sigs)
    if (placing === id) placing = null
  }

  function forgetAll() {
    sigs = sigs.filter((s) => !s.remembered)
    storeRemembered(sigs)
  }

  function create(page: number, r: Rect, _dragged: boolean, size: { width: number; height: number }) {
    if (placing === 'date') {
      const t = newText(page, r.x, r.y - 8, today(), { size: 12 })
      items.push(t)
      selected = t.id
    } else {
      const sig = sigs.find((s) => s.id === placing)
      if (!sig) return
      const width = Math.min(SIG_WIDTH, size.width * 0.8)
      const height = (width * sig.height) / sig.width
      const it: SigItem = { id: uid('sig'), kind: 'sig', page, x: r.x - width / 2, y: r.y - height / 2, width, height, resize: 'aspect', url: sig.url, bytes: sig.bytes }
      items.push(it)
      selected = it.id
    }
    placing = null
    result = null
  }

  function place(id: string) {
    placing = placing === id ? null : id
    selected = null
  }

  function newSignature() {
    placing = null
    modal = true
  }

  async function sign() {
    error = ''
    if (!file) return
    const list: Overlay[] = []
    for (const i of items) {
      if (i.kind === 'sig') list.push({ type: 'image', page: i.page, x: i.x, y: i.y, width: i.width, height: i.height, bytes: i.bytes, format: 'png' })
      else if (i.text.trim())
        list.push({ type: 'text', page: i.page, x: i.x, y: i.y, text: i.text.replace(/\s+$/, ''), size: i.size, color: i.color, font: i.font, bold: i.bold })
    }
    if (!list.length) {
      error = sigs.length ? 'Click a signature, then click on a page to place it.' : 'Create your signature and place it on a page first.'
      return
    }
    busy = true
    try {
      const bytes = await run('applyOverlays', file.bytes, list)
      const dates = items.length - placed
      result = {
        name: `${baseName(file.name)}-signed.pdf`,
        data: bytes,
        summary: [placed && `${placed} signature${placed > 1 ? 's' : ''}`, dates && `${dates} date${dates > 1 ? 's' : ''}`].filter(Boolean).join(' · '),
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
  dropLabel="Drop a PDF file to sign"
  onfiles={add}
  {loading}
  {busy}
  busyText="Signing…"
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
        create={placing ? 'click' : 'none'}
        {hint}
        oncreate={create}
        onescape={() => (placing = null)}
        ondelete={() => (result = null)}
        itemLabel={(i) => (i.kind === 'sig' ? 'Signature' : `Date: ${i.text}`)}
      >
        {#snippet toolbar()}
          <EditorToolButton icon="sign" label="New signature" testid="sig-new" onclick={newSignature} />
          {#if sigs.length}
            <EditorToolButton
              icon="pen"
              label="Place signature"
              pressed={!!placing && placing !== 'date'}
              testid="sig-place"
              onclick={() => place(sigs[sigs.length - 1].id)}
            />
          {/if}
          <EditorToolButton icon="calendar" label="Date" pressed={placing === 'date'} testid="tool-date" onclick={() => place('date')} />
        {/snippet}
        {#snippet item(it, ctx)}
          {#if it.kind === 'sig'}
            <img class="sig" src={it.url} alt="" draggable="false" />
          {:else}
            <EditorText item={it} scale={ctx.scale} selected={ctx.selected} />
          {/if}
        {/snippet}
      </PageEditor>
    {/if}
    <SignatureModal bind:open={modal} onsave={saved} />
  {/snippet}

  {#snippet options()}
    <div class="list">
      <p class="label">Your signatures</p>
      {#if sigs.length}
        <ul class="sigs">
          {#each sigs as s, i (s.id)}
            <li class:active={placing === s.id}>
              <button class="pick" onclick={() => place(s.id)} aria-pressed={placing === s.id} aria-label={`Place signature ${i + 1}`} data-testid={`sig-item-${i}`}>
                <img src={s.url} alt={`Signature ${i + 1}`} />
              </button>
              <button
                class="icon-btn danger"
                onclick={() => forget(s.id)}
                aria-label={s.remembered ? `Forget signature ${i + 1} on this device` : `Remove signature ${i + 1}`}
                title={s.remembered ? 'Forget on this device' : 'Remove'}><Icon name="trash" size={16} /></button
              >
              {#if s.remembered}<span class="saved small"><Icon name="lock" size={12} /> Saved on this device</span>{/if}
            </li>
          {/each}
        </ul>
        <p class="muted small">Click a signature, then click on a page. Place it as often as you need.</p>
      {:else}
        <p class="muted small">Draw, type or upload your signature. It stays on this device.</p>
      {/if}
      <button class="btn" onclick={newSignature} data-testid="sig-new-side"><Icon name="plus" size={18} /> New signature</button>
      {#if sigs.some((s) => s.remembered)}
        <button class="btn btn-ghost btn-sm forget" onclick={forgetAll} data-testid="sig-forget">Forget saved signatures</button>
      {/if}
    </div>
    <div>
      <p class="label">On this document</p>
      <p class="sum"><b>{placed}</b> signature{placed === 1 ? '' : 's'} placed</p>
      <p class="muted small">Drag to move, use the corner to resize, Delete to remove.</p>
    </div>
  {/snippet}

  {#snippet actions()}
    <button class="btn btn-primary btn-lg" onclick={sign} data-testid="run"><Icon name="sign" size={18} /> Sign PDF</button>
  {/snippet}
</ToolShell>

<style>
  .sig {
    display: block;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .list {
    display: grid;
    gap: 10px;
  }
  .label {
    margin: 0;
  }
  .sigs {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }
  .sigs li {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px 8px;
    align-items: center;
  }
  .pick {
    display: grid;
    place-items: center;
    height: 64px;
    padding: 6px 10px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: #fff;
    cursor: pointer;
  }
  .pick:hover {
    border-color: var(--primary);
  }
  .pick[aria-pressed='true'] {
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--primary-soft), 0 0 0 1px var(--primary);
  }
  .pick img {
    max-height: 100%;
    max-width: 100%;
    object-fit: contain;
  }
  .danger:hover {
    color: var(--danger);
  }
  .saved {
    grid-column: 1 / -1;
    display: inline-flex;
    gap: 4px;
    align-items: center;
    color: var(--safe);
    font-size: 12px;
  }
  .forget {
    justify-self: start;
    color: var(--text-3);
  }
  .sum {
    margin: 4px 0 8px;
    font-size: 16px;
  }
</style>
