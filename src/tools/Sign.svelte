<script lang="ts">
  import type { ToolPage } from '../lib/site'
  let { page }: { page: ToolPage } = $props()
</script>

<p class="notice notice-info">{page.name} is coming soon.</p>
