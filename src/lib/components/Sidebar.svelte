<script>
  import { getDisplayName, filterNotes } from '$lib/notes.js';

  let { notes, windowStates, onToggleWindow, onAddNote, onDeleteNote, onClose } = $props();

  const regularNotes = $derived(filterNotes(notes));
</script>

<aside class="sidebar" aria-label="Notes">
  <div class="sidebar-header">
    <p class="app-title">THE RECORD.</p>
    <button class="sidebar-close" type="button" onclick={onClose}>
      Close
    </button>
  </div>
  <div class="sidebar-actions">
    <button class="primary-action" type="button" onclick={onAddNote}>New note</button>
  </div>
  <div class="sidebar-list" role="list">
    {#each regularNotes as note (note.id)}
      {@const isOpen = windowStates[note.id]?.visible}
      {@const name = getDisplayName(note)}
      <div class:active={isOpen} class="sidebar-note" role="listitem">
        <button class="sidebar-note-body" type="button" onclick={() => onToggleWindow(note.id)}>
          <span class="sidebar-note-title">
            <span class="note-name">{name.base}</span>
            {#if name.ext}
              <span class="note-ext">{name.ext}</span>
            {/if}
          </span>
        </button>
        <button class="note-delete" type="button" onclick={() => onDeleteNote(note.id)}>
          Delete
        </button>
      </div>
    {/each}
  </div>
</aside>

<style>
  .sidebar {
    position: fixed;
    top: 28px;
    left: 28px;
    width: min(280px, 72vw);
    max-height: calc(100vh - 56px);
    background: transparent;
    border-radius: 0;
    border: none;
    box-shadow: none;
    padding: 0;
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: 12px;
    font-family: var(--font-ui);
    z-index: var(--layer-sidebar);
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 12px;
  }

  .sidebar-close {
    border: none;
    background: rgba(16, 22, 22, 0.08);
    color: var(--muted);
    border-radius: 999px;
    padding: 6px 12px;
    font-size: 0.7rem;
    font-weight: 600;
    cursor: pointer;
    display: none;
  }

  .sidebar-actions {
    display: block;
    padding: 0 24px 0 12px;
  }

  .primary-action {
    border: 1px dashed rgba(16, 22, 22, 0.2);
    background: transparent;
    color: var(--muted);
    padding: 0 16px;
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    height: 44px;
    box-shadow: none;
    width: 100%;
    text-align: left;
  }

  .sidebar-list {
    display: grid;
    gap: 12px;
    overflow-y: auto;
    padding: 0 24px 40px 12px;
  }

  .sidebar-note {
    position: relative;
    width: 100%;
  }

  .sidebar-note-body {
    border: 1px solid rgba(16, 22, 22, 0.03);
    background: #fdf3ea;
    box-shadow: 0 8px 18px rgba(210, 160, 120, 0.1), 0 2px 4px rgba(16, 22, 22, 0.02);
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    border-radius: 999px;
    padding: 0 84px 0 16px;
    height: 44px;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: left;
    cursor: pointer;
    overflow: hidden;
    min-width: 0;
  }

  .sidebar-note.active .sidebar-note-body {
    border-color: rgba(16, 22, 22, 0.15);
    box-shadow: 0 16px 30px rgba(210, 160, 120, 0.3), 0 4px 10px rgba(16, 22, 22, 0.08);
    background: #fefcfb;
  }

  .sidebar-note-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    display: inline-flex;
    align-items: baseline;
  }

  .note-name {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .note-ext {
    color: rgba(16, 22, 22, 0.45);
    font-weight: 500;
    flex-shrink: 0;
  }

  .note-delete {
    border: none;
    background: #eae1d9;
    color: rgba(82, 39, 19, 0.85);
    padding: 0 10px;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 600;
    cursor: pointer;
    height: 28px;
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 1;
  }

  @media (max-width: 960px) {
    .sidebar {
      inset: 18px auto 18px 18px;
      width: min(320px, 78vw);
      transform: translateX(-110%);
      transition: transform 0.25s ease;
      max-height: calc(100vh - 36px);
    }

    :global(.page.sidebar-open) .sidebar {
      transform: translateX(0);
    }

    .sidebar-close {
      display: inline-flex;
    }
  }
</style>
