<script>
  import { tick } from 'svelte';
  import { browser } from '$app/environment';
  import { clearAuth, loadAuthToken, saveAuth } from '$lib/auth.js';
  import { createNote, sortNotesByPath, formatDateStamp, getNextDateFilename, normalizeNote } from '$lib/notes.js';
  import { loadNotesFromGitHub, writeNoteToGitHub, deleteNoteFromGitHub } from '$lib/github.js';
  import {
    loadWindowStates,
    getTopZ,
    persistStates,
    getOpenWindows,
    getNewWindowPosition,
    snapToGrid,
    DEFAULT_WIDTH,
    DEFAULT_HEIGHT,
  } from '$lib/windowManager.js';
  import { executeSlashCommand } from '$lib/slashCommand.js';
  import OnboardingCard from '$lib/components/OnboardingCard.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import NoteWindow from '$lib/components/NoteWindow.svelte';
  import Instructions from '$lib/components/Instructions.svelte';

  // State
  let notes = $state([]);
  let windowStates = $state({});
  let topZ = $state(1);
  let sidebarOpen = $state(false);
  let commandPending = $state(false);
  let hasAuth = $state(false);
  let authToken = $state(null);
  let repoMeta = $state(null);
  let notesLoading = $state(false);
  let notesError = $state('');

  let contentEls = $state({});
  let dragState = null;
  let resizeState = null;
  let initialized = false;

  const updateNote = (noteId, updater) => {
    notes = notes.map((note) =>
      note.id === noteId ? updater(note) : note
    );
  };

  const updateNoteContent = (noteId, value) => {
    const note = notes.find((entry) => entry.id === noteId);
    if (!note) return;
    const savedContent = note.savedContent ?? '';
    const dirty = value !== savedContent;
    updateNote(noteId, (entry) => ({ ...entry, content: value, dirty }));
  };

  const moveNoteIdentity = (fromId, toId) => {
    if (fromId === toId) return;
    const windowState = windowStates[fromId];
    if (windowState) {
      const { [fromId]: _, ...remaining } = windowStates;
      windowStates = { ...remaining, [toId]: windowState };
      persistStates(windowStates);
    }
    const contentEl = contentEls[fromId];
    if (contentEl) {
      const { [fromId]: __, ...remaining } = contentEls;
      contentEls = { ...remaining, [toId]: contentEl };
    }
  };

  const renameNote = async (noteId, nextBase) => {
    const note = notes.find((entry) => entry.id === noteId);
    if (!note) return;
    const trimmed = (nextBase ?? '').toString().trim();
    const safeBase = (trimmed.replace(/\.md$/i, '').replace(/[\\/]/g, '-')) || `untitled-${Date.now()}`;
    const directory = note.path?.includes('/') ? `${note.path.split('/').slice(0, -1).join('/')}/` : '';
    const filename = `${safeBase}.md`;
    const nextPath = `${directory}${filename}`;
    const currentPath = note.path ?? note.id;
    if (!nextPath || nextPath === currentPath) return;

    const conflict = notes.some((entry) =>
      (entry.path ?? entry.id) === nextPath && entry.id !== noteId
    );
    if (conflict) {
      notesError = `A note named "${filename}" already exists. Choose a different name.`;
      return;
    }

    if (!authToken) {
      notes = sortNotesByPath(notes.map((entry) =>
        entry.id === noteId ? { ...entry, id: nextPath, path: nextPath, filename } : entry
      ));
      moveNoteIdentity(noteId, nextPath);
      return;
    }

    if (note.dirty) {
      await saveNote(noteId);
    }

    const refreshed = notes.find((entry) => entry.id === noteId);
    if (!refreshed || refreshed.dirty) {
      notesError = 'Save the note before renaming.';
      return;
    }

    notesError = '';
    updateNote(noteId, (entry) => ({ ...entry, saving: true }));

    try {
      const { repo, sha: nextSha } = await writeNoteToGitHub(
        authToken,
        { path: nextPath, content: refreshed.content ?? '' },
        repoMeta,
        { message: `Rename ${currentPath} to ${nextPath}` }
      );
      repoMeta = repo;

      const previousSha = refreshed.sha;
      notes = sortNotesByPath(notes.map((entry) =>
        entry.id === noteId
          ? {
              ...entry,
              id: nextPath,
              path: nextPath,
              filename,
              sha: nextSha ?? entry.sha,
              saving: false,
              savedContent: entry.content ?? '',
              dirty: false,
            }
          : entry
      ));
      moveNoteIdentity(noteId, nextPath);

      if (previousSha) {
        try {
          await deleteNoteFromGitHub(
            authToken,
            currentPath,
            previousSha,
            repoMeta,
            { message: `Rename ${currentPath} to ${nextPath}` }
          );
        } catch (error) {
          notesError = error?.message ?? 'Renamed, but failed to remove the old file.';
        }
      } else {
        notesError = 'Renamed, but missing the old file hash to remove it.';
      }
    } catch (error) {
      updateNote(noteId, (entry) => ({ ...entry, saving: false }));
      if (error?.status === 422) {
        notesError = `A note named "${filename}" already exists. Choose a different name.`;
      } else {
        notesError = error?.message ?? 'Failed to rename note on GitHub.';
      }
    }
  };

  const saveNote = async (noteId) => {
    const note = notes.find((entry) => entry.id === noteId);
    if (!note || note.saving || !note.dirty) return;
    if (!authToken) return;

    const path = note.sha ? (note.id || note.path) : (note.path || note.id);
    if (!path) {
      notesError = 'Missing note path for GitHub write-back.';
      return;
    }

    const content = note.content ?? '';
    notesError = '';
    updateNote(noteId, (entry) => ({ ...entry, saving: true }));

    try {
      const { repo, sha } = await writeNoteToGitHub(
        authToken,
        { path, content, sha: note.sha },
        repoMeta
      );
      repoMeta = repo;
      updateNote(noteId, (entry) => ({
        ...entry,
        saving: false,
        savedContent: content,
        dirty: entry.content !== content,
        sha: sha ?? entry.sha,
      }));
    } catch (error) {
      updateNote(noteId, (entry) => ({ ...entry, saving: false }));
      notesError = error?.message ?? 'Failed to save note to GitHub.';
    }
  };

  const handleContentBlur = (noteId) => {
    void saveNote(noteId);
  };

  // Window operations
  const bringToFront = (noteId) => {
    const existing = windowStates[noteId];
    if (existing) {
      windowStates = { ...windowStates, [noteId]: { ...existing, zIndex: topZ++ } };
    }
  };

  const toggleWindow = (noteId) => {
    const existing = windowStates[noteId];
    if (existing?.visible) {
      windowStates = { ...windowStates, [noteId]: { ...existing, visible: false } };
    } else if (existing) {
      windowStates = { ...windowStates, [noteId]: { ...existing, visible: true, zIndex: topZ++ } };
    } else {
      const visibleCount = Object.values(windowStates).filter(s => s.visible).length;
      const pos = getNewWindowPosition(visibleCount);
      windowStates = {
        ...windowStates,
        [noteId]: { x: pos.x, y: pos.y, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, zIndex: topZ++, visible: true }
      };
    }
    persistStates(windowStates);
    sidebarOpen = false;
  };

  const closeWindow = (noteId) => {
    const existing = windowStates[noteId];
    if (existing) {
      windowStates = { ...windowStates, [noteId]: { ...existing, visible: false } };
      persistStates(windowStates);
    }
  };

  // Drag handlers
  const startDrag = (noteId, event) => {
    if (event.target.closest('input, textarea, button')) return;
    event.preventDefault();
    bringToFront(noteId);
    const state = windowStates[noteId];
    if (!state) return;
    dragState = { noteId, startX: event.clientX, startY: event.clientY, origX: state.x, origY: state.y };
  };

  const onDrag = (event) => {
    if (!dragState) return;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    const newX = snapToGrid(Math.max(0, dragState.origX + dx));
    const newY = snapToGrid(Math.max(0, dragState.origY + dy));
    const existing = windowStates[dragState.noteId];
    if (existing) {
      windowStates = { ...windowStates, [dragState.noteId]: { ...existing, x: newX, y: newY } };
    }
  };

  // Resize handlers
  const startResize = (noteId, event) => {
    event.preventDefault();
    event.stopPropagation();
    bringToFront(noteId);
    const state = windowStates[noteId];
    if (!state) return;
    resizeState = {
      noteId,
      startX: event.clientX,
      startY: event.clientY,
      origWidth: state.width ?? DEFAULT_WIDTH,
      origHeight: state.height ?? DEFAULT_HEIGHT
    };
  };

  const onResize = (event) => {
    if (!resizeState) return;
    const minSize = 160;
    const dx = event.clientX - resizeState.startX;
    const dy = event.clientY - resizeState.startY;
    const newWidth = snapToGrid(Math.max(minSize, resizeState.origWidth + dx));
    const newHeight = snapToGrid(Math.max(minSize, resizeState.origHeight + dy));
    const existing = windowStates[resizeState.noteId];
    if (existing) {
      windowStates = { ...windowStates, [resizeState.noteId]: { ...existing, width: newWidth, height: newHeight } };
    }
  };

  const onPointerMove = (event) => { onDrag(event); onResize(event); };
  const endDrag = () => {
    if (dragState || resizeState) {
      persistStates(windowStates);
      dragState = null;
      resizeState = null;
    }
  };

  // Note CRUD
  const addNote = async () => {
    notesError = '';
    const dateBase = formatDateStamp();
    const existingPaths = new Set(
      notes
        .map((note) => note.path ?? note.id)
        .filter(Boolean)
    );
    const filename = getNextDateFilename(dateBase, existingPaths);
    const fresh = normalizeNote(createNote(filename));
    const noteId = fresh.id;
    if (authToken) {
      fresh.saving = true;
    }
    notes = [fresh, ...notes];
    const visibleCount = Object.values(windowStates).filter(s => s.visible).length;
    const pos = getNewWindowPosition(visibleCount);
    windowStates = {
      ...windowStates,
      [fresh.id]: { x: pos.x, y: pos.y, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, zIndex: topZ++, visible: true }
    };
    persistStates(windowStates);
    sidebarOpen = false;

    if (!authToken) return;

    try {
      const { repo, sha } = await writeNoteToGitHub(
        authToken,
        { path: fresh.path, content: '' },
        repoMeta
      );
      repoMeta = repo;
      updateNote(noteId, (entry) => ({
        ...entry,
        saving: false,
        savedContent: '',
        dirty: entry.content !== '',
        sha: sha ?? entry.sha,
      }));
    } catch (error) {
      updateNote(noteId, (entry) => ({ ...entry, saving: false }));
      notesError = error?.message ?? 'Failed to create note on GitHub.';
    }
  };

  const removeNoteLocally = (id) => {
    const target = notes.find((note) => note.id === id);
    if (!target) return 0;
    const { [id]: _, ...remainingStates } = windowStates;
    windowStates = remainingStates;
    persistStates(windowStates);
    const { [id]: __, ...remainingContentEls } = contentEls;
    contentEls = remainingContentEls;
    const remaining = notes.filter((note) => note.id !== id);
    notes = remaining;
    return remaining.length;
  };

  const deleteNote = async (id) => {
    const target = notes.find((note) => note.id === id);
    if (!target) return;
    const label = target.filename?.trim() || 'Untitled note';
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;

    if (!authToken) {
      const remainingCount = removeNoteLocally(id);
      if (!remainingCount) {
        void addNote();
      }
      return;
    }

    const path = target.path ?? target.id;
    if (!path || !target.sha) {
      notesError = 'Missing file info for GitHub delete.';
      return;
    }

    notesError = '';
    updateNote(id, (entry) => ({ ...entry, saving: true }));

    try {
      const { repo } = await deleteNoteFromGitHub(
        authToken,
        path,
        target.sha,
        repoMeta,
        { message: `Delete ${path}` }
      );
      repoMeta = repo;
      const remainingCount = removeNoteLocally(id);
      if (!remainingCount) {
        void addNote();
      }
    } catch (error) {
      updateNote(id, (entry) => ({ ...entry, saving: false }));
      notesError = error?.message ?? 'Failed to delete note from GitHub.';
    }
  };

  const pruneWindowStates = (loadedNotes) => {
    const validIds = new Set(loadedNotes.map((note) => note.id));
    const filtered = Object.fromEntries(
      Object.entries(windowStates).filter(([noteId]) => validIds.has(noteId))
    );
    if (Object.keys(filtered).length !== Object.keys(windowStates).length) {
      windowStates = filtered;
      persistStates(windowStates);
    }
  };

  const loadFromGitHub = async () => {
    if (!authToken) return;
    notesLoading = true;
    notesError = '';
    try {
      const { repo, notes: loadedNotes, truncated } = await loadNotesFromGitHub(authToken);
      repoMeta = repo;
      notes = sortNotesByPath(loadedNotes).map(normalizeNote);
      if (truncated) {
        notesError = 'Repository is large; some files may be missing from the index.';
      }
      pruneWindowStates(notes);
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) {
        clearAuth();
        hasAuth = false;
        authToken = null;
        repoMeta = null;
        notes = [];
        return;
      }
      notesError = error?.message ?? 'Failed to load notes from GitHub.';
      notes = [];
    } finally {
      notesLoading = false;
    }
  };

  // Slash command
  const runSlashCommand = async (noteId) => {
    const contentEl = contentEls[noteId];
    if (!contentEl || commandPending) return;
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    commandPending = true;
    try {
      const result = await executeSlashCommand(note.content ?? '', contentEl.selectionEnd ?? 0);
      if (result) {
        updateNoteContent(noteId, result.newContent);
        await tick();
        contentEl.setSelectionRange(result.newCaret, result.newCaret);
        contentEl.focus();
      }
    } catch (error) {
      console.warn('Slash command failed', error);
    } finally {
      commandPending = false;
    }
  };

  const handleContentKeydown = (noteId, event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void saveNote(noteId);
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      runSlashCommand(noteId);
    }
  };

  // Auth handler
  const handleAuth = async (token) => {
    if (saveAuth(token)) {
      hasAuth = true;
      authToken = token.trim();
      windowStates = loadWindowStates();
      topZ = getTopZ(windowStates);
      await loadFromGitHub();
    }
  };

  // TODO: Remove skip handler before release
  const handleSkip = () => {
    hasAuth = true;
    authToken = null;
    repoMeta = null;
    notes = [normalizeNote(createNote(`untitled-${Date.now()}.md`))];
    windowStates = loadWindowStates();
    topZ = getTopZ(windowStates);
  };

  // Init
  $effect(() => {
    if (!browser) return;
    if (!initialized) {
      initialized = true;
      authToken = loadAuthToken();
      hasAuth = !!authToken;
      windowStates = loadWindowStates();
      topZ = getTopZ(windowStates);
      if (hasAuth) {
        void loadFromGitHub();
      }
    }
  });
