<script lang="ts" module>
  import type { PDFDocumentProxy } from '../render/pdfjs'
  // Rendered thumbnails, cached per document so re-renders and reorders are free.
  const cache = new WeakMap<PDFDocumentProxy, Map<string, Promise<string>>>()
</script>

<script lang="ts">
  import { onMount } from 'svelte'
  import { thumbnailUrl } from '../render/pdfjs'

  let {
    doc,
    page,
    rotate = 0,
    width = 150,
  }: {
    doc: PDFDocumentProxy
    /** 1-based page number */
    page: number
    /** Extra clockwise rotation to preview, in degrees. */
    rotate?: number
    width?: number
  } = $props()

  let el: HTMLDivElement
  let src = $state('')
  let ratio = $state(1.414)

  function load() {
    let m = cache.get(doc)
    if (!m) cache.set(doc, (m = new Map()))
    const key = `${page}:${width}`
    let p = m.get(key)
    if (!p) m.set(key, (p = doc.getPage(page).then((pg) => thumbnailUrl(pg, width))))
    p.then((u) => (src = u)).catch(() => {})
    doc.getPage(page).then((pg) => {
      const v = pg.getViewport({ scale: 1 })
      ratio = v.height / v.width
    })
  }

  onMount(() => {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          load()
        }
      },
      { rootMargin: '300px' },
    )
    io.observe(el)
    return () => io.disconnect()
  })

  const sideways = $derived(((rotate % 180) + 180) % 180 === 90)
</script>

<div class="thumb" bind:this={el} style:aspect-ratio={sideways ? `${ratio} / 1` : `1 / ${ratio}`}>
  {#if src}
    <img
      {src}
      alt={`Page ${page}`}
      draggable="false"
      style:transform={`rotate(${rotate}deg)`}
      style:width={sideways ? `${100 / ratio}%` : '100%'}
    />
  {:else}
    <span class="ph spinner"></span>
  {/if}
</div>

<style>
  .thumb {
    position: relative;
    width: 100%;
    display: grid;
    place-items: center;
    background: var(--page-bg);
    border-radius: 4px;
    box-shadow: 0 0 0 1px var(--border), var(--shadow-sm);
    overflow: hidden;
  }
  img {
    display: block;
    max-width: none;
    transition: transform 0.2s;
  }
  .ph {
    color: var(--border-strong);
  }
</style>
