<script>
  import { DEFAULT_WIDTH, DEFAULT_HEIGHT } from '$lib/windowManager.js';
  import { getDisplayName } from '$lib/notes.js';
  import MilkdownEditor from '$lib/components/MilkdownEditor.svelte';

  let {
    note,
    windowState,
    onClose,
    onFocus,
    onDragStart,
    onResizeStart,
    onTitleChange,
    canOpenOnGitHub = false,
    onOpenOnGitHub,
    onContentChange,
    onContentKeydown,
    onContentBlur,
    onContentCommand,
    onContentCommandError,
    followupValue = '',
    followupEnabled = false,
    followupPending = false,
    followupError = '',
    onFollowupChange,
    onFollowupSubmit,
    onFollowupKeydown,
  } = $props();

  let editingTitle = $state(false);
  let draftTitle = $state('');

  const displayName = $derived.by(() => getDisplayName(note));
  const isTranscript = $derived.by(() => note?.type === 'transcript');
  const editorValue = $derived.by(() => note?.content ?? '');
  const status = $derived.by(() => {
    if (note?.saving) {
      return { label: 'Saving', ellipsis: true };
    }
    if (note?.dirty) {
      return { label: 'Edited', ellipsis: false };
    }
    return null;
  });

  $effect(() => {
    if (editingTitle) {
      draftTitle = displayName.base;
    }
  });

  const commitTitle = () => {
    onTitleChange?.(draftTitle);
    editingTitle = false;
  };

  const cancelTitle = () => {
    draftTitle = displayName.base;
    editingTitle = false;
  };

  const handleContentChange = (value) => {
    onContentChange?.(value);
  };

  function focusOnMount(node) {
    node.focus();
    node.select();
  }
</script>

<section
  class:transcript={isTranscript}
  class="note"
  aria-label="Note"
  style="left: {windowState.x}px; top: {windowState.y}px; width: {windowState.width ?? DEFAULT_WIDTH}px; height: {windowState.height ?? DEFAULT_HEIGHT}px; z-index: {windowState.zIndex};"
  onpointerdown={onFocus}
