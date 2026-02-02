<script>
  import { tick } from 'svelte';
  import { browser } from '$app/environment';
  import { loadAuth, saveAuth } from '$lib/auth.js';
  import { createNote, sortNotes, loadNotes, persistNotes } from '$lib/notes.js';
  import {
    loadWindowStates,
    getTopZ,
    persistStates,
    getOpenWindows,
    getNewWindowPosition,
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

  let autosaveTimers = {};
  let contentEls = $state({});
  let dragState = null;
  let resizeState = null;
  let initialized = false;

  // Note operations
  const updateNote = (noteId, field, value) => {
    notes = notes.map((note) =>
      note.id === noteId ? { ...note, [field]: value } : note
    );
  };

  const commitNote = (noteId) => {
    notes = sortNotes(
      notes.map((note) =>
        note.id === noteId ? { ...note, updatedAt: Date.now() } : note
      )
    );
    persistNotes(notes);
  };

  const scheduleSave = (noteId) => {
    if (autosaveTimers[noteId]) clearTimeout(autosaveTimers[noteId]);
    autosaveTimers[noteId] = setTimeout(() => commitNote(noteId), 400);
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
    if (autosaveTimers[noteId]) {
      clearTimeout(autosaveTimers[noteId]);
      delete autosaveTimers[noteId];
    }
    commitNote(noteId);
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
    const { snapToGrid } = import.meta.glob ? { snapToGrid: (v) => Math.round(v / 40) * 40 } : {};
    const snap = (v) => Math.round(v / 40) * 40;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    const newX = snap(Math.max(0, dragState.origX + dx));
    const newY = snap(Math.max(0, dragState.origY + dy));
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
    const snap = (v) => Math.round(v / 40) * 40;
    const minSize = 160;
    const dx = event.clientX - resizeState.startX;
    const dy = event.clientY - resizeState.startY;
    const newWidth = snap(Math.max(minSize, resizeState.origWidth + dx));
    const newHeight = snap(Math.max(minSize, resizeState.origHeight + dy));
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
  const addNote = () => {
    const fresh = createNote();
    notes = [fresh, ...notes];
    persistNotes(notes);
    const visibleCount = Object.values(windowStates).filter(s => s.visible).length;
    const pos = getNewWindowPosition(visibleCount);
    windowStates = {
      ...windowStates,
      [fresh.id]: { x: pos.x, y: pos.y, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, zIndex: topZ++, visible: true }
    };
    persistStates(windowStates);
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
    const { [id]: _, ...remainingStates } = windowStates;
    windowStates = remainingStates;
    persistStates(windowStates);
    let remaining = notes.filter((note) => note.id !== id);
    if (!remaining.length) remaining = [createNote()];
    notes = remaining;
    persistNotes(notes);
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
        updateNote(noteId, 'content', result.newContent);
        scheduleSave(noteId);
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
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      runSlashCommand(noteId);
    }
  };

  // Auth handler
  const handleAuth = (token) => {
    if (saveAuth(token)) {
      hasAuth = true;
      notes = loadNotes();
      windowStates = loadWindowStates();
      topZ = getTopZ(windowStates);
    }
  };

  // TODO: Remove skip handler before release
  const handleSkip = () => {
    hasAuth = true;
    notes = loadNotes();
    windowStates = loadWindowStates();
    topZ = getTopZ(windowStates);
  };

  // Init
  $effect(() => {
    if (!browser) return;
    if (!initialized) {
      initialized = true;
      hasAuth = loadAuth();
      if (hasAuth) {
        notes = loadNotes();
        windowStates = loadWindowStates();
        topZ = getTopZ(windowStates);
      }
    }
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
  {#if !hasAuth}
    <OnboardingCard onSubmit={handleAuth} onSkip={handleSkip} />
  {:else}
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
            onTitleChange={(value) => { updateNote(win.noteId, 'title', value); scheduleSave(win.noteId); }}
            onContentChange={(value) => { updateNote(win.noteId, 'content', value); scheduleSave(win.noteId); }}
            onContentKeydown={(e) => handleContentKeydown(win.noteId, e)}
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
