<script lang="ts">
  import { onMount } from 'svelte'
  import Header from './ui/Header.svelte'
  import Footer from './ui/Footer.svelte'
  import Home from './pages/Home.svelte'
  import ToolPage from './pages/ToolPage.svelte'
  import Privacy from './pages/Privacy.svelte'
  import NotFound from './pages/NotFound.svelte'
  import { findPage } from './lib/site'

  const ds = document.body.dataset
  const kind = ds.page ?? 'home'
  const tool = findPage(ds.slug)

  let seoSlot: HTMLDivElement
  onMount(() => {
    // The static SEO article is rendered into the HTML for crawlers; move it above the footer.
    const seo = document.getElementById('seo')
    if (seo && seoSlot) seoSlot.appendChild(seo)
  })
</script>

<Header />
<main id="main">
  {#if kind === 'tool' && tool}
    <ToolPage page={tool} />
  {:else if kind === 'home'}
    <Home />
  {:else if kind === 'privacy'}
    <Privacy />
  {:else}
    <NotFound />
  {/if}
  <div bind:this={seoSlot}></div>
</main>
<Footer />

<style>
  main {
    min-height: calc(100vh - 64px);
    padding-bottom: 48px;
  }
</style>
