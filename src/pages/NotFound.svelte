<script lang="ts">
  import { href } from '../lib/site'
</script>

<div class="container nf">
  <h1>Page not found</h1>
  <p class="muted">That page doesn't exist. Your files are safe, nothing was processed.</p>
  <a class="btn btn-primary" href={href()}>Go to all tools</a>
</div>

<style>
  .nf {
    padding: 96px 16px;
    text-align: center;
  }
</style>
