<script lang="ts">
  // One page canvas of the PageEditor. Renders lazily when near the viewport,
  // re-renders when the zoom changes and frees its canvas when far away.
  import { onMount } from 'svelte'
  import { renderPage, type PDFDocumentProxy } from '../render/pdfjs'

  let {
    doc,
    index,
    width,
    height,
    scale,
  }: {
    doc: PDFDocumentProxy
    /** 0-based page index */
    index: number
    /** Visual page size in points */
    width: number
    height: number
    /** CSS px per point */
    scale: number
  } = $props()

  /** Keep canvases under ~12 megapixels, whatever the zoom or screen. */
  const MAX_PIXELS = 12e6

  let host: HTMLDivElement
  let near = $state(false)
  let ready = $state(false)
  let rendered = 0
  let gen = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  function target() {
    const dpr = window.devicePixelRatio || 1
    let rs = scale * dpr
    const px = width * height * rs * rs
    if (px > MAX_PIXELS) rs *= Math.sqrt(MAX_PIXELS / px)
    return rs
  }

  async function draw() {
    const rs = target()
    if (Math.abs(rs - rendered) < 0.01) return
    const my = ++gen
    try {
      const page = await doc.getPage(index + 1)
      const canvas = await renderPage(page, rs)
      if (my !== gen || !near) {
        canvas.width = canvas.height = 0
        return
      }
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
      canvas.setAttribute('aria-hidden', 'true')
      const old = host.querySelector('canvas')
      host.replaceChildren(canvas)
      if (old) old.width = old.height = 0
      rendered = rs
      ready = true
    } catch {
      // Document destroyed or render failed: leave the blank page.
    }
  }

  function free() {
    gen++
    const old = host?.querySelector('canvas')
    if (old) {
      old.width = old.height = 0
      old.remove()
    }
    rendered = 0
    ready = false
  }

  $effect(() => {
    // Depend on scale and visibility; debounce so resizing/zooming stays smooth.
    void scale
    if (!near) return
    clearTimeout(timer)
    timer = setTimeout(draw, rendered ? 150 : 0)
  })

  onMount(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1]
        near = e.isIntersecting
        if (!near) free()
      },
      { rootMargin: '1200px 0px' },
    )
    io.observe(host)
    return () => {
      io.disconnect()
      clearTimeout(timer)
      free()
    }
  })
</script>

<div class="canvas-host" bind:this={host}></div>
{#if !ready}<span class="ph spinner" aria-hidden="true"></span>{/if}

<style>
  .canvas-host {
    position: absolute;
    inset: 0;
  }
  .ph {
    position: absolute;
    left: calc(50% - 9px);
    top: calc(50% - 9px);
    color: var(--border-strong);
  }
</style>
