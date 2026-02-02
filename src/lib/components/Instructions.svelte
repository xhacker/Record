<aside class="slash-instructions" aria-label="Slash command instructions">
  <p class="slash-instructions-title">Shortcuts</p>
  <p class="slash-instructions-body">
    Type <span class="inline-chip">/</span> with a prompt, press
    <span class="inline-chip">⌘</span> + <span class="inline-chip">↵</span> to insert inline
  </p>
  <p class="slash-instructions-body">
    Double-click title bar to rename
  </p>
</aside>

<style>
  .slash-instructions {
    position: fixed;
    bottom: 28px;
    left: 28px;
    display: grid;
    gap: 4px;
    color: var(--muted);
    font-size: 0.78rem;
    opacity: 0.6;
    z-index: 0;
  }

  .slash-instructions-title {
    color: var(--muted);
    font-weight: 600;
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .slash-instructions-body {
    line-height: 1.5;
  }

  .inline-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.35em;
    padding: 0.1em 0.4em;
    border-radius: 999px;
    background: rgba(203, 111, 45, 0.08);
    color: rgba(82, 39, 19, 0.75);
    font-size: 0.85em;
    border: 1px solid rgba(203, 111, 45, 0.12);
    font-weight: 600;
  }
</style>
