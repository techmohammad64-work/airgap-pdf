<script lang="ts">
  let { size = 30 }: { size?: number } = $props()
</script>

<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
  <rect width="32" height="32" rx="8" class="bg" />
  <path d="M9 6.5h9.5l5 5V15H9z" class="doc" />
  <path d="M9 18h14.5v7.5H9z" class="doc" />
  <path d="M18.5 6.5v5h5" class="fold" />
  <circle cx="24.5" cy="24.5" r="5.5" class="badge" />
  <path d="M22 24.6l1.7 1.7 3.1-3.3" class="tick" />
</svg>

<style>
  .bg {
    fill: var(--brand);
  }
  .doc {
    fill: var(--brand-contrast);
  }
  .fold {
    fill: none;
    stroke: var(--brand);
    stroke-width: 1.2;
    stroke-linejoin: round;
  }
  .badge {
    fill: var(--safe);
    stroke: var(--brand);
    stroke-width: 1.6;
  }
  .tick {
    fill: none;
    stroke: #fff;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
