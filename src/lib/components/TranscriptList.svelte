<script>
  import { filterTranscripts } from '$lib/notes.js';

  let { notes, windowStates, onToggleWindow, onDeleteNote } = $props();

  const transcripts = $derived(filterTranscripts(notes));

  // Format timestamp for display (e.g., "Feb 2, 5:30 PM")
  const formatTranscriptName = (note) => {
    const filename = note?.filename || note?.path || '';
    // Extract timestamp from filename like "2026-02-03T13:00:00-0800.md"
    const match = filename.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return filename.replace(/\.md$/i, '');

    const [, year, month, day, hours, minutes] = match;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };
</script>

{#if transcripts.length > 0}
  <aside class="transcript-list" aria-label="Transcripts">
    <p class="transcript-list-title">Transcripts</p>
    <div class="transcript-pills" role="list">
      {#each transcripts as note (note.id)}
        {@const isOpen = windowStates[note.id]?.visible}
        <div class="transcript-pill-wrapper" role="listitem">
          <button
            class="transcript-pill"
            class:active={isOpen}
            type="button"
            onclick={() => onToggleWindow(note.id)}
          >
            {formatTranscriptName(note)}
          </button>
          <button
            class="transcript-delete"
            type="button"
            onclick={() => onDeleteNote(note.id)}
            aria-label="Delete transcript"
          >
            ×
          </button>
        </div>
      {/each}
    </div>
  </aside>
{/if}

<style>
  .transcript-list {
    position: fixed;
    top: 80px;
    right: 28px;
    width: min(200px, 40vw);
    max-height: calc(100vh - 120px);
    display: grid;
    gap: 10px;
    z-index: var(--layer-sidebar);
    pointer-events: auto;
  }

  .transcript-list-title {
    font-size: 0.65rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(16, 22, 22, 0.5);
    font-weight: 600;
    text-align: right;
    padding-right: 4px;
  }

  .transcript-pills {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    overflow-y: auto;
    padding-bottom: 20px;
  }

  .transcript-pill-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .transcript-pill {
    border: 1px solid rgba(16, 22, 22, 0.08);
    background: rgba(255, 255, 255, 0.85);
    color: var(--muted);
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
    box-shadow: 0 4px 12px rgba(16, 22, 22, 0.06);
  }

  .transcript-pill:hover {
    background: rgba(255, 255, 255, 0.95);
    border-color: rgba(16, 22, 22, 0.12);
  }

  .transcript-pill.active {
    background: rgba(214, 90, 24, 0.12);
    border-color: rgba(214, 90, 24, 0.25);
    color: rgba(82, 39, 19, 0.9);
    box-shadow: 0 6px 16px rgba(214, 90, 24, 0.15);
  }

  .transcript-delete {
    border: none;
    background: rgba(16, 22, 22, 0.08);
    color: rgba(16, 22, 22, 0.5);
    width: 20px;
    height: 20px;
    border-radius: 50%;
    font-size: 0.85rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .transcript-pill-wrapper:hover .transcript-delete {
    opacity: 1;
  }

  .transcript-delete:hover {
    background: rgba(122, 48, 16, 0.15);
    color: rgba(122, 48, 16, 0.8);
  }

  @media (max-width: 960px) {
    .transcript-list {
      top: auto;
      bottom: 20px;
      right: 20px;
      max-height: 40vh;
    }
  }
</style>
