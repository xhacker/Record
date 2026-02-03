<script>
  import { tick } from 'svelte';
  import { browser } from '$app/environment';
  import { loadAuthToken, saveAuth } from '$lib/auth.js';
  import {
    createNote,
    sortNotesByPath,
    formatDateStamp,
    getNextDateFilename,
    normalizeNote,
    formatTranscriptTimestamp,
    buildTranscriptContent,
    getUniquePath,
  } from '$lib/notes.js';
  import * as remote from '$lib/remote.js';
  import {
    loadWindowStates,
    getTopZ,
    persistStates,
    getOpenWindows,
    snapToGrid,
    createWindowState,
    DEFAULT_WIDTH,
    DEFAULT_HEIGHT,
  } from '$lib/windowManager.js';
  import { executeSlashCommand } from '$lib/slashCommand.js';
  import { AI_CONFIG } from '$lib/config.js';
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
  let askOpen = $state(false);
  let askPrompt = $state('');
  let askPending = $state(false);
  let askError = $state('');
  let followupDrafts = $state({});

  const ASK_LABEL = 'Ask AI';
  const ASK_PLACEHOLDER = 'Ask a question...';
  const FOLLOWUP_ENABLED = false;

  let contentEls = $state({});
  let dragState = null;
  let resizeState = null;
  let initialized = false;

  // Note state helpers
  const updateNote = (noteId, updater) => {
    notes = notes.map((note) => note.id === noteId ? updater(note) : note);
  };

  const updateNotes = (updater) => {
    notes = updater(notes);
  };

  const updateNoteContent = (noteId, value) => {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;
    const dirty = value !== (note.savedContent ?? '');
    updateNote(noteId, (n) => ({ ...n, content: value, dirty }));
  };

  const updateFollowupDraft = (noteId, value) => {
    followupDrafts = { ...followupDrafts, [noteId]: value };
  };

  const getExistingPaths = () =>
    new Set(notes.map((n) => n.path ?? n.id).filter(Boolean));

  const moveNoteIdentity = (fromId, toId) => {
    if (fromId === toId) return;
    if (windowStates[fromId]) {
      const { [fromId]: ws, ...rest } = windowStates;
      windowStates = { ...rest, [toId]: ws };
      persistStates(windowStates);
    }
    if (contentEls[fromId]) {
      const { [fromId]: el, ...rest } = contentEls;
      contentEls = { ...rest, [toId]: el };
    }
  };

  // GitHub sync operations
  const saveNote = async (noteId) => {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;
    notesError = '';
    const result = await remote.saveNote(note, authToken, repoMeta, updateNote);
    if (result.result?.repo) repoMeta = result.result.repo;
    if (!result.success) notesError = result.error;
  };

  const renameNote = async (noteId, nextBase) => {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    const trimmed = (nextBase ?? '').toString().trim();
    const safeBase = (trimmed.replace(/\.md$/i, '').replace(/[\\/]/g, '-')) || `untitled-${Date.now()}`;
    const directory = note.path?.includes('/') ? `${note.path.split('/').slice(0, -1).join('/')}/` : '';
    const filename = `${safeBase}.md`;
    const nextPath = `${directory}${filename}`;
    const currentPath = note.path ?? note.id;

    if (!nextPath || nextPath === currentPath) return;
    if (notes.some((n) => (n.path ?? n.id) === nextPath && n.id !== noteId)) {
      notesError = `A note named "${filename}" already exists.`;
      return;
    }

    // Local-only mode
    if (!authToken) {
      notes = sortNotesByPath(notes.map((n) =>
        n.id === noteId ? { ...n, id: nextPath, path: nextPath, filename } : n
      ));
      moveNoteIdentity(noteId, nextPath);
      return;
    }

    // Save first if dirty
    if (note.dirty) await saveNote(noteId);
    const refreshed = notes.find((n) => n.id === noteId);
    if (!refreshed || refreshed.dirty) {
      notesError = 'Save the note before renaming.';
      return;
    }

    notesError = '';
    const result = await remote.renameNote(refreshed, nextPath, filename, authToken, repoMeta, updateNote, updateNotes);
    if (result.success) {
      moveNoteIdentity(noteId, result.result.newId);
      repoMeta = result.result.repo;
      if (result.result.deleteError) notesError = result.result.deleteError;
    } else {
      notesError = result.error?.includes('422') ? `A note named "${filename}" already exists.` : result.error;
    }
  };

  // Shared helper for inserting notes (used by addNote and addTranscript)
  const insertAndSyncNote = async (note) => {
    notesError = '';
    const fresh = { ...note };
    if (authToken) fresh.saving = true;

    notes = [fresh, ...notes];
    windowStates = { ...windowStates, [fresh.id]: createWindowState(windowStates, topZ++) };
    persistStates(windowStates);
    sidebarOpen = false;

    if (!authToken) return;
    const result = await remote.createNote(fresh, authToken, repoMeta, updateNote);
    if (result.result?.repo) repoMeta = result.result.repo;
    if (!result.success) notesError = result.error;
  };

  const addNote = async () => {
    const filename = getNextDateFilename(formatDateStamp(), getExistingPaths());
    await insertAndSyncNote(normalizeNote(createNote(filename)));
  };

  const addTranscript = async ({ prompt, response }) => {
    const baseStamp = formatTranscriptTimestamp(new Date());
    const path = getUniquePath(`transcripts/${baseStamp}.md`, getExistingPaths());
    const threadId = (path.split('/').pop() || baseStamp).replace(/\.md$/i, '');
    const content = buildTranscriptContent({
      threadId,
      userPrompt: prompt,
      assistantContent: response,
    });
    await insertAndSyncNote(normalizeNote(createNote(path, content, 'transcript')));
  };

  const openAskPanel = () => {
    askPrompt = '';
    askError = '';
    askOpen = true;
  };

  const closeAskPanel = () => {
    askOpen = false;
    askError = '';
  };

  const submitAsk = async () => {
    if (askPending) return;
    const prompt = askPrompt.trim();
    if (!prompt) {
      askError = 'Write a question first.';
      return;
    }

    askPending = true;
    askError = '';
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: AI_CONFIG.askModel,
          temperature: AI_CONFIG.askTemperature,
          max_completion_tokens: AI_CONFIG.askMaxTokens,
          top_p: 1,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to ask AI.');
      }
      const assistantContent = (payload?.content ?? '').trim();
      if (!assistantContent) {
        throw new Error('AI response was empty.');
      }
      await addTranscript({ prompt, response: assistantContent });
      askOpen = false;
      askPrompt = '';
    } catch (error) {
      askError = error?.message ?? 'Failed to ask AI.';
    } finally {
      askPending = false;
    }
  };

  const removeNoteLocally = (id) => {
    if (!notes.find((n) => n.id === id)) return 0;
    const { [id]: _, ...rest } = windowStates;
    windowStates = rest;
    persistStates(windowStates);
    const { [id]: __, ...restEls } = contentEls;
    contentEls = restEls;
    const { [id]: ___, ...restFollowups } = followupDrafts;
    followupDrafts = restFollowups;
    notes = notes.filter((n) => n.id !== id);
    return notes.length;
  };

  const deleteNote = async (id) => {
    const target = notes.find((n) => n.id === id);
    if (!target) return;
    if (!window.confirm(`Delete "${target.filename?.trim() || 'Untitled'}"? This cannot be undone.`)) return;

    if (!authToken) {
      if (!removeNoteLocally(id)) void addNote();
      return;
    }

    notesError = '';
    const result = await remote.deleteNote(target, authToken, repoMeta, updateNote);
    if (result.success) {
      repoMeta = result.result.repo;
      if (!removeNoteLocally(id)) void addNote();
    } else {
      notesError = result.error;
    }
  };

  const loadFromGitHub = async () => {
    if (!authToken) return;
    await remote.loadNotes(authToken, {
      onStart: () => { notesLoading = true; notesError = ''; },
      onSuccess: ({ repo, notes: loaded, truncated }) => {
        repoMeta = repo;
        notes = loaded;
        if (truncated) notesError = 'Repository is large; some files may be missing.';
        // Prune stale window states
        const validIds = new Set(notes.map((n) => n.id));
        const filtered = Object.fromEntries(Object.entries(windowStates).filter(([id]) => validIds.has(id)));
        if (Object.keys(filtered).length !== Object.keys(windowStates).length) {
          windowStates = filtered;
          persistStates(windowStates);
        }
      },
      onAuthError: () => { hasAuth = false; authToken = null; repoMeta = null; notes = []; },
      onError: (msg) => { notesError = msg; notes = []; },
      onFinally: () => { notesLoading = false; },
    });
  };

  // Window operations
  const bringToFront = (noteId) => {
    if (windowStates[noteId]) {
      windowStates = { ...windowStates, [noteId]: { ...windowStates[noteId], zIndex: topZ++ } };
    }
  };

  const toggleWindow = (noteId) => {
    const existing = windowStates[noteId];
    if (existing?.visible) {
      windowStates = { ...windowStates, [noteId]: { ...existing, visible: false } };
    } else if (existing) {
      windowStates = { ...windowStates, [noteId]: { ...existing, visible: true, zIndex: topZ++ } };
    } else {
      windowStates = { ...windowStates, [noteId]: createWindowState(windowStates, topZ++) };
    }
    persistStates(windowStates);
    sidebarOpen = false;
  };

  const closeWindow = (noteId) => {
    if (windowStates[noteId]) {
      windowStates = { ...windowStates, [noteId]: { ...windowStates[noteId], visible: false } };
      persistStates(windowStates);
    }
  };

  // Drag & Resize
  const startDrag = (noteId, event) => {
    if (event.target.closest('input, textarea, button')) return;
    event.preventDefault();
    bringToFront(noteId);
    const state = windowStates[noteId];
    if (state) dragState = { noteId, startX: event.clientX, startY: event.clientY, origX: state.x, origY: state.y };
  };

  const startResize = (noteId, event) => {
    event.preventDefault();
    event.stopPropagation();
    bringToFront(noteId);
    const state = windowStates[noteId];
    if (state) resizeState = { noteId, startX: event.clientX, startY: event.clientY, origWidth: state.width ?? DEFAULT_WIDTH, origHeight: state.height ?? DEFAULT_HEIGHT };
  };

  const onPointerMove = (event) => {
    if (dragState) {
      const newX = snapToGrid(Math.max(0, dragState.origX + event.clientX - dragState.startX));
      const newY = snapToGrid(Math.max(0, dragState.origY + event.clientY - dragState.startY));
      windowStates = { ...windowStates, [dragState.noteId]: { ...windowStates[dragState.noteId], x: newX, y: newY } };
    }
    if (resizeState) {
      const newWidth = snapToGrid(Math.max(160, resizeState.origWidth + event.clientX - resizeState.startX));
      const newHeight = snapToGrid(Math.max(160, resizeState.origHeight + event.clientY - resizeState.startY));
      windowStates = { ...windowStates, [resizeState.noteId]: { ...windowStates[resizeState.noteId], width: newWidth, height: newHeight } };
    }
  };

  const endDrag = () => {
    if (dragState || resizeState) {
      persistStates(windowStates);
      dragState = null;
      resizeState = null;
    }
  };

  // Slash command
  const runSlashCommand = async (noteId) => {
    const contentEl = contentEls[noteId];
    const note = notes.find((n) => n.id === noteId);
    if (!contentEl || !note || commandPending) return;

    commandPending = true;
    try {
      const result = await executeSlashCommand(note.content ?? '', contentEl.selectionEnd ?? 0);
      if (result) {
        updateNoteContent(noteId, result.newContent);
        await tick();
        contentEl.setSelectionRange(result.newCaret, result.newCaret);
        contentEl.focus();
      }
    } finally {
      commandPending = false;
    }
  };

  const handleContentKeydown = (noteId, event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void saveNote(noteId);
    } else if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      runSlashCommand(noteId);
    }
  };

  // Auth
  const handleAuth = async (token) => {
    if (saveAuth(token)) {
      hasAuth = true;
      authToken = token.trim();
      windowStates = loadWindowStates();
      topZ = getTopZ(windowStates);
      await loadFromGitHub();
    }
  };

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
    if (!browser || initialized) return;
    initialized = true;
    authToken = loadAuthToken();
    hasAuth = !!authToken;
    windowStates = loadWindowStates();
    topZ = getTopZ(windowStates);
    if (hasAuth) void loadFromGitHub();
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
    <div class="top-actions">
      {#if notesLoading || notesError}
        <div class:warning={!!notesError} class="note-status" role="status" aria-live="polite">
          {#if notesLoading}
            Loading notes from GitHub...
          {:else}
            {notesError}
          {/if}
        </div>
      {/if}
      <div class="ask-stack">
        <button class="ask-ai" type="button" onclick={openAskPanel} disabled={askPending}>
          {ASK_LABEL}
        </button>
        {#if askOpen}
          <div class="ask-panel" role="dialog" aria-label="Ask AI">
            <p class="ask-panel-title">Ask the record</p>
            <textarea
              class="ask-input"
              rows="3"
              placeholder={ASK_PLACEHOLDER}
              value={askPrompt}
              oninput={(e) => { askPrompt = e.target.value; }}
              onkeydown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  submitAsk();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  closeAskPanel();
                }
              }}
            ></textarea>
            {#if askError}
              <p class="ask-error" role="alert">{askError}</p>
            {/if}
            <div class="ask-panel-actions">
              <button class="ask-submit" type="button" onclick={submitAsk} disabled={askPending}>
                {askPending ? 'Thinking...' : 'Ask'}
              </button>
              <button class="ask-cancel" type="button" onclick={closeAskPanel} disabled={askPending}>
                Cancel
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
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
            followupValue={followupDrafts[win.noteId] ?? ''}
            followupEnabled={FOLLOWUP_ENABLED}
            onFollowupChange={(value) => updateFollowupDraft(win.noteId, value)}
            onClose={() => closeWindow(win.noteId)}
            onFocus={() => bringToFront(win.noteId)}
            onDragStart={(e) => startDrag(win.noteId, e)}
            onResizeStart={(e) => startResize(win.noteId, e)}
            onTitleChange={(value) => { void renameNote(win.noteId, value); }}
            onContentChange={(value) => { updateNoteContent(win.noteId, value); }}
            onContentKeydown={(e) => handleContentKeydown(win.noteId, e)}
            onContentBlur={() => void saveNote(win.noteId)}
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

  .top-actions {
    position: fixed;
    top: 24px;
    right: 28px;
    display: grid;
    gap: 10px;
    z-index: var(--layer-sidebar);
    pointer-events: auto;
  }

  .ask-stack {
    display: grid;
    justify-items: end;
    gap: 10px;
  }

  .ask-ai {
    border: none;
    background: rgba(214, 90, 24, 0.9);
    color: #fff;
    padding: 10px 16px;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    box-shadow: 0 10px 20px rgba(214, 90, 24, 0.25);
  }

  .ask-ai:disabled {
    cursor: wait;
    opacity: 0.7;
  }

  .ask-panel {
    width: min(360px, 90vw);
    background: rgba(255, 255, 255, 0.95);
    border-radius: 16px;
    border: 1px solid rgba(16, 22, 22, 0.1);
    padding: 16px;
    box-shadow: 0 20px 40px rgba(16, 22, 22, 0.12);
    display: grid;
    gap: 10px;
  }

  .ask-panel-title {
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(16, 22, 22, 0.55);
    font-weight: 600;
  }

  .ask-input {
    width: 100%;
    border-radius: 12px;
    border: 1px solid rgba(16, 22, 22, 0.12);
    padding: 10px 12px;
    font-size: 0.95rem;
    resize: none;
    outline: none;
    background: rgba(255, 255, 255, 0.9);
  }

  .ask-error {
    color: rgba(122, 48, 16, 0.9);
    font-size: 0.78rem;
  }

  .ask-panel-actions {
    display: grid;
    grid-template-columns: auto auto;
    justify-content: end;
    gap: 8px;
  }

  .ask-submit {
    border: none;
    background: rgba(16, 22, 22, 0.9);
    color: #fff;
    padding: 8px 16px;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
  }

  .ask-submit:disabled {
    cursor: wait;
    opacity: 0.7;
  }

  .ask-cancel {
    border: none;
    background: rgba(16, 22, 22, 0.1);
    color: rgba(16, 22, 22, 0.7);
    padding: 8px 14px;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
  }

  .note-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .note-status {
    padding: 10px 14px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.8);
    color: var(--muted);
    font-size: 0.72rem;
    letter-spacing: 0.02em;
    box-shadow: 0 8px 18px rgba(210, 160, 120, 0.18);
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
