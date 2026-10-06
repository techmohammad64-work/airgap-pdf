<script lang="ts">
  import ToolShell from '../ui/ToolShell.svelte'
  import Thumb from '../ui/Thumb.svelte'
  import Icon from '../ui/Icon.svelte'
  import { humanise } from '../ui/StampFonts'
  import { run } from '../worker/client'
  import { closePdf, confirmLarge, loadPdfFile, type PdfFile } from '../lib/pdfFile'
  import { baseName, errorMessage } from '../lib/files'
  import { href, type ToolPage } from '../lib/site'
  import type { ToolResult } from '../lib/types'
  import type { FieldInfo, FieldValue } from '../core/forms'

  let { page: _page }: { page: ToolPage } = $props()

  let file = $state<PdfFile | null>(null)
  let fields = $state<FieldInfo[]>([])
  let values = $state<Record<string, FieldValue>>({})
  let flatten = $state(false)
  let loading = $state(false)
  let busy = $state(false)
  let error = $state('')
  let result = $state<ToolResult | null>(null)

  const editable = $derived(fields.filter((f) => !f.readOnly))
  const filled = $derived(
    editable.filter((f) => {
      const v = values[f.name]
      return Array.isArray(v) ? v.length > 0 : typeof v === 'boolean' ? v : !!v
    }).length,
  )
  const pageNums = $derived(file ? Array.from({ length: Math.min(file.pageCount, 50) }, (_, i) => i + 1) : [])
  const fid = (name: string) => `ff-${name.replace(/[^\w-]/g, '_')}`

  async function add(list: File[]) {
    if (!confirmLarge(list)) return
    error = ''
    loading = true
    try {
      const pf = await loadPdfFile(list[0])
      let found: FieldInfo[] = []
      try {
        found = await run('listFields', pf.bytes)
      } catch (e) {
        closePdf(pf)
        throw e
      }
      closePdf(file)
      file = pf
      fields = found
      values = Object.fromEntries(found.map((f) => [f.name, Array.isArray(f.value) ? [...f.value] : f.value]))
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
    fields = []
    values = {}
    flatten = false
    result = null
    error = ''
  }

  function clearAll() {
    for (const f of editable) values[f.name] = f.type === 'checkbox' ? false : f.type === 'list' ? [] : ''
  }

  async function apply() {
    if (!file) return
    error = ''
    if (!fields.length) {
      error = 'This PDF has no fillable fields.'
      return
    }
    busy = true
    try {
      const out: Record<string, FieldValue> = {}
      for (const f of editable) {
        const v = values[f.name]
        out[f.name] = Array.isArray(v) ? [...v] : v
      }
      const bytes = await run('fillForm', file.bytes, out, flatten)
      result = {
        name: `${baseName(file.name)}-filled.pdf`,
        data: bytes,
        summary: `${filled} of ${editable.length} fields filled${flatten ? ' · flattened' : ''}`,
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
  dropLabel="Drop a PDF form here"
  onfiles={add}
  {loading}
  {busy}
  busyText="Filling form…"
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
          <span class="muted small">· {file.pageCount} {file.pageCount === 1 ? 'page' : 'pages'}</span>
        </div>
        {#if fields.length}<span class="muted small">{fields.length} {fields.length === 1 ? 'field' : 'fields'}</span>{/if}
      </div>

      {#if !fields.length}
        <div class="notice notice-info" data-testid="no-fields">
          <Icon name="info" size={18} />
          <div>
            <b>This PDF doesn't have fillable fields.</b>
            <p>
              It may be a scanned document, a flat PDF that only looks like a form, or an XFA form that browsers can't edit. You can still type onto
              it with the <a href={href('add-text-to-pdf')}>Add text</a> tool.
            </p>
          </div>
        </div>
        <div class="pages solo">
          <Thumb doc={file.doc} page={1} width={360} />
        </div>
      {:else}
        <div class="split">
          <div class="pages" aria-label="Page previews">
            {#each pageNums as n (n)}
              <figure>
                <Thumb doc={file.doc} page={n} width={360} />
                {#if file.pageCount > 1}<figcaption class="muted small">Page {n}</figcaption>{/if}
              </figure>
            {/each}
            {#if file.pageCount > pageNums.length}<p class="muted small">Showing the first {pageNums.length} pages.</p>{/if}
          </div>

          <form class="card form" aria-label="Form fields" onsubmit={(e) => e.preventDefault()}>
            <div class="form-head">
              <b>Fields</b>
              <button type="button" class="btn btn-ghost btn-sm" onclick={clearAll}>Clear all</button>
            </div>
            {#each fields as f (f.name)}
              {@const id = fid(f.name)}
              {#if f.type === 'text'}
                <div class="field">
                  <label for={id}>{humanise(f.name)}{#if f.readOnly}<em> (read only)</em>{/if}</label>
                  {#if f.multiline}
                    <textarea
                      {id}
                      class="input"
                      rows="3"
                      maxlength={f.maxLength}
                      disabled={f.readOnly}
                      bind:value={values[f.name] as string}
                      data-testid={`field-${f.name}`}
                    ></textarea>
                  {:else}
                    <input
                      {id}
                      class="input"
                      maxlength={f.maxLength}
                      disabled={f.readOnly}
                      bind:value={values[f.name] as string}
                      data-testid={`field-${f.name}`}
                    />
                  {/if}
                  {#if f.maxLength}<p class="hint muted">{String(values[f.name] ?? '').length} / {f.maxLength}</p>{/if}
                </div>
              {:else if f.type === 'checkbox'}
                <label class="check box">
                  <input type="checkbox" disabled={f.readOnly} bind:checked={values[f.name] as boolean} data-testid={`field-${f.name}`} />
                  <span>{humanise(f.name)}{#if f.readOnly}<em> (read only)</em>{/if}</span>
                </label>
              {:else if f.type === 'dropdown'}
                <div class="field">
                  <label for={id}>{humanise(f.name)}{#if f.readOnly}<em> (read only)</em>{/if}</label>
                  <select {id} class="input" disabled={f.readOnly} bind:value={values[f.name] as string} data-testid={`field-${f.name}`}>
                    <option value="">Choose…</option>
                    {#each f.options as o (o)}<option value={o}>{o}</option>{/each}
                  </select>
                </div>
              {:else if f.type === 'radio'}
                <fieldset class="field radios" disabled={f.readOnly} data-testid={`field-${f.name}`}>
                  <legend>{humanise(f.name)}{#if f.readOnly}<em> (read only)</em>{/if}</legend>
                  {#each f.options as o (o)}
                    <label class="check"><input type="radio" name={id} value={o} bind:group={values[f.name]} /> {o}</label>
                  {/each}
                </fieldset>
              {:else if f.type === 'list'}
                <div class="field">
                  <label for={id}>{humanise(f.name)}{#if f.readOnly}<em> (read only)</em>{/if}</label>
                  <select
                    {id}
                    class="input"
                    multiple
                    size={Math.min(6, Math.max(3, f.options.length))}
                    disabled={f.readOnly}
                    bind:value={values[f.name] as string[]}
                    data-testid={`field-${f.name}`}
                  >
                    {#each f.options as o (o)}<option value={o}>{o}</option>{/each}
                  </select>
                  <p class="hint muted">Hold Ctrl (or Cmd) to pick several.</p>
                </div>
              {/if}
            {/each}
          </form>
        </div>
      {/if}
    {/if}
  {/snippet}

  {#snippet options()}
    {#if fields.length}
      <div>
        <p class="label">Progress</p>
        <p class="sum"><b>{filled}</b> of <b>{editable.length}</b> fields filled</p>
      </div>
      <label class="check flat">
        <input type="checkbox" bind:checked={flatten} data-testid="flatten" />
        <span>Flatten (lock answers so they can't be changed)</span>
      </label>
    {:else}
      <p class="muted small">There is nothing to fill in this file. Try the Add text tool to type anywhere on the page.</p>
      <a class="btn" href={href('add-text-to-pdf')}><Icon name="type" size={16} /> Open Add text</a>
    {/if}
  {/snippet}

  {#snippet actions()}
    <button class="btn btn-primary btn-lg" onclick={apply} disabled={!fields.length} data-testid="run"><Icon name="form" size={18} /> Save filled PDF</button>
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
  .split {
    display: grid;
    grid-template-columns: minmax(0, 360px) minmax(0, 1fr);
    gap: 20px;
    align-items: start;
  }
  .pages {
    display: grid;
    gap: 14px;
  }
  .pages.solo {
    max-width: 360px;
    margin: 16px auto 0;
  }
  figure {
    margin: 0;
    display: grid;
    gap: 6px;
    justify-items: center;
  }
  .form {
    padding: 16px;
    display: grid;
    gap: 14px;
    position: sticky;
    top: 80px;
    max-height: calc(100vh - 100px);
    overflow: auto;
  }
  .form-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }
  .field > label:not(.check),
  legend {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-2);
  }
  em {
    font-weight: 400;
    color: var(--text-3);
  }
  .radios {
    border: 0;
    padding: 0;
    margin: 0;
    gap: 6px;
  }
  .radios legend {
    padding: 0;
    margin-bottom: 6px;
  }
  .box {
    padding: 2px 0;
  }
  .check input:disabled + span,
  fieldset:disabled .check {
    opacity: 0.6;
  }
  .hint {
    margin: 0;
    font-size: 12px;
    align-self: flex-end;
  }
  .notice p {
    margin: 4px 0 0;
  }
  .notice a {
    font-weight: 600;
  }
  .sum {
    margin: 4px 0 0;
    font-size: 18px;
  }
  .label {
    margin: 0;
  }
  .flat {
    align-items: flex-start;
  }
  .flat input {
    margin-top: 4px;
    flex: none;
  }
  @media (max-width: 760px) {
    .split {
      grid-template-columns: 1fr;
    }
    .form {
      position: static;
      max-height: none;
      order: -1;
    }
    .pages {
      max-width: 360px;
      margin: 0 auto;
      width: 100%;
    }
  }
</style>
