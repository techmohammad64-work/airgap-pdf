<script lang="ts">
  import Icon from './Icon.svelte'
  import { status } from '../lib/status.svelte'

  const KEY = 'airgap-hint-seen'
  let seen = true
  try {
    seen = localStorage.getItem(KEY) === '1'
  } catch {}
  let show = $state(!seen && status.online)

  function dismiss() {
    show = false
    try {
      localStorage.setItem(KEY, '1')
    } catch {}
  }

  $effect(() => {
    if (!status.online && show) {
      // They took the hint. Mark it seen but let them see the confirmation.
      try {
        localStorage.setItem(KEY, '1')
      } catch {}
    }
  })
</script>

{#if show}
  <div class="hint card" role="status">
    {#if status.online}
      <Icon name="wifi-off" size={20} />
      <p><b>Want proof?</b> Turn off your internet and keep going. Everything still works, because your file never leaves this device.</p>
    {:else}
      <Icon name="plane" size={20} />
      <p><b>You're offline</b> and everything still works. Your file is being processed only on this device.</p>
    {/if}
    <button class="icon-btn" onclick={dismiss} aria-label="Dismiss"><Icon name="x" size={16} /></button>
  </div>
{/if}

<style>
  .hint {
    position: fixed;
    left: 50%;
    bottom: 20px;
    transform: translateX(-50%);
    width: min(560px, calc(100vw - 32px));
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 12px 14px;
    z-index: 60;
    box-shadow: var(--shadow-lg);
    border-color: color-mix(in srgb, var(--safe) 40%, var(--border));
  }
  .hint :global(svg:first-child) {
    color: var(--safe);
    flex: none;
  }
  .hint p {
    margin: 0;
    font-size: 14px;
    color: var(--text-2);
  }
  .hint b {
    color: var(--text);
  }
  .icon-btn {
    flex: none;
    margin-left: auto;
  }
  @media (min-width: 901px) {
    .hint {
      left: auto;
      right: 24px;
      transform: none;
      width: 320px;
    }
  }
  @media (max-width: 900px) {
    .hint {
      bottom: 88px;
    }
  }
</style>
