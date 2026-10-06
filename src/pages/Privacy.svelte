<script lang="ts">
  import Icon from '../ui/Icon.svelte'
  import { status } from '../lib/status.svelte'
  import { site } from '../lib/site'

  const cspMeta = document.querySelector<HTMLMetaElement>('meta[http-equiv="Content-Security-Policy"]')
  const csp = cspMeta?.content ?? ''

  let requests = $state<{ url: string; same: boolean }[] | null>(null)
  function listRequests() {
    requests = performance.getEntriesByType('resource').map((e) => {
      const u = new URL(e.name, location.href)
      return { url: u.origin === location.origin ? u.pathname : u.href, same: u.origin === location.origin || u.protocol === 'blob:' || u.protocol === 'data:' }
    })
  }

  let leakTest = $state<'idle' | 'blocked' | 'sent'>('idle')
  async function tryLeak() {
    let blocked = false
    const onViolation = () => (blocked = true)
    document.addEventListener('securitypolicyviolation', onViolation)
    try {
      await fetch('https://example.com/upload', { method: 'POST', body: 'test', mode: 'no-cors' })
    } catch {
      blocked = true
    }
    await new Promise((r) => setTimeout(r, 50))
    document.removeEventListener('securitypolicyviolation', onViolation)
    leakTest = blocked ? 'blocked' : 'sent'
  }
</script>

