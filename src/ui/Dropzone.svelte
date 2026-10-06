<script lang="ts">
  import Icon from './Icon.svelte'
  import { isImage, isPdf } from '../lib/files'
  import { status } from '../lib/status.svelte'

  let {
    accept = 'pdf',
    multiple = false,
    compact = false,
    label,
    onfiles,
  }: {
    accept?: 'pdf' | 'image'
    multiple?: boolean
    compact?: boolean
    label?: string
    onfiles: (files: File[]) => void
  } = $props()

  let input: HTMLInputElement
  let over = $state(false)
  let error = $state('')
  let depth = 0

  const acceptAttr = $derived(accept === 'pdf' ? 'application/pdf,.pdf' : 'image/*')
  const check = (f: File) => (accept === 'pdf' ? isPdf(f) : isImage(f))
  const noun = $derived(accept === 'pdf' ? (multiple ? 'PDF files' : 'a PDF file') : multiple ? 'images' : 'an image')

  function take(list: FileList | null | undefined) {
    const files = [...(list ?? [])]
    if (!files.length) return
    const ok = files.filter(check)
    error = ok.length < files.length ? `Skipped ${files.length - ok.length} file(s) that ${accept === 'pdf' ? "aren't PDFs" : "aren't images"}.` : ''
    if (ok.length) onfiles(multiple ? ok : ok.slice(0, 1))
  }
</script>

<div
  class="zone"
  class:over
  class:compact
  role="button"
  tabindex="0"
  aria-label={label ?? `Choose ${noun}`}
  ondragenter={(e) => {
    e.preventDefault()
    depth++
    over = true
  }}
  ondragover={(e) => e.preventDefault()}
  ondragleave={() => {
    if (--depth <= 0) over = false
  }}
  ondrop={(e) => {
    e.preventDefault()
    depth = 0
    over = false
    take(e.dataTransfer?.files)
  }}
  onclick={() => input.click()}
  onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.click())}
>
  <input
    bind:this={input}
    type="file"
    accept={acceptAttr}
    {multiple}
    hidden
    data-testid="file-input"
    onchange={(e) => {
      take(e.currentTarget.files)
      e.currentTarget.value = ''
    }}
  />
  {#if compact}
    <Icon name="plus" size={18} /> <span>{label ?? `Add ${noun}`}</span>
  {:else}
    <span class="big-icon"><Icon name={accept === 'pdf' ? 'file-plus' : 'image'} size={30} /></span>
    <span class="cta">{label ?? `Drop ${noun} here`}</span>
    <span class="or">or <u>choose {multiple ? 'files' : 'a file'}</u> from your device</span>
    <span class="safe">
      <Icon name={status.online ? 'lock' : 'plane'} size={14} />
      {status.online ? 'Processed on this device. Never uploaded.' : 'Offline. Processing locally on this device.'}
    </span>
  {/if}
</div>
{#if error}<p class="notice notice-warn small err">{error}</p>{/if}

<style>
  .zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 280px;
    padding: 32px 16px;
    border: 2px dashed var(--border-strong);
    border-radius: var(--radius);
    background: var(--surface);
    text-align: center;
    cursor: pointer;
    transition:
      border-color 0.15s,
      background 0.15s;
  }
  .zone:hover,
  .zone.over {
    border-color: var(--primary);
    background: color-mix(in srgb, var(--primary-soft) 60%, var(--surface));
  }
  .big-icon {
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    border-radius: 16px;
    background: var(--primary-soft);
    color: var(--primary);
    margin-bottom: 8px;
  }
  .cta {
    font-size: 20px;
    font-weight: 700;
  }
  .or {
    color: var(--text-2);
  }
  .or u {
    color: var(--primary);
    text-decoration-thickness: 1px;
  }
  .safe {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 14px;
    padding: 4px 12px;
    border-radius: 999px;
    background: var(--safe-soft);
    color: var(--safe);
    font-size: 13px;
    font-weight: 600;
  }
  .compact {
    flex-direction: row;
    min-height: 0;
    padding: 10px 14px;
    border-width: 1.5px;
    font-weight: 600;
    color: var(--text-2);
    gap: 8px;
  }
  .err {
    margin-top: 8px;
  }
</style>
