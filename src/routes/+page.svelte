<script>
  import { tick } from 'svelte';
  import { browser } from '$app/environment';

  const STORAGE_KEY = 'the-record-notes';
  const WINDOWS_KEY = 'the-record-windows';
  const COMMAND_MODEL = 'kimi';

  // Grid system
  const GRID_SIZE = 40;
  const snapToGrid = (value) => Math.round(value / GRID_SIZE) * GRID_SIZE;
  const DEFAULT_WIDTH = GRID_SIZE * 12; // 480px
  const DEFAULT_HEIGHT = GRID_SIZE * 10; // 400px

  let notes = $state([]);
  let openWindows = $state([]);
  let topZ = $state(1);
  let sidebarOpen = $state(false);
  let commandPending = $state(false);

  let autosaveTimers = {};
  let contentEls = $state({});
  let dragState = null;
  let resizeState = null;
  let editingTitleId = $state(null);

  function focusOnMount(node) {
    node.focus();
    node.select();
  }

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
    notes = sortNotes(nextNotes);

    // Load windows
    const windowsRaw = localStorage.getItem(WINDOWS_KEY);
    if (windowsRaw) {
      try {
        const parsed = JSON.parse(windowsRaw);
        if (Array.isArray(parsed)) {
          openWindows = parsed;
          topZ = Math.max(1, ...parsed.map(w => w.zIndex || 1)) + 1;
        }
      } catch (error) {
        console.warn('Failed to parse saved windows', error);
      }
    }
  };

  const persistNotes = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  };

  const persistWindows = () => {
    localStorage.setItem(WINDOWS_KEY, JSON.stringify(openWindows));
  };

  const updateNote = (noteId, field, value) => {
    notes = notes.map((note) =>
      note.id === noteId ? { ...note, [field]: value } : note
    );
  };

  const commitNote = (noteId) => {
    notes = sortNotes(
      notes.map((note) =>
        note.id === noteId
          ? { ...note, updatedAt: Date.now() }
          : note
      )
    );
    persistNotes();
  };

  const scheduleSave = (noteId) => {
    if (autosaveTimers[noteId]) clearTimeout(autosaveTimers[noteId]);
    autosaveTimers[noteId] = setTimeout(() => commitNote(noteId), 400);
  };

  const toggleWindow = (noteId) => {
    const existing = openWindows.find(w => w.noteId === noteId);
    if (existing) {
      openWindows = openWindows.filter(w => w.noteId !== noteId);
    } else {
      const offsetStep = GRID_SIZE * 2;
      const offset = openWindows.length * offsetStep;
      openWindows = [...openWindows, {
        noteId,
        x: GRID_SIZE * 3 + offset,
        y: GRID_SIZE * 2 + offset,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        zIndex: topZ++
      }];
    }
    persistWindows();
    sidebarOpen = false;
  };

  const closeWindow = (noteId) => {
    if (autosaveTimers[noteId]) {
      clearTimeout(autosaveTimers[noteId]);
      delete autosaveTimers[noteId];
    }
    commitNote(noteId);
    openWindows = openWindows.filter(w => w.noteId !== noteId);
    persistWindows();
  };

  const bringToFront = (noteId) => {
    openWindows = openWindows.map(w =>
      w.noteId === noteId ? { ...w, zIndex: topZ++ } : w
    );
  };

  const startDrag = (noteId, event) => {
    if (event.target.closest('input, textarea, button')) return;
    event.preventDefault();
    bringToFront(noteId);
    const win = openWindows.find(w => w.noteId === noteId);
    if (!win) return;
    dragState = {
      noteId,
      startX: event.clientX,
      startY: event.clientY,
      origX: win.x,
      origY: win.y
    };
  };

  const onDrag = (event) => {
    if (!dragState) return;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    const newX = snapToGrid(Math.max(0, dragState.origX + dx));
    const newY = snapToGrid(Math.max(0, dragState.origY + dy));
    openWindows = openWindows.map(w =>
      w.noteId === dragState.noteId
        ? { ...w, x: newX, y: newY }
        : w
    );
  };

  const endDrag = () => {
    if (dragState || resizeState) {
      persistWindows();
      dragState = null;
      resizeState = null;
    }
  };

  const startResize = (noteId, event) => {
    event.preventDefault();
    event.stopPropagation();
    bringToFront(noteId);
    const win = openWindows.find(w => w.noteId === noteId);
    if (!win) return;
    resizeState = {
      noteId,
      startX: event.clientX,
      startY: event.clientY,
      origWidth: win.width ?? DEFAULT_WIDTH,
      origHeight: win.height ?? DEFAULT_HEIGHT
    };
  };

  const onResize = (event) => {
    if (!resizeState) return;
    const dx = event.clientX - resizeState.startX;
    const dy = event.clientY - resizeState.startY;
    const minSize = GRID_SIZE * 4; // 160px minimum
    const newWidth = snapToGrid(Math.max(minSize, resizeState.origWidth + dx));
    const newHeight = snapToGrid(Math.max(minSize, resizeState.origHeight + dy));
    openWindows = openWindows.map(w =>
      w.noteId === resizeState.noteId
        ? { ...w, width: newWidth, height: newHeight }
        : w
    );
  };

  const onPointerMove = (event) => {
    onDrag(event);
    onResize(event);
  };

  const addNote = () => {
    const fresh = createNote();
    notes = [fresh, ...notes];
    persistNotes();
    // Open the new note as a window
    const offsetStep = GRID_SIZE * 2;
    const offset = openWindows.length * offsetStep;
    openWindows = [...openWindows, {
      noteId: fresh.id,
      x: GRID_SIZE * 3 + offset,
      y: GRID_SIZE * 2 + offset,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      zIndex: topZ++
    }];
    persistWindows();
    sidebarOpen = false;
  };

  const deleteNote = (id) => {
    const target = notes.find((note) => note.id === id);
    if (!target) return;
    if (autosaveTimers[id]) {
      clearTimeout(autosaveTimers[id]);
      delete autosaveTimers[id];
    }
    const label = target.title?.trim() || 'Untitled note';
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;

    // Close window if open
    openWindows = openWindows.filter(w => w.noteId !== id);
    persistWindows();

    let remaining = notes.filter((note) => note.id !== id);
    if (!remaining.length) {
      remaining = [createNote()];
    }
    notes = remaining;
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

  const runSlashCommand = async (noteId) => {
    const contentEl = contentEls[noteId];
    if (!contentEl || commandPending) return;
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    const content = note.content ?? '';
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

      const newContent = content.slice(0, command.start) + replacement + content.slice(command.end);
      updateNote(noteId, 'content', newContent);
      scheduleSave(noteId);
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

  const handleContentKeydown = (noteId, event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      runSlashCommand(noteId);
    }
  };

  $effect(() => {
    if (!browser) return;
    loadNotes();
    return () => {
      Object.values(autosaveTimers).forEach(t => clearTimeout(t));
    };
  });
</script>

<svelte:head>
  <title>the record</title>
</svelte:head>

<main class:sidebar-open={sidebarOpen} class="page" onpointermove={onPointerMove} onpointerup={endDrag} onpointerleave={endDrag}>
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
        {@const isOpen = openWindows.some(w => w.noteId === note.id)}
        <div class:active={isOpen} class="sidebar-note" role="listitem">
          <button class="sidebar-note-body" type="button" onclick={() => toggleWindow(note.id)}>
            <span class="sidebar-note-title">{note.title?.trim() || 'Untitled'}</span>
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
  <div class="note-shell canvas">
    <header class="note-header">
      <button class="sidebar-toggle" type="button" onclick={() => (sidebarOpen = true)}>
        Notes
      </button>
    </header>
    {#each openWindows as win (win.noteId)}
      {@const note = notes.find(n => n.id === win.noteId)}
      {#if note}
        <section
          class="note"
          aria-label="Note"
          style="left: {win.x}px; top: {win.y}px; width: {win.width ?? DEFAULT_WIDTH}px; height: {win.height ?? DEFAULT_HEIGHT}px; z-index: {win.zIndex};"
          onpointerdown={() => bringToFront(win.noteId)}
        >
          <div
            class="note-titlebar"
            onpointerdown={(e) => startDrag(win.noteId, e)}
            ondblclick={() => { editingTitleId = win.noteId; }}
          >
            <button class="window-close" type="button" aria-label="Close note" onclick={() => closeWindow(win.noteId)}>
              <svg viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
            {#if editingTitleId === win.noteId}
              <input
                class="note-title"
                type="text"
                placeholder="Untitled"
                value={note.title}
                oninput={(e) => {
                  updateNote(win.noteId, 'title', e.target.value);
                  scheduleSave(win.noteId);
                }}
                onblur={() => { editingTitleId = null; }}
                onkeydown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { editingTitleId = null; e.target.blur(); } }}
                use:focusOnMount
              />
            {:else}
              <span class="note-title-display">{note.title || 'Untitled'}</span>
            {/if}
          </div>
          <textarea
            class="note-content"
            placeholder="Write your note..."
            value={note.content}
            bind:this={contentEls[win.noteId]}
            oninput={(e) => {
              updateNote(win.noteId, 'content', e.target.value);
              scheduleSave(win.noteId);
            }}
            onkeydown={(e) => handleContentKeydown(win.noteId, e)}
            aria-busy={commandPending}
          ></textarea>
          <div
            class="note-resize-handle"
            onpointerdown={(e) => startResize(win.noteId, e)}
          ></div>
        </section>
      {/if}
    {/each}
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
  </div>
</main>