<div class="container wrap">
  <p class="eyebrow"><Icon name="shield-check" size={16} /> Verifiable privacy</p>
  <h1>How we prove your files never leave your device</h1>
  <p class="lead">
    "We don't upload your files" is easy to claim. Here are three ways to check it yourself, no technical knowledge needed for the first one.
  </p>

  <section class="card proof">
    <div class="head"><span class="n">1</span><h2>The airplane-mode test</h2><span class="tag">Anyone</span></div>
    <ol>
      <li>Open any AirgapPDF tool and wait for the <b>Ready offline</b> badge in the top bar{status.offlineReady ? ' (it is ready on this device right now)' : ''}.</li>
      <li>Turn off Wi-Fi, unplug the cable, or switch on airplane mode. The badge changes to <b>Offline · working locally</b>.</li>
      <li>Add a PDF and use the tool. It works exactly the same, because there is no server involved.</li>
    </ol>
    <p class="muted small">If a tool needed to upload your file, it would fail at this point. None of ours do.</p>
  </section>

  <section class="card proof">
    <div class="head"><span class="n">2</span><h2>Watch the network yourself</h2><span class="tag">2 minutes</span></div>
    <ol>
      <li>Press <kbd>F12</kbd> (or <kbd>Cmd</kbd>+<kbd>Option</kbd>+<kbd>I</kbd> on Mac) and open the <b>Network</b> tab.</li>
      <li>Clear the list, then add a file to any tool and process it.</li>
      <li>The list stays empty. No request carries your file, because none is made.</li>
    </ol>
    <div class="live">
      <button class="btn" onclick={listRequests}><Icon name="eye" size={16} /> List every request this page has made</button>
      {#if requests}
        <p class="small">
          {requests.length} requests, <b class="ok">{requests.filter((r) => r.same).length} to this site's own files</b>,
          <b class:bad={requests.some((r) => !r.same)}>{requests.filter((r) => !r.same).length} to anywhere else</b>.
        </p>
        <ul class="reqs">
          {#each requests as r, i (i)}
            <li class:bad={!r.same}><Icon name={r.same ? 'check' : 'alert'} size={14} /> <code>{r.url}</code></li>
          {/each}
        </ul>
      {/if}
    </div>
  </section>

  <section class="card proof">
    <div class="head"><span class="n">3</span><h2>Your browser enforces it</h2><span class="tag">Technical</span></div>
    <p>
      Every AirgapPDF page carries a <b>Content Security Policy</b>. It tells your browser to refuse any connection to another website. Even if
      the page tried to send your file somewhere, your own browser would block it.
    </p>
    {#if csp}
      <pre><code>{csp.replaceAll('; ', ';\n')}</code></pre>
      <p class="small muted"><code>connect-src 'self'</code> is the line that matters: data may only be requested from this site's own files.</p>
      <div class="live">
        <button class="btn" onclick={tryLeak} data-testid="leak-test"><Icon name="upload" size={16} /> Try to send data to another website</button>
        {#if leakTest === 'blocked'}
          <p class="notice notice-safe" data-testid="leak-result"><Icon name="shield-check" size={18} /> Blocked by your browser. Nothing was sent.</p>
        {:else if leakTest === 'sent'}
          <p class="notice notice-warn" data-testid="leak-result"><Icon name="alert" size={18} /> The request was not blocked. You may be viewing a development build.</p>
        {/if}
      </div>
    {:else}
      <p class="notice notice-info small">This is a development build, so the policy is not active here. It is applied to the published site.</p>
    {/if}
  </section>

  <section class="card proof">
    <div class="head"><span class="n">4</span><h2>Read the code</h2><span class="tag">Developers</span></div>
    <p>AirgapPDF is open source. Every line that touches your files is public, along with the security policy and the offline cache configuration.</p>
    <a class="btn" href={site.repo} rel="noopener"><Icon name="github" size={16} /> View source on GitHub</a>
  </section>

  <section class="facts">
    <h2>What we store</h2>
    <ul>
      <li><Icon name="check" size={16} /> <span><b>Your files:</b> never stored. They live in memory while the tab is open and are gone when you close it.</span></li>
      <li><Icon name="check" size={16} /> <span><b>Your signature:</b> only if you tick "Remember on this device", and only in this browser's storage.</span></li>
      <li><Icon name="check" size={16} /> <span><b>Your theme choice:</b> light or dark, saved in this browser.</span></li>
      <li><Icon name="check" size={16} /> <span><b>Cookies, analytics, trackers:</b> none on any tool page.</span></li>
    </ul>
  </section>
</div>

<style>
  .wrap {
    max-width: 860px;
    padding-top: 48px;
  }
  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 999px;
    background: var(--safe-soft);
    color: var(--safe);
    font-weight: 600;
    font-size: 14px;
  }
  h1 {
    font-size: clamp(28px, 4vw, 40px);
  }
  .lead {
    font-size: 18px;
    color: var(--text-2);
  }
  .proof {
    padding: 24px;
    margin-top: 20px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .head h2 {
    margin: 0;
    font-size: 20px;
  }
  .n {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--brand);
    color: var(--brand-contrast);
    font-weight: 700;
    flex: none;
  }
  .tag {
    margin-left: auto;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-3);
    border: 1px solid var(--border);
    padding: 2px 8px;
    border-radius: 999px;
  }
  ol {
    color: var(--text-2);
    padding-left: 20px;
  }
  ol li {
    margin: 6px 0;
  }
  kbd {
    font-family: var(--mono);
    font-size: 13px;
    padding: 1px 6px;
    border: 1px solid var(--border-strong);
    border-bottom-width: 2px;
    border-radius: 4px;
    background: var(--surface-2);
  }
  pre {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
    overflow-x: auto;
    font-size: 13px;
    line-height: 1.6;
  }
  code {
    font-family: var(--mono);
    font-size: 0.92em;
  }
  .live {
    margin-top: 14px;
    display: grid;
    gap: 10px;
    justify-items: start;
  }
  .reqs {
    list-style: none;
    padding: 0;
    margin: 0;
    max-height: 220px;
    overflow: auto;
    width: 100%;
    font-size: 13px;
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  .reqs li {
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 4px 10px;
    color: var(--safe);
    border-bottom: 1px solid var(--border);
  }
  .reqs li code {
    color: var(--text-2);
    overflow-wrap: anywhere;
  }
  .ok {
    color: var(--safe);
  }
  .bad {
    color: var(--danger) !important;
  }
  .facts {
    margin-top: 40px;
  }
  .facts ul {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 10px;
  }
  .facts li {
    display: flex;
    gap: 10px;
    color: var(--text-2);
  }
  .facts li :global(svg) {
    color: var(--safe);
    flex: none;
    margin-top: 4px;
  }
</style>