</script>

<svelte:head>
  <title>the record</title>
</svelte:head>

<main class:sidebar-open={sidebarOpen} class="page" onpointermove={onPointerMove} onpointerup={endDrag} onpointerleave={endDrag}>
  <div class="glow"></div>
  {#if !hasAuth}
    <OnboardingCard onSubmit={handleAuth} onSkip={handleSkip} />
  {:else}
    {#if notesLoading || notesError}
      <div class:warning={!!notesError} class="note-status" role="status" aria-live="polite">
        {#if notesLoading}
          Loading notes from GitHub...
        {:else}
          {notesError}
        {/if}
      </div>
    {/if}
    <Sidebar
      {notes}
      {windowStates}
      onToggleWindow={toggleWindow}
      onAddNote={addNote}
      onDeleteNote={deleteNote}
      onClose={() => sidebarOpen = false}
    />
    <button class="sidebar-overlay" type="button" aria-label="Close sidebar" onclick={() => sidebarOpen = false}></button>
    <div class="note-shell canvas">
      <header class="note-header">
        <button class="sidebar-toggle" type="button" onclick={() => sidebarOpen = true}>
          Notes
        </button>
      </header>
      {#each getOpenWindows(windowStates) as win (win.noteId)}
        {@const note = notes.find(n => n.id === win.noteId)}
        {#if note}
          <NoteWindow
            {note}
            windowState={win}
            {commandPending}
            onClose={() => closeWindow(win.noteId)}
            onFocus={() => bringToFront(win.noteId)}
            onDragStart={(e) => startDrag(win.noteId, e)}
            onResizeStart={(e) => startResize(win.noteId, e)}
            onTitleChange={(value) => { void renameNote(win.noteId, value); }}
            onContentChange={(value) => { updateNoteContent(win.noteId, value); }}
            onContentKeydown={(e) => handleContentKeydown(win.noteId, e)}
            onContentBlur={() => handleContentBlur(win.noteId)}
            bind:contentElRef={contentEls[win.noteId]}
          />
        {/if}
      {/each}
      <Instructions />
    </div>
  {/if}
</main>

<style>
  .page {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 48px clamp(20px, 6vw, 96px);
    position: relative;
  }

  .page::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle, var(--grid-dot) 1.5px, transparent 1.5px);
    background-size: var(--grid-size) var(--grid-size);
    background-position: 0 0;
    z-index: 0;
    pointer-events: none;
  }

  .glow {
    position: absolute;
    inset: 8% 4% auto auto;
    width: min(420px, 60vw);
    height: min(420px, 60vw);
    background: radial-gradient(circle, rgba(203, 111, 45, 0.22), transparent 70%);
    filter: blur(12px);
    z-index: var(--layer-glow);
  }

  .sidebar-overlay {
    position: fixed;
    inset: 0;
    background: rgba(10, 11, 13, 0.35);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
    z-index: var(--layer-overlay);
    border: none;
  }

  .page.sidebar-open .sidebar-overlay {
    opacity: 1;
    pointer-events: auto;
  }

  .note-shell {
    width: min(720px, 92vw);
    display: grid;
    gap: 18px;
    position: relative;
    z-index: var(--layer-canvas);
  }

  .note-shell.canvas {
    width: 100%;
    height: 100%;
    position: absolute;
    inset: 0;
    display: block;
    overflow: hidden;
    pointer-events: none;
  }

  .note-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .note-status {
    position: fixed;
    top: 24px;
    right: 28px;
    padding: 10px 14px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.8);
    color: var(--muted);
    font-size: 0.72rem;
    letter-spacing: 0.02em;
    box-shadow: 0 8px 18px rgba(210, 160, 120, 0.18);
    z-index: var(--layer-sidebar);
    pointer-events: none;
  }

  .note-status.warning {
    color: rgba(122, 48, 16, 0.9);
    background: rgba(255, 242, 232, 0.9);
  }

  .sidebar-toggle {
    border: none;
    background: rgba(16, 22, 22, 0.08);
    color: var(--ink);
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    display: none;
    pointer-events: auto;
  }

  @media (max-width: 960px) {
    .sidebar-toggle {
      display: inline-flex;
    }
  }
</style>
