<script lang="ts">
  // Toggle button for the PageEditor toolbar (placement tools).
  import Icon from './Icon.svelte'

  let {
    icon,
    label,
    pressed = false,
    testid,
    onclick,
  }: { icon: string; label: string; pressed?: boolean; testid?: string; onclick: () => void } = $props()
</script>

<button class="tool" aria-pressed={pressed} data-testid={testid} {onclick}>
  <Icon name={icon} size={18} />
  <span>{label}</span>
</button>

<style>
  .tool {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-2);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s,
      color 0.15s;
  }
  .tool:hover {
    background: var(--surface-2);
    color: var(--text);
  }
  .tool[aria-pressed='true'] {
    background: var(--primary-soft);
    border-color: var(--primary);
    color: var(--primary);
  }
  @media (max-width: 520px) {
    .tool {
      padding: 6px 10px;
    }
  }
</style>
