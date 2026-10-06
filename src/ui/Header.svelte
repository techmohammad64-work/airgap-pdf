<script lang="ts">
  import Logo from './Logo.svelte'
  import Icon from './Icon.svelte'
  import StatusChips from './StatusChips.svelte'
  import { href } from '../lib/site'
  import { theme, setTheme } from '../lib/theme.svelte'

  const next = { system: 'light', light: 'dark', dark: 'system' } as const
  const icon = { system: 'monitor', light: 'sun', dark: 'moon' } as const
</script>

<a class="skip" href="#main">Skip to content</a>
<header>
  <div class="container bar">
    <a class="brand" href={href()} aria-label="AirgapPDF home">
      <Logo />
      <span class="word">Airgap<span>PDF</span></span>
    </a>
    <nav aria-label="Main">
      <a href={href() + '#tools'}>All tools</a>
      <a href={href('privacy')}>How we prove it</a>
    </nav>
    <div class="right">
      <StatusChips />
      <button
        class="icon-btn"
        onclick={() => setTheme(next[theme.value])}
        aria-label={`Colour theme: ${theme.value}. Switch to ${next[theme.value]}`}
        title={`Theme: ${theme.value}`}><Icon name={icon[theme.value]} size={16} /></button>
    </div>
  </div>
</header>

<style>
  header {
    position: sticky;
    top: 0;
    z-index: 40;
    background: color-mix(in srgb, var(--bg) 85%, transparent);
    backdrop-filter: saturate(1.4) blur(10px);
    border-bottom: 1px solid var(--border);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 24px;
    height: 64px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: var(--text);
  }
  .word {
    font-weight: 800;
    font-size: 19px;
    letter-spacing: -0.02em;
  }
  .word span {
    color: var(--safe);
  }
  nav {
    display: flex;
    gap: 20px;
  }
  nav a {
    color: var(--text-2);
    text-decoration: none;
    font-weight: 500;
    font-size: 15px;
  }
  nav a:hover {
    color: var(--text);
  }
  .right {
    margin-left: auto;
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .skip {
    position: absolute;
    left: -999px;
  }
  .skip:focus {
    left: 16px;
    top: 8px;
    z-index: 100;
    background: var(--surface);
    padding: 8px 12px;
    border-radius: 8px;
  }
  @media (max-width: 820px) {
    nav {
      display: none;
    }
  }
</style>
