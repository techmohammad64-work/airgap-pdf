<script lang="ts">
  import Logo from './Logo.svelte'
  import Icon from './Icon.svelte'
  import { pages, groups, href, site } from '../lib/site'
</script>

<footer>
  <div class="container grid">
    <div class="about">
      <a class="brand" href={href()}><Logo size={26} /> <b>Airgap<span>PDF</span></b></a>
      <p>{site.tagline} Every tool runs on your device. No uploads, no accounts, no tracking.</p>
      <a class="src" href={site.repo} rel="noopener"><Icon name="github" size={16} /> Open source: audit the code</a>
    </div>
    {#each groups as g (g.id)}
      <div>
        <h4>{g.label}</h4>
        <ul>
          {#each pages.filter((p) => p.group === g.id) as p (p.slug)}
            <li><a href={href(p.slug)}>{p.name}</a></li>
          {/each}
        </ul>
      </div>
    {/each}
    <div>
      <h4>Trust</h4>
      <ul>
        <li><a href={href('privacy')}>How we prove it</a></li>
        <li><a href={site.repo} rel="noopener">Source code</a></li>
      </ul>
    </div>
  </div>
  <div class="container legal">© {new Date().getFullYear()} AirgapPDF. Files are processed locally and never leave your device.</div>
</footer>

<style>
  footer {
    border-top: 1px solid var(--border);
    background: var(--surface);
    padding: 40px 0 24px;
    font-size: 14px;
    color: var(--text-2);
  }
  .grid {
    display: grid;
    grid-template-columns: 1.6fr repeat(3, 1fr);
    gap: 32px;
  }
  .brand {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    color: var(--text);
    text-decoration: none;
    font-size: 17px;
  }
  .brand span {
    color: var(--safe);
  }
  .about p {
    max-width: 340px;
  }
  .src {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }
  h4 {
    margin: 0 0 10px;
    color: var(--text);
    font-size: 14px;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 6px;
  }
  ul a {
    color: var(--text-2);
    text-decoration: none;
  }
  ul a:hover {
    color: var(--text);
    text-decoration: underline;
  }
  .legal {
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
    color: var(--text-3);
    font-size: 13px;
  }
  @media (max-width: 820px) {
    .grid {
      grid-template-columns: 1fr 1fr;
    }
    .about {
      grid-column: 1 / -1;
    }
  }
</style>