>
  <div
    class="note-titlebar"
    role="toolbar"
    tabindex="-1"
    onpointerdown={onDragStart}
    ondblclick={() => {
      editingTitle = true;
      draftTitle = displayName.base;
    }}
  >
    <button class="window-close" type="button" aria-label="Close note" onclick={onClose}>
      <svg viewBox="0 0 14 14" fill="none">
        <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </button>
    {#if editingTitle}
      <input
        class="note-title"
        type="text"
        placeholder="Untitled"
        value={draftTitle}
        oninput={(e) => {
          draftTitle = e.target.value;
        }}
        onblur={commitTitle}
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitTitle();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelTitle();
          }
        }}
        use:focusOnMount
      />
    {:else}
      <span class="note-title-display">
        <span class="note-title-main">
          <span class="note-title-base">{displayName.base}</span>
          {#if displayName.ext}
            <span class="note-title-ext">{displayName.ext}</span>
          {/if}
          <button
            class="note-title-open"
            type="button"
            aria-label="Open file on GitHub"
            title={canOpenOnGitHub ? 'Open on GitHub' : 'GitHub link unavailable'}
            disabled={!canOpenOnGitHub}
            onpointerdown={(event) => {
              event.stopPropagation();
            }}
            onclick={(event) => {
              event.stopPropagation();
              onOpenOnGitHub?.();
            }}
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M4 12L12 4M6.5 4H12V9.5"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </span>
        {#if status}
          <span class="note-title-status">&nbsp;&mdash; {status.label}{#if status.ellipsis}&hellip;{/if}</span>
        {/if}
      </span>
    {/if}
  </div>

  <div class="note-editor">
    <MilkdownEditor
      value={editorValue}
      placeholder={isTranscript ? 'Transcript markdown...' : 'Write your note...'}
      onChange={handleContentChange}
      onKeydown={onContentKeydown}
      onBlur={onContentBlur}
      onSlashCommand={onContentCommand}
      onSlashCommandError={onContentCommandError}
    />
  </div>

  {#if isTranscript}
    <div class="transcript-followup">
      <input
        class="followup-input"
        type="text"
        value={followupValue}
        placeholder={followupEnabled
          ? followupPending
            ? 'Thinking...'
            : 'Ask a follow-up...'
          : 'Follow-ups coming soon...'}
        disabled={!followupEnabled || followupPending}
        oninput={(e) => onFollowupChange?.(e.target.value)}
        onkeydown={onFollowupKeydown}
      />
      <button
        class="followup-send"
        type="button"
        onclick={onFollowupSubmit}
        disabled={!followupEnabled || followupPending}
      >
        {followupPending ? 'Thinking...' : 'Ask'}
      </button>
    </div>
    {#if followupError}
      <p class="followup-error" role="alert">{followupError}</p>
    {/if}
  {/if}

  <div class="note-resize-handle" onpointerdown={onResizeStart}></div>
</section>

<style>
  .note {
    position: absolute;
    background: rgba(255, 255, 255, 0.85);
    border-radius: 10px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow:
      0 0 0 0.5px rgba(0, 0, 0, 0.05),
      0 2px 8px rgba(0, 0, 0, 0.08),
      0 8px 24px rgba(0, 0, 0, 0.12);
    backdrop-filter: blur(12px);
    display: grid;
    grid-template-rows: auto 1fr;
    gap: 0;
    animation: riseIn 0.3s ease both;
    overflow: hidden;
    user-select: none;
    pointer-events: auto;
  }

  .note.transcript {
    grid-template-rows: auto 1fr auto;
  }

  .note-editor {
    min-height: 0;
  }

  .note-titlebar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0.9), rgba(245, 245, 245, 0.9));
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    cursor: grab;
  }

  .note-titlebar:active {
    cursor: grabbing;
  }

  .window-close {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: rgba(16, 22, 22, 0.35);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }

  .window-close svg {
    width: 14px;
    height: 14px;
  }

  .window-close:hover {
    background: rgba(16, 22, 22, 0.08);
    color: rgba(16, 22, 22, 0.7);
  }

  .note-title-display {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    font-family: var(--font-ui);
    font-size: 0.85rem;
    font-weight: 500;
    color: rgba(16, 22, 22, 0.85);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 60%;
    pointer-events: none;
    display: inline-flex;
    align-items: center;
  }

  .note-title-main {
    min-width: 0;
    display: inline-flex;
    align-items: center;
  }

  .note-title-base {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .note-title-ext {
    color: rgba(16, 22, 22, 0.45);
    font-weight: 500;
    flex-shrink: 0;
  }

  .note-title-open {
    width: 24px;
    height: 24px;
    margin-left: 2px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: rgba(16, 22, 22, 0.35);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    pointer-events: auto;
    transition: all 0.15s ease;
  }

  .note-title-open svg {
    width: 14px;
    height: 14px;
  }

  .note-title-open:hover:not(:disabled) {
    background: rgba(16, 22, 22, 0.08);
    color: rgba(16, 22, 22, 0.7);
  }

  .note-title-open:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .note-title-status {
    color: rgba(16, 22, 22, 0.45);
    flex-shrink: 0;
  }

  .note-title {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: 60%;
    font-family: var(--font-ui);
    font-size: 0.85rem;
    font-weight: 500;
    text-align: center;
    letter-spacing: 0;
    border: none;
    outline: none;
    background: transparent;
    color: rgba(16, 22, 22, 0.85);
    cursor: text;
    user-select: text;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .note-title::placeholder {
    color: var(--muted);
  }

  .note-title:focus::placeholder {
    color: transparent;
  }

  .note.transcript :global(.milkdown .editor .bubble) {
    display: block;
    width: fit-content;
    max-width: min(520px, 90%);
    padding: 10px 14px;
    border-radius: 16px 16px 4px 16px;
    margin: 0.4rem 0 0.8rem auto;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
    background: linear-gradient(140deg, rgba(234, 129, 70, 0.2), rgba(214, 90, 24, 0.2));
    border: 1px solid rgba(214, 90, 24, 0.2);
    color: rgba(82, 39, 19, 0.95);
    box-shadow: 0 12px 20px rgba(214, 90, 24, 0.12);
  }

  .note.transcript :global(.milkdown .editor pre code) {
    font-size: 0.82rem;
    line-height: 1.45;
    background: rgba(10, 115, 104, 0.1);
    border: 1px solid rgba(10, 115, 104, 0.2);
  }

  .note.transcript :global(.milkdown .editor hr) {
    margin: 0.8rem 0 1rem;
    opacity: 0.35;
  }

  .transcript-followup {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 10px;
    padding: 12px 16px 16px;
    border-top: 1px solid rgba(16, 22, 22, 0.08);
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0.7), rgba(245, 240, 235, 0.85));
  }

  .followup-input {
    border-radius: 999px;
    border: 1px solid rgba(16, 22, 22, 0.12);
    padding: 8px 14px;
    font-size: 0.9rem;
    outline: none;
    background: rgba(255, 255, 255, 0.9);
  }

  .followup-input:disabled {
    background: rgba(250, 248, 246, 0.9);
    color: rgba(79, 91, 91, 0.6);
    cursor: not-allowed;
  }

  .followup-input::placeholder {
    color: rgba(79, 91, 91, 0.75);
  }

  .followup-send {
    border: none;
    background: rgba(214, 90, 24, 0.9);
    color: #fff;
    padding: 0 18px;
    border-radius: 999px;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    letter-spacing: 0.01em;
  }

  .followup-send:disabled {
    background: rgba(214, 90, 24, 0.35);
    cursor: not-allowed;
  }

  .followup-error {
    margin: -6px 16px 12px;
    font-size: 0.82rem;
    color: rgba(122, 48, 16, 0.85);
  }

  .note-resize-handle {
    position: absolute;
    right: 4px;
    bottom: 4px;
    width: 12px;
    height: 12px;
    cursor: se-resize;
    background:
      linear-gradient(135deg, transparent 50%, rgba(16, 22, 22, 0.25) 50%, rgba(16, 22, 22, 0.25) 55%, transparent 55%),
      linear-gradient(135deg, transparent 65%, rgba(16, 22, 22, 0.25) 65%, rgba(16, 22, 22, 0.25) 70%, transparent 70%);
  }

  .note-resize-handle:hover {
    background:
      linear-gradient(135deg, transparent 50%, rgba(16, 22, 22, 0.4) 50%, rgba(16, 22, 22, 0.4) 55%, transparent 55%),
      linear-gradient(135deg, transparent 65%, rgba(16, 22, 22, 0.4) 65%, rgba(16, 22, 22, 0.4) 70%, transparent 70%);
  }

  @media (max-width: 720px) {
    .note {
      min-height: 60vh;
    }
  }
</style>
