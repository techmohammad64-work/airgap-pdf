<script lang="ts">
  import ToolShell from '../ui/ToolShell.svelte'
  import Thumb from '../ui/Thumb.svelte'
  import Icon from '../ui/Icon.svelte'
  import { run } from '../worker/client'
  import { closePdf, confirmLarge, loadPdfFile, type PdfFile } from '../lib/pdfFile'
  import { baseName, errorMessage } from '../lib/files'
  import { chunkPages, formatRanges, parseRanges } from '../core/ranges'
  import type { ToolResult } from '../lib/types'
  import type { ToolPage } from '../lib/site'

  let { page: _page }: { page: ToolPage } = $props()

  type Mode = 'ranges' | 'every' | 'select'

  const COLORS = ['#1f5eff', '#0e7a55', '#c4321f', '#a35a00', '#7a3fd1', '#0b7d8c', '#b8327a', '#4a5568']

  let file = $state<PdfFile | null>(null)
  let mode = $state<Mode>('ranges')
  let rangesText = $state('')
  let everyN = $state(1)
  let selected = $state<boolean[]>([])
  let perPage = $state(false)
  let loading = $state(false)
  let busy = $state(false)
  let error = $state('')
  let result = $state<ToolResult | null>(null)

  const total = $derived(file?.pageCount ?? 0)
  const selectedCount = $derived(selected.filter(Boolean).length)

  /** The output files the current settings would produce, or a message explaining why not. */
  const plan = $derived.by((): { groups: number[][]; problem: string } => {
    if (!file) return { groups: [], problem: '' }
    try {
      if (mode === 'ranges') {
        if (!rangesText.trim()) return { groups: [], problem: 'Enter the pages for each file, for example 1-3, 5, 8-.' }
        return { groups: parseRanges(rangesText, total), problem: '' }
      }
      if (mode === 'every') return { groups: chunkPages(total, Number(everyN)), problem: '' }
      const picked = selected.flatMap((s, i) => (s ? [i] : []))
      if (!picked.length) return { groups: [], problem: 'Click pages to select them.' }
      return { groups: perPage ? picked.map((i) => [i]) : [picked], problem: '' }
    } catch (e) {
      return { groups: [], problem: errorMessage(e) }
    }
  })

  /** Output file number (0-based) for each page, used to colour the thumbnails. */
  const groupOf = $derived.by(() => {
    const m = new Map<number, number>()
    plan.groups.forEach((g, gi) => g.forEach((p) => m.has(p) || m.set(p, gi)))
    return m
  })

  const label = (g: number[]) => formatRanges(g)
  const MAX_LISTED = 6

  async function add(list: File[]) {
    if (!confirmLarge(list)) return
    error = ''
    loading = true
    try {
      const pf = await loadPdfFile(list[0])
      closePdf(file)
      file = pf
      selected = Array.from({ length: pf.pageCount }, () => false)
      if (pf.pageCount < 2) error = 'This PDF has only one page, so there is nothing to split.'
    } catch (e) {
      error = `${list[0].name}: ${errorMessage(e)}`
    }
    loading = false
    result = null
  }

  function toggle(i: number) {
    selected[i] = !selected[i]
  }

  function selectAll(v: boolean) {
    selected = selected.map(() => v)
  }

  function reset() {
    closePdf(file)
    file = null
    selected = []
    rangesText = ''
    result = null
    error = ''
  }

  async function split() {
    error = ''
    if (!file) return
    if (plan.problem || !plan.groups.length) {
      error = plan.problem || 'There are no pages to split.'
      return
    }
    busy = true
    try {
      const base = baseName(file.name)
      const groups = $state.snapshot(plan.groups)
      if (groups.length === 1) {
        const bytes = await run(
          'assemble',
          [file.bytes],
          groups[0].map((index) => ({ kind: 'page' as const, file: 0, index })),
        )
        result = { name: `${base}-split.pdf`, data: bytes, summary: `1 file · pages ${label(groups[0])}` }
      } else {
        const parts = await run('split', file.bytes, groups)
        const zip = await run(
          'makeZip',
          parts.map((bytes, i) => ({ name: `${base}-part-${i + 1}.pdf`, bytes })),
        )
        result = { name: `${base}-split.zip`, data: zip, type: 'application/zip', summary: `${parts.length} PDF files in a ZIP` }
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
  dropLabel="Drop a PDF file here"
  onfiles={add}
  {loading}
  {busy}
  busyText="Splitting…"
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
        {#if mode === 'select'}
          <div class="row">
            <button class="btn btn-sm" onclick={() => selectAll(true)}>Select all</button>
            <button class="btn btn-sm" onclick={() => selectAll(false)} disabled={!selectedCount}>Select none</button>
          </div>
        {:else}
          <span class="muted small">Colours show which file each page goes to</span>
        {/if}
      </div>
      <ul class="grid" aria-label="Pages">
        {#each { length: total } as _, i (i)}
          {@const g = groupOf.get(i)}
          <li>
            {#if mode === 'select'}
              <button
                class="card cell pick"
                class:on={selected[i]}
                aria-pressed={selected[i]}
                aria-label={`Page ${i + 1}`}
                onclick={() => toggle(i)}
              >
                <Thumb doc={file.doc} page={i + 1} width={120} />
                {#if selected[i]}<span class="badge"><Icon name="check" size={14} stroke={3} /></span>{/if}
                <span class="num small"><b>{i + 1}</b></span>
              </button>
            {:else}
              <div class="card cell" class:out={g === undefined} style:--c={g === undefined ? 'transparent' : COLORS[g % COLORS.length]}>
                <Thumb doc={file.doc} page={i + 1} width={120} />
                <span class="num small"><b>{i + 1}</b>{#if g !== undefined}<span class="muted">{` · file ${g + 1}`}</span>{/if}</span>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  {/snippet}

  {#snippet options()}
    <div class="field">
      <span>Split by</span>
      <div class="segmented" role="group" aria-label="Split mode">
        <button aria-pressed={mode === 'ranges'} onclick={() => (mode = 'ranges')}>Page ranges</button>
        <button aria-pressed={mode === 'every'} onclick={() => (mode = 'every')}>Every N pages</button>
        <button aria-pressed={mode === 'select'} onclick={() => (mode = 'select')}>Select pages</button>
      </div>
    </div>

    {#if mode === 'ranges'}
      <label class="field">
        <span>Ranges (one file each)</span>
        <input class="input" bind:value={rangesText} placeholder="1-3, 5, 8-" data-testid="ranges" autocomplete="off" />
        <span class="muted small hint">Separate files with commas. "8-" runs to the last page.</span>
      </label>
    {:else if mode === 'every'}
      <label class="field">
        <span>Pages per file</span>
        <input class="input" type="number" min="1" max={Math.max(1, total)} step="1" bind:value={everyN} data-testid="every" />
      </label>
    {:else}
      <div class="field">
        <span>Selected pages</span>
        <p class="sel">{selectedCount ? `${selectedCount} selected: ${label(selected.flatMap((s, i) => (s ? [i] : [])))}` : 'None yet'}</p>
        <label class="check"><input type="checkbox" bind:checked={perPage} /> One file per page</label>
      </div>
    {/if}

    <div class="preview" data-testid="preview" aria-live="polite">
      <p class="label">Result</p>
      {#if plan.problem}
        <p class="muted small">{plan.problem}</p>
      {:else}
        <p class="sum">
          <b>{plan.groups.length}</b>
          {plan.groups.length === 1 ? 'file' : 'files'}{plan.groups.length > 1 ? ' in a ZIP' : ''}
        </p>
        <ul class="files">
          {#each plan.groups.slice(0, MAX_LISTED) as g, gi (gi)}
            <li><span class="dot" style:background={COLORS[gi % COLORS.length]}></span> {plan.groups.length > 1 ? `Part ${gi + 1}: ` : ''}pages {label(g)}</li>
          {/each}
          {#if plan.groups.length > MAX_LISTED}<li class="muted">and {plan.groups.length - MAX_LISTED} more</li>{/if}
        </ul>
      {/if}
    </div>
  {/snippet}

  {#snippet actions()}
    <button class="btn btn-primary btn-lg" onclick={split} data-testid="run"><Icon name="split" size={18} /> Split PDF</button>
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
  .row {
    display: flex;
    gap: 8px;
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
    position: relative;
    display: grid;
    gap: 6px;
    padding: 8px;
    width: 100%;
    border-top: 3px solid var(--c, transparent);
    text-align: left;
    font: inherit;
    color: inherit;
  }
  .cell.out {
    opacity: 0.45;
  }
  .pick {
    cursor: pointer;
    border-top-width: 1px;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }
  .pick:hover {
    border-color: var(--primary);
  }
  .pick.on {
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--primary);
  }
  .pick.on :global(.thumb)::after {
    content: '';
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--primary) 14%, transparent);
  }
  .badge {
    position: absolute;
    top: 12px;
    right: 12px;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--primary);
    color: #fff;
  }
  .num {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hint {
    font-weight: 400;
  }
  .sel {
    margin: 0 0 4px;
    font-size: 15px;
  }
  .preview {
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }
  .preview p {
    margin: 0;
  }
  .sum {
    margin: 4px 0 6px !important;
    font-size: 18px;
  }
  .files {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
    font-size: 14px;
    color: var(--text-2);
  }
  .files li {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    flex: none;
  }
</style>
