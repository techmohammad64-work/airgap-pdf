<script lang="ts">
  import type { Snippet } from 'svelte'
  import Dropzone from './Dropzone.svelte'
  import Icon from './Icon.svelte'
  import PrivacyHint from './PrivacyHint.svelte'
  import { download, formatBytes } from '../lib/files'
  import type { ToolResult } from '../lib/types'

  let {
    empty,
    accept = 'pdf',
    multiple = false,
    dropLabel,
    onfiles,
    loading = false,
    busy = false,
    busyText = 'Working…',
    error = '',
    result = null,
    onreset,
    oncontinue,
    workspace,
    options,
    actions,
  }: {
    empty: boolean
    accept?: 'pdf' | 'image'
    multiple?: boolean
    dropLabel?: string
    onfiles: (files: File[]) => void
    loading?: boolean
    busy?: boolean
    busyText?: string
    error?: string
    result?: ToolResult | null
    onreset: () => void
    /** If given, the result panel offers "Keep editing". */
    oncontinue?: () => void
    workspace: Snippet
    options?: Snippet
    actions: Snippet
  } = $props()

  const size = (d: Uint8Array | Blob) => formatBytes(d instanceof Blob ? d.size : d.byteLength)
  const save = (r: ToolResult) => download(r.data, r.name, r.type)

  // Save automatically the moment a new result arrives.
  let last: ToolResult | null = null
  $effect(() => {
    if (result && result !== last) {
      last = result
      save(result)
    }
  })
</script>

{#if empty}
  {#if loading}
    <div class="loading card"><span class="spinner"></span> Opening file on this device…</div>
  {:else}
    <Dropzone {accept} {multiple} label={dropLabel} {onfiles} />
  {/if}
  {#if error}<p class="notice notice-error top" role="alert"><Icon name="alert" size={18} /> {error}</p>{/if}
{:else}
  <div class="shell">
    <section class="workspace" aria-label="Workspace">
      {@render workspace()}
    </section>
    <aside class="side">
      {#if result}
        <div class="result card" role="status" data-testid="result">
          <div class="ok"><Icon name="check-circle" size={22} /> Done</div>
          <p class="fname" title={result.name}>{result.name}</p>
          <p class="muted small">{size(result.data)}{result.summary ? ` · ${result.summary}` : ''}</p>
          <p class="local small"><Icon name="lock" size={14} /> Created on this device. Nothing was uploaded.</p>
          <button class="btn btn-primary" onclick={() => save(result!)} data-testid="download"><Icon name="download" size={18} /> Download again</button>
          <div class="row">
            {#if oncontinue}<button class="btn" onclick={oncontinue}>Keep editing</button>{/if}
            <button class="btn" onclick={onreset}>Start over</button>
          </div>
        </div>
      {:else}
        {#if options}
          <div class="options card">{@render options()}</div>
        {/if}
        {#if error}<p class="notice notice-error" role="alert"><Icon name="alert" size={18} /> <span>{error}</span></p>{/if}
        <div class="actions">
          {#if busy || loading}
            <button class="btn btn-primary btn-lg" disabled><span class="spinner"></span> {busy ? busyText : 'Opening files…'}</button>
          {:else}
            {@render actions()}
          {/if}
          <button class="btn btn-ghost btn-sm reset" onclick={onreset}><Icon name="x" size={14} /> Remove files and start over</button>
        </div>
      {/if}
    </aside>
  </div>
  <PrivacyHint />
{/if}

<style>
  .shell {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 20px;
    align-items: start;
  }
  .workspace {
    min-width: 0;
  }
  .side {
    position: sticky;
    top: 80px;
    display: grid;
    gap: 12px;
  }
  .options {
    padding: 16px;
    display: grid;
    gap: 16px;
  }
  .actions {
    display: grid;
    gap: 8px;
  }
  .actions :global(.btn-primary) {
    width: 100%;
  }
  .reset {
    justify-self: center;
    color: var(--text-3);
  }
  .result {
    padding: 20px;
    display: grid;
    gap: 8px;
  }
  .result .ok {
    display: flex;
    gap: 8px;
    align-items: center;
    color: var(--safe);
    font-weight: 700;
    font-size: 20px;
  }
  .fname {
    margin: 0;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .result p {
    margin: 0;
  }
  .local {
    display: flex;
    gap: 6px;
    align-items: center;
    color: var(--safe);
  }
  .row {
    display: flex;
    gap: 8px;
  }
  .row .btn {
    flex: 1;
  }
  .loading {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: center;
    min-height: 280px;
    color: var(--text-2);
  }
  .top {
    margin-top: 12px;
  }
  @media (max-width: 900px) {
    .shell {
      grid-template-columns: 1fr;
    }
    .side {
      position: static;
    }
    .actions {
      position: sticky;
      bottom: 0;
      padding: 12px 0;
      background: linear-gradient(transparent, var(--bg) 30%);
      z-index: 5;
    }
  }
</style>
