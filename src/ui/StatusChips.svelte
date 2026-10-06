<script lang="ts">
  import Icon from './Icon.svelte'
  import { status, reloadForUpdate } from '../lib/status.svelte'
  import { href } from '../lib/site'

  let open = $state(false)
  const swSupported = 'serviceWorker' in navigator
</script>

<div class="chips">
  {#if status.updateAvailable}
    <button class="chip chip-info" onclick={reloadForUpdate} title="A newer version is available">
      <Icon name="rotate" size={14} /> Update
    </button>
  {/if}
  <button class="chip" class:chip-safe={!status.online} onclick={() => (open = !open)} aria-expanded={open} data-testid="connection-chip">
    {#if status.online}
      <Icon name="wifi" size={14} /> <span>Online <span class="sep">·</span> <b>files stay local</b></span>
    {:else}
      <Icon name="plane" size={14} /> <span>Offline <span class="sep">·</span> <b>working locally</b></span>
    {/if}
  </button>
  {#if swSupported}
    <button class="chip" class:chip-safe={status.offlineReady} onclick={() => (open = !open)} data-testid="offline-chip">
      {#if status.offlineReady}
        <Icon name="check-circle" size={14} /> <span>Ready offline</span>
      {:else}
        <span class="spinner small-spin"></span> <span>Preparing offline</span>
      {/if}
    </button>
  {/if}

  {#if open}
    <div class="pop card" role="dialog" aria-label="How AirgapPDF protects your files">
      <button class="icon-btn close" onclick={() => (open = false)} aria-label="Close"><Icon name="x" size={16} /></button>
      <h3><Icon name="shield-check" size={18} /> Your files never leave this device</h3>
      <p>Every tool runs inside your browser. Files are read into memory here, processed here and saved back to your device.</p>
      {#if status.offlineReady}
        <p class="ok"><Icon name="check" size={16} /> The whole app is stored on this device. You can disconnect from the internet now and everything keeps working.</p>
      {:else if swSupported}
        <p>Saving the app to this device for offline use…</p>
      {/if}
      <a href={href('privacy')}>See how to verify it yourself <Icon name="arrow-right" size={14} /></a>
    </div>
  {/if}
</div>

<style>
  .chips {
    position: relative;
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 10px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-2);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
  }
  .chip b {
    font-weight: 600;
  }
  .chip-safe {
    background: var(--safe-soft);
    border-color: transparent;
    color: var(--safe);
  }
  .chip-info {
    background: var(--primary-soft);
    color: var(--primary);
    border-color: transparent;
  }
  .sep {
    opacity: 0.5;
  }
  .small-spin {
    width: 12px;
    height: 12px;
    border-width: 1.5px;
  }
  .pop {
    position: absolute;
    right: 0;
    top: 40px;
    width: min(360px, calc(100vw - 32px));
    padding: 18px;
    z-index: 50;
    box-shadow: var(--shadow-lg);
    font-size: 14px;
    color: var(--text-2);
  }
  .pop h3 {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 16px;
    color: var(--text);
    padding-right: 28px;
  }
  .pop .close {
    position: absolute;
    right: 10px;
    top: 10px;
    border: 0;
  }
  .ok {
    display: flex;
    gap: 8px;
    color: var(--safe);
  }
  .pop a {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
  }
  @media (max-width: 640px) {
    .chip span:not(.spinner) {
      display: none;
    }
    .pop {
      position: fixed;
      left: 16px;
      right: 16px;
      top: 64px;
      width: auto;
    }
  }
</style>
