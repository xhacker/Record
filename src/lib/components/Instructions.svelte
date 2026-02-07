<aside class="shortcuts-instructions" aria-label="Editing shortcuts">
  <p class="shortcuts-instructions-title">Shortcuts</p>
  <p class="shortcuts-instructions-body">
    Rich text: <span class="inline-chip">⌘</span> + <span class="inline-chip">B</span> for bold,
    <span class="inline-chip">⌘</span> + <span class="inline-chip">I</span> for italics
  </p>
  <p class="shortcuts-instructions-body">
    Type <span class="inline-chip">/</span> and press
    <span class="inline-chip">⌘</span> + <span class="inline-chip">↵</span> to run slash command
  </p>
  <p class="shortcuts-instructions-body">
    <span class="inline-chip">⌘</span> + <span class="inline-chip">S</span> to save,
    double-click title bar to rename
  </p>
</aside>

<style>
  .shortcuts-instructions {
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

  .shortcuts-instructions-title {
    color: var(--muted);
    font-weight: 600;
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .shortcuts-instructions-body {
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
