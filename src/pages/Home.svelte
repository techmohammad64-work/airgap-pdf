<script lang="ts">
  import Icon from '../ui/Icon.svelte'
  import { pages, groups, href } from '../lib/site'
  import { status } from '../lib/status.svelte'
</script>

<section class="hero">
  <div class="container hero-grid">
    <div>
      <p class="eyebrow"><Icon name="shield-check" size={16} /> 100% in your browser · Works offline</p>
      <h1>PDF tools that <em>never</em> touch the internet.</h1>
      <p class="lead">
        Merge, split, sign, edit and redact PDFs right on your device. Your files are never uploaded, so they can't be leaked, stored or
        read by anyone. Disconnect your Wi-Fi and see for yourself.
      </p>
      <div class="cta">
        <a class="btn btn-primary btn-lg" href="#tools">Choose a tool <Icon name="arrow-right" size={18} /></a>
        <a class="btn btn-lg" href={href('privacy')}><Icon name="eye" size={18} /> See the proof</a>
      </div>
      <ul class="ticks">
        <li><Icon name="check" size={16} /> Free, no sign-up</li>
        <li><Icon name="check" size={16} /> No watermarks</li>
        <li><Icon name="check" size={16} /> Open source</li>
      </ul>
    </div>

    <div class="demo card" aria-hidden="true">
      <div class="demo-bar">
        <span class="dot"></span><span class="dot"></span><span class="dot"></span>
        <span class="demo-url"><Icon name="lock" size={12} /> airgappdf</span>
      </div>
      <div class="demo-body">
        <div class="demo-status"><Icon name="plane" size={16} /> Offline · working locally</div>
        <div class="demo-files">
          <div class="demo-file"><Icon name="file" size={18} /> contract.pdf <span>12 pages</span></div>
          <div class="demo-file"><Icon name="file" size={18} /> appendix.pdf <span>4 pages</span></div>
          <div class="demo-file"><Icon name="file" size={18} /> signed-nda.pdf <span>2 pages</span></div>
        </div>
        <div class="demo-progress"><span></span></div>
        <div class="demo-done"><Icon name="check-circle" size={18} /> Merged 18 pages · 0 bytes uploaded</div>
      </div>
    </div>
  </div>
</section>

