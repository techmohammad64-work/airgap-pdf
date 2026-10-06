<script lang="ts">
  import type { Snippet } from 'svelte'
  import Thumb from './Thumb.svelte'
  import { pageSize, type PDFDocumentProxy } from '../render/pdfjs'

  let {
    doc,
    page,
    width = 560,
    dimmed = false,
    overlay,
  }: {
    doc: PDFDocumentProxy
    /** 1-based page number */
    page: number
    /** Render resolution in CSS px. */
    width?: number
    /** Fade the page (e.g. when it is not affected by the current settings). */
    dimmed?: boolean
    /** Draws the overlay; receives px-per-point scale and the visual page size in points. */
    overlay: Snippet<[number, number, number]>
  } = $props()

  let size = $state<{ width: number; height: number } | null>(null)
  let stageWidth = $state(0)

  $effect(() => {
    const d = doc
    const p = page
    let live = true
    d.getPage(p)
      .then((pg) => {
        if (live) size = pageSize(pg)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  })

  const scale = $derived(size && stageWidth ? stageWidth / size.width : 0)
</script>

<div class="stage" class:dimmed bind:clientWidth={stageWidth}>
  {#key page}
    <Thumb {doc} {page} {width} />
  {/key}
  {#if scale && size}
    <div class="overlay" aria-hidden="true">{@render overlay(scale, size.width, size.height)}</div>
  {/if}
</div>

<style>
  .stage {
    position: relative;
    width: 100%;
    container-type: inline-size;
  }
  .overlay {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    border-radius: 4px;
  }
  .dimmed :global(.thumb) {
    opacity: 0.55;
  }
</style>
