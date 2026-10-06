<script lang="ts">
  import type { Component } from 'svelte'
  import Icon from '../ui/Icon.svelte'
  import { href, type ToolPage } from '../lib/site'

  let { page }: { page: ToolPage } = $props()

  const loaders: Record<string, () => Promise<{ default: Component<{ page: ToolPage }> }>> = {
    merge: () => import('../tools/Merge.svelte'),
    split: () => import('../tools/Split.svelte'),
    organize: () => import('../tools/Organize.svelte'),
    'images-to-pdf': () => import('../tools/ImagesToPdf.svelte'),
    'pdf-to-images': () => import('../tools/PdfToImages.svelte'),
    sign: () => import('../tools/Sign.svelte'),
    'add-text': () => import('../tools/AddText.svelte'),
    watermark: () => import('../tools/Watermark.svelte'),
    'page-numbers': () => import('../tools/PageNumbers.svelte'),
    'fill-form': () => import('../tools/FillForm.svelte'),
    redact: () => import('../tools/Redact.svelte'),
  }
  const loading = $derived(loaders[page.tool]?.())
</script>

<div class="container">
  <nav class="crumbs" aria-label="Breadcrumb"><a href={href()}>All tools</a> <Icon name="chevron-right" size={14} /> <span>{page.name}</span></nav>
  <div class="title">
    <h1>{page.h1}</h1>
    <p class="sub">{page.description}</p>
  </div>
</div>

<div class="container tool-area">
  {#await loading}
    <div class="loading"><span class="spinner"></span> Loading tool…</div>
  {:then mod}
    {#if mod}
      <mod.default {page} />
    {/if}
  {:catch}
    <p class="notice notice-error">This tool failed to load. Please refresh the page.</p>
  {/await}
</div>

<style>
  .crumbs {
    display: flex;
    gap: 6px;
    align-items: center;
    padding-top: 24px;
    font-size: 14px;
    color: var(--text-3);
  }
  .crumbs a {
    color: var(--text-2);
    text-decoration: none;
  }
  .title {
    padding: 12px 0 20px;
  }
  h1 {
    font-size: clamp(26px, 3.4vw, 36px);
    margin-bottom: 6px;
  }
  .sub {
    color: var(--text-2);
    margin: 0;
    max-width: 720px;
  }
  .loading {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: center;
    padding: 80px 0;
    color: var(--text-3);
  }
</style>