<section id="tools" class="container tools">
  {#each groups as g (g.id)}
    <h2>{g.label}</h2>
    <div class="tool-grid">
      {#each pages.filter((p) => p.group === g.id) as p (p.slug)}
        <a class="tool card" href={href(p.slug)}>
          <span class="tool-icon"><Icon name={p.icon} size={22} /></span>
          <span class="tool-text">
            <b>{p.name}</b>
            <span>{p.short}</span>
          </span>
        </a>
      {/each}
    </div>
  {/each}
</section>

<section class="container proof">
  <h2>Don't trust us. Test it.</h2>
  <p class="muted">Most "free PDF" sites upload your documents to their servers. AirgapPDF can't, and you can prove it in under a minute.</p>
  <ol class="steps">
    <li class="card">
      <span class="num">1</span>
      <h3>Open any tool</h3>
      <p>The whole app saves itself to your device on first visit{status.offlineReady ? ' (already done on this device)' : ''}.</p>
    </li>
    <li class="card">
      <span class="num">2</span>
      <h3>Turn off your internet</h3>
      <p>Switch off Wi-Fi or enable airplane mode. The status badge changes to <b>Offline · working locally</b>.</p>
    </li>
    <li class="card">
      <span class="num">3</span>
      <h3>Process your PDF</h3>
      <p>Everything still works, because nothing ever needed a server. Your document stayed on your device the whole time.</p>
    </li>
  </ol>
</section>

<section class="container compare">
  <h2>How AirgapPDF is different</h2>
  <div class="table-wrap card">
    <table>
      <thead>
        <tr><th></th><th>Typical online PDF tools</th><th class="us">AirgapPDF</th></tr>
      </thead>
      <tbody>
        <tr><td>Your file is uploaded to a server</td><td class="bad"><Icon name="check" size={16} /> Yes</td><td class="good"><Icon name="x" size={16} /> Never</td></tr>
        <tr><td>Works with the internet switched off</td><td class="bad"><Icon name="x" size={16} /> No</td><td class="good"><Icon name="check" size={16} /> Yes</td></tr>
        <tr><td>Account or email required</td><td>Often</td><td class="good">Never</td></tr>
        <tr><td>Browser blocks data from leaving the page</td><td class="bad">No</td><td class="good"><Icon name="check" size={16} /> Enforced by security policy</td></tr>
        <tr><td>Source code you can audit</td><td class="bad">Rarely</td><td class="good"><Icon name="check" size={16} /> Yes</td></tr>
      </tbody>
    </table>
  </div>
</section>

<style>
  .hero {
    padding: 56px 0 40px;
    background:
      radial-gradient(900px 400px at 85% -10%, color-mix(in srgb, var(--safe) 14%, transparent), transparent),
      radial-gradient(700px 400px at -10% 10%, color-mix(in srgb, var(--primary) 10%, transparent), transparent);
  }
  .hero-grid {
    display: grid;
    grid-template-columns: 1.15fr 1fr;
    gap: 48px;
    align-items: center;
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
    margin: 0 0 18px;
  }
  h1 {
    font-size: clamp(34px, 5vw, 54px);
    letter-spacing: -0.03em;
    line-height: 1.05;
  }
  h1 em {
    font-style: normal;
    color: var(--safe);
  }
  .lead {
    font-size: 18px;
    color: var(--text-2);
    max-width: 560px;
  }
  .cta {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin: 24px 0 18px;
  }
  .ticks {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
    list-style: none;
    padding: 0;
    margin: 0;
    color: var(--text-2);
    font-size: 14px;
  }
  .ticks li {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }
  .ticks :global(svg) {
    color: var(--safe);
  }

  .demo {
    overflow: hidden;
    box-shadow: var(--shadow-lg);
  }
  .demo-bar {
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 10px 14px;
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--border-strong);
  }
  .demo-url {
    margin-left: 12px;
    display: inline-flex;
    gap: 6px;
    align-items: center;
    font-size: 12px;
    color: var(--text-3);
    background: var(--surface);
    padding: 3px 10px;
    border-radius: 6px;
  }
  .demo-body {
    padding: 20px;
    display: grid;
    gap: 14px;
  }
  .demo-status {
    justify-self: start;
    display: inline-flex;
    gap: 6px;
    align-items: center;
    padding: 4px 12px;
    border-radius: 999px;
    background: var(--safe-soft);
    color: var(--safe);
    font-weight: 600;
    font-size: 13px;
  }
  .demo-files {
    display: grid;
    gap: 8px;
  }
  .demo-file {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
  }
  .demo-file span {
    margin-left: auto;
    color: var(--text-3);
    font-size: 13px;
  }
  .demo-progress {
    height: 6px;
    background: var(--surface-2);
    border-radius: 999px;
    overflow: hidden;
  }
  .demo-progress span {
    display: block;
    height: 100%;
    width: 100%;
    background: var(--safe);
    animation: fill 2.4s ease-out infinite;
  }
  @keyframes fill {
    from {
      width: 0;
    }
    70%,
    to {
      width: 100%;
    }
  }
  .demo-done {
    display: flex;
    gap: 8px;
    align-items: center;
    color: var(--safe);
    font-weight: 600;
    font-size: 14px;
  }

  .tools {
    padding-top: 32px;
  }
  .tools h2 {
    font-size: 22px;
    margin: 28px 0 14px;
  }
  .tool-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 12px;
  }
  .tool {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    padding: 16px;
    color: var(--text);
    text-decoration: none;
    transition:
      border-color 0.15s,
      transform 0.15s,
      box-shadow 0.15s;
  }
  .tool:hover {
    border-color: var(--primary);
    transform: translateY(-2px);
    box-shadow: var(--shadow);
  }
  .tool-icon {
    flex: none;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: var(--primary-soft);
    color: var(--primary);
  }
  .tool-text {
    display: grid;
    gap: 2px;
  }
  .tool-text span {
    color: var(--text-2);
    font-size: 14px;
  }

  .proof,
  .compare {
    padding-top: 64px;
  }
  .proof h2,
  .compare h2 {
    font-size: 28px;
  }
  .steps {
    list-style: none;
    padding: 0;
    margin: 24px 0 0;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }
  .steps li {
    padding: 22px;
  }
  .steps h3 {
    font-size: 18px;
    margin-top: 12px;
  }
  .steps p {
    color: var(--text-2);
    margin: 0;
    font-size: 15px;
  }
  .num {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--brand);
    color: var(--brand-contrast);
    font-weight: 700;
  }
  .table-wrap {
    overflow-x: auto;
    margin-top: 20px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 15px;
  }
  th,
  td {
    text-align: left;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
  }
  tr:last-child td {
    border-bottom: 0;
  }
  th {
    font-size: 14px;
    color: var(--text-2);
  }
  th.us {
    color: var(--safe);
  }
  td :global(svg) {
    vertical-align: -3px;
  }
  .good {
    color: var(--safe);
    font-weight: 600;
  }
  .bad {
    color: var(--text-3);
  }
  @media (max-width: 900px) {
    .hero-grid {
      grid-template-columns: 1fr;
    }
    .steps {
      grid-template-columns: 1fr;
    }
  }
</style>
