<script>
  import { DEFAULT_WIDTH, DEFAULT_HEIGHT } from '$lib/windowManager.js';
  import { formatToolResult, getDisplayName, parseTranscriptContent } from '$lib/notes.js';

  let {
    note,
    windowState,
    commandPending = false,
    onClose,
    onFocus,
    onDragStart,
    onResizeStart,
    onTitleChange,
    onContentChange,
    onContentKeydown,
    onContentBlur,
    followupValue = '',
    followupEnabled = false,
    followupPending = false,
    followupError = '',
    onFollowupChange,
    onFollowupSubmit,
    onFollowupKeydown,
    contentElRef = $bindable(),
  } = $props();

  let editingTitle = $state(false);
  let draftTitle = $state('');

  const displayName = $derived.by(() => getDisplayName(note));
  const isTranscript = $derived.by(() => note?.type === 'transcript');
  const transcript = $derived.by(() => (isTranscript ? parseTranscriptContent(note?.content ?? '') : null));
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

  function focusOnMount(node) {
    node.focus();
    node.select();
  }

  let toolDetailsOpen = $state({});

  const toggleToolDetails = (index) => {
    toolDetailsOpen = { ...toolDetailsOpen, [index]: !toolDetailsOpen[index] };
  };

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
    onpointerdown={onDragStart}
    ondblclick={() => { editingTitle = true; draftTitle = displayName.base; }}
  >
    <button class="window-close" type="button" aria-label="Close note" onclick={onClose}>
      <svg viewBox="0 0 14 14" fill="none">
        <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
    {#if editingTitle}
      <input
        class="note-title"
        type="text"
        placeholder="Untitled"
        value={draftTitle}
        oninput={(e) => { draftTitle = e.target.value; }}
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
        <span class="note-title-base">{displayName.base}</span>
        {#if displayName.ext}
          <span class="note-title-ext">{displayName.ext}</span>
        {/if}
        {#if status}
          <span class="note-title-status">&nbsp;&mdash; {status.label}{#if status.ellipsis}&hellip;{/if}</span>
        {/if}
      </span>
    {/if}
  </div>
  {#if isTranscript}
    <div class="note-content transcript-body" aria-live="polite">
      {#if transcript?.turns?.length}
        {#each transcript.turns as turn, turnIndex}
          {#if turn.userText}
            <div class="bubble user">{turn.userText}</div>
          {/if}
          {#if turn.toolResults?.length}
            {@const toolSummary = turn.toolResults
              .map((result) => result?.tool)
              .filter(Boolean)
              .join(', ')}
            {@const isOpen = !!toolDetailsOpen[turnIndex]}
            <div class="bubble tool">
              <button
                class="tool-toggle"
                type="button"
                aria-expanded={isOpen}
                onclick={() => toggleToolDetails(turnIndex)}
              >
                <span>Calling tools{toolSummary ? `: ${toolSummary}` : ''}</span>
                <svg class="tool-chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path
                    d="M6 3.5l4 4-4 4"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              {#if isOpen}
                <div class="tool-details">
                  {#each turn.toolResults as result, idx (`${turnIndex}:${idx}`)}
                    <div class="tool-entry">
                      <div class="tool-label">{result.tool}</div>
                      <pre class="tool-content">{formatToolResult(result.content)}</pre>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
          {#if turn.assistantText}
            <div class="assistant-text">{turn.assistantText}</div>
          {/if}
        {/each}
      {:else if transcript?.assistantText}
        <div class="assistant-text">{transcript.assistantText}</div>
      {/if}
    </div>
    <div class="transcript-followup">
      <input
        class="followup-input"
        type="text"
        value={followupValue}
        placeholder={followupEnabled ? (followupPending ? 'Thinking...' : 'Ask a follow-up...') : 'Follow-ups coming soon...'}
        disabled={!followupEnabled || followupPending}
        oninput={(e) => onFollowupChange?.(e.target.value)}
        onkeydown={onFollowupKeydown}
      />
      <button class="followup-send" type="button" onclick={onFollowupSubmit} disabled={!followupEnabled || followupPending}>
        {followupPending ? 'Thinking...' : 'Ask'}
      </button>
    </div>
    {#if followupError}
      <p class="followup-error" role="alert">{followupError}</p>
    {/if}
  {:else}
    <textarea
      class="note-content"
      placeholder="Write your note..."
      value={note.content}
      bind:this={contentElRef}
      oninput={(e) => onContentChange(e.target.value)}
      onkeydown={onContentKeydown}
      onblur={onContentBlur}
      aria-busy={commandPending}
    ></textarea>
  {/if}
  <div
    class="note-resize-handle"
    onpointerdown={onResizeStart}
  ></div>
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
    align-items: baseline;
  }

  .note-title-base {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .note-title-ext {
    color: rgba(16, 22, 22, 0.45);
    font-weight: 500;
    flex-shrink: 0;
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

  .note-content {
    border: none;
    outline: none;
    background: transparent;
    resize: none;
    min-height: 0;
    line-height: 1.6;
    color: var(--ink);
    font-size: 1rem;
    padding: clamp(20px, 4vw, 32px);
    user-select: text;
    cursor: text;
  }

  .note-content::placeholder {
    color: var(--muted);
  }

  .transcript-body {
    padding: clamp(20px, 4vw, 28px);
    overflow-y: auto;
    display: grid;
    gap: 16px;
    color: var(--ink);
    user-select: text;
  }

  .transcript-body .bubble {
    max-width: min(520px, 90%);
    padding: 10px 14px;
    font-size: 0.95rem;
    line-height: 1.5;
    box-shadow: 0 12px 20px rgba(16, 22, 22, 0.1);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .transcript-body .bubble.user {
    align-self: flex-end;
    border-radius: 16px 16px 4px 16px;
    background: linear-gradient(140deg, rgba(234, 129, 70, 0.2), rgba(214, 90, 24, 0.2));
    border: 1px solid rgba(214, 90, 24, 0.2);
    color: rgba(82, 39, 19, 0.95);
    box-shadow: 0 12px 20px rgba(214, 90, 24, 0.12);
  }

  .transcript-body .bubble.tool {
    align-self: flex-start;
    padding: 0;
    border-radius: 16px 16px 16px 4px;
    background: linear-gradient(140deg, rgba(10, 115, 104, 0.16), rgba(10, 115, 104, 0.08));
    border: 1px solid rgba(10, 115, 104, 0.22);
    color: rgba(6, 68, 62, 0.95);
    box-shadow: 0 12px 20px rgba(10, 115, 104, 0.1);
    overflow: hidden;
  }

  .transcript-body .tool-toggle {
    width: 100%;
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    text-align: left;
    cursor: pointer;
    padding: 10px 14px;
  }

  .transcript-body .tool-toggle:focus-visible {
    outline: 2px solid rgba(10, 115, 104, 0.35);
    outline-offset: -2px;
  }

  .transcript-body .tool-chevron {
    width: 14px;
    height: 14px;
    transition: transform 0.15s ease;
    flex-shrink: 0;
  }

  .transcript-body .tool-toggle[aria-expanded="true"] .tool-chevron {
    transform: rotate(90deg);
  }

  .transcript-body .tool-details {
    border-top: 1px solid rgba(10, 115, 104, 0.18);
    padding: 10px 14px 12px;
    display: grid;
    gap: 12px;
  }

  .transcript-body .tool-entry {
    display: grid;
    gap: 6px;
  }

  .transcript-body .tool-label {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(6, 68, 62, 0.7);
    margin-bottom: 8px;
  }

  .transcript-body .tool-content {
    margin: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.84rem;
    line-height: 1.45;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .assistant-text {
    font-size: 0.95rem;
    line-height: 1.6;
    white-space: pre-wrap;
    color: rgba(16, 22, 22, 0.85);
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
