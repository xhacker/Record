<script>
  import { tick } from 'svelte';
  import { browser } from '$app/environment';

  const STORAGE_KEY = 'the-record-notes';
  const COMMAND_MODEL = 'kimi';

  let notes = $state([]);
  let activeId = $state(null);
  let title = $state('');
  let content = $state('');
  let sidebarOpen = $state(false);
  let commandPending = $state(false);

  let autosaveTimer = null;
  let contentEl;
  let dirty = false;

  const createNote = () => ({
    id: crypto?.randomUUID?.() ?? `note-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: '',
    content: '',
    updatedAt: Date.now(),
  });

  const sortNotes = (list) =>
    [...list].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  const loadNotes = () => {
    let nextNotes = [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          nextNotes = parsed;
        }
      } catch (error) {
        console.warn('Failed to parse saved notes', error);
      }
    }
    if (!nextNotes.length) {
      nextNotes = [createNote()];
    }
    const sorted = sortNotes(nextNotes);
    notes = sorted;
    activeId = sorted[0].id;
    title = sorted[0].title ?? '';
    content = sorted[0].content ?? '';
    dirty = false;
  };

  const persistNotes = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  };

  const updateActiveDraft = () => {
    if (!activeId) return;
    dirty = true;
    notes = notes.map((note) =>
      note.id === activeId ? { ...note, title, content } : note
    );
  };

  const commitActiveNote = () => {
    if (!activeId || !dirty) return;
    notes = sortNotes(
      notes.map((note) =>
        note.id === activeId
          ? {
              ...note,
              title,
              content,
              updatedAt: Date.now(),
            }
          : note
      )
    );
    dirty = false;
    persistNotes();
  };

  const scheduleSave = () => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(commitActiveNote, 400);
  };

  const selectNote = (id) => {
    if (!id || id === activeId) return;
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
    commitActiveNote();
    activeId = id;
    const next = notes.find((note) => note.id === id);
    title = next?.title ?? '';
    content = next?.content ?? '';
    sidebarOpen = false;
    dirty = false;
  };

  const addNote = () => {
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
    commitActiveNote();
    const fresh = createNote();
    notes = [fresh, ...notes];
    activeId = fresh.id;
    title = '';
    content = '';
    persistNotes();
    sidebarOpen = false;
    dirty = false;
  };

  const deleteNote = (id) => {
    const target = notes.find((note) => note.id === id);
    if (!target) return;
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
    const label = target.title?.trim() || 'Untitled note';
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;

    let remaining = notes.filter((note) => note.id !== id);
    if (!remaining.length) {
      remaining = [createNote()];
    }
    notes = remaining;

    if (id === activeId) {
      activeId = notes[0].id;
      title = notes[0].title ?? '';
      content = notes[0].content ?? '';
    }
    dirty = false;
    persistNotes();
  };

  const formatUpdated = (timestamp) => {
    if (!timestamp) return 'Just now';
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  const getParagraphBounds = (text, index) => {
    const clampedIndex = Math.min(Math.max(index, 0), text.length);
    const separator = /\n\s*\n/g;
    let start = 0;
    let match;
    while ((match = separator.exec(text)) !== null && match.index < clampedIndex) {
      start = match.index + match[0].length;
    }
    separator.lastIndex = clampedIndex;
    match = separator.exec(text);
    const end = match ? match.index : text.length;
    return { start, end };
  };

  const findSlashCommand = (text, cursor, paragraphStart) => {
    const prefix = text.slice(paragraphStart, cursor);
    let slashIndex = prefix.lastIndexOf('/');
    while (slashIndex !== -1) {
      const prevChar = slashIndex === 0 ? '' : prefix[slashIndex - 1];
      if (slashIndex === 0 || /\s/.test(prevChar)) {
        const commandText = prefix.slice(slashIndex).trim();
        if (commandText.length > 1 && !commandText.includes('\n')) {
          return {
            start: paragraphStart + slashIndex,
            end: cursor,
            commandText,
          };
        }
      }
      slashIndex = prefix.lastIndexOf('/', slashIndex - 1);
    }
    return null;
  };

  const buildCommandPrompt = ({ paragraphWithoutCommand, commandText }) => {
    return [
      'You are assisting with a focused note.',
      'Use the current paragraph as context for the request.',
      '',
      'Paragraph (command removed):',
      paragraphWithoutCommand.trim(),
      '',
      'Slash command:',
      commandText.trim(),
      '',
      'Return only the text that should replace the slash command. No quotes, no markdown, no extra commentary.',
    ]
      .filter(Boolean)
      .join('\n');
  };

  const runSlashCommand = async () => {
    if (!contentEl || commandPending) return;
    const cursor = contentEl.selectionEnd ?? 0;
    const { start: paragraphStart, end: paragraphEnd } = getParagraphBounds(
      content,
      cursor
    );
    const command = findSlashCommand(content, cursor, paragraphStart);
    if (!command) return;

    const paragraph = content.slice(paragraphStart, paragraphEnd);
    const paragraphWithoutCommand =
      paragraph.slice(0, command.start - paragraphStart) +
      paragraph.slice(command.end - paragraphStart);

    commandPending = true;
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: buildCommandPrompt({
            paragraphWithoutCommand,
            commandText: command.commandText,
          }),
          model: COMMAND_MODEL,
          temperature: 0.3,
          max_completion_tokens: 600,
          top_p: 1,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to run slash command.');
      }

      const replacement = (payload?.content ?? '').trim();
      if (!replacement) {
        throw new Error('Slash command returned no content.');
      }

      content = content.slice(0, command.start) + replacement + content.slice(command.end);
      updateActiveDraft();
      scheduleSave();
      await tick();
      const caret = command.start + replacement.length;
      contentEl.setSelectionRange(caret, caret);
      contentEl.focus();
    } catch (error) {
      console.warn('Slash command failed', error);
    } finally {
      commandPending = false;
    }
  };

  const handleContentKeydown = (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      runSlashCommand();
    }
  };

  $effect(() => {
    if (!browser) return;
    loadNotes();
    return () => {
      if (autosaveTimer) clearTimeout(autosaveTimer);
    };
  });
</script>

<svelte:head>
  <title>the record</title>
</svelte:head>

<main class:sidebar-open={sidebarOpen} class="page">
  <div class="glow"></div>
  <aside class="sidebar" aria-label="Notes">
    <div class="sidebar-header">
      <p class="app-title">THE RECORD.</p>
      <button class="sidebar-close" type="button" onclick={() => (sidebarOpen = false)}>
        Close
      </button>
    </div>
    <div class="sidebar-actions">
      <button class="primary-action" type="button" onclick={addNote}>New note</button>
    </div>
    <div class="sidebar-list" role="list">
      {#each notes as note (note.id)}
        <div class:active={note.id === activeId} class="sidebar-note" role="listitem">
          <button class="sidebar-note-body" type="button" onclick={() => selectNote(note.id)}>
            <span class="sidebar-note-title">{note.title?.trim() || 'Title'}</span>
            <span class="sidebar-note-meta">{formatUpdated(note.updatedAt)}</span>
          </button>
          <button class="note-delete" type="button" onclick={() => deleteNote(note.id)}>
            Delete
          </button>
        </div>
      {/each}
    </div>
  </aside>
  <button class="sidebar-overlay" type="button" aria-label="Close sidebar" onclick={() => (sidebarOpen = false)}></button>
  <div class="note-shell">
    <header class="note-header">
      <button class="sidebar-toggle" type="button" onclick={() => (sidebarOpen = true)}>
        Notes
      </button>
    </header>
    <section class="note" aria-label="Note">
      <input
        class="note-title"
        type="text"
        placeholder="Title"
        bind:value={title}
        oninput={() => {
          updateActiveDraft();
          scheduleSave();
        }}
      />
      <textarea
        class="note-content"
        placeholder="Write your note..."
        bind:value={content}
        bind:this={contentEl}
        oninput={() => {
          updateActiveDraft();
          scheduleSave();
        }}
        onkeydown={handleContentKeydown}
        aria-busy={commandPending}
      ></textarea>
    </section>
    <aside class="note-instructions" aria-label="Slash command instructions">
      <p class="note-instructions-title">Slash commands</p>
      <p class="note-instructions-body">
        Type <span class="inline-chip">/</span> with a prompt and press
        <span class="inline-chip">⌘</span> + <span class="inline-chip">↵</span> to
        insert inline.
      </p>
    </aside>
  </div>
</main>
