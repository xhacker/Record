<script>
  import { DEFAULT_WIDTH, DEFAULT_HEIGHT } from '$lib/windowManager.js';

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
    contentElRef = $bindable(),
  } = $props();

  let editingTitle = $state(false);

  function focusOnMount(node) {
    node.focus();
    node.select();
  }
</script>

<section
  class="note"
  aria-label="Note"
  style="left: {windowState.x}px; top: {windowState.y}px; width: {windowState.width ?? DEFAULT_WIDTH}px; height: {windowState.height ?? DEFAULT_HEIGHT}px; z-index: {windowState.zIndex};"
  onpointerdown={onFocus}
>
  <div
    class="note-titlebar"
    role="toolbar"
    onpointerdown={onDragStart}
    ondblclick={() => { editingTitle = true; }}
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
        value={note.title}
        oninput={(e) => onTitleChange(e.target.value)}
        onblur={() => { editingTitle = false; }}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { editingTitle = false; e.target.blur(); } }}
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
    bind:this={contentElRef}
    oninput={(e) => onContentChange(e.target.value)}
    onkeydown={onContentKeydown}
    aria-busy={commandPending}
  ></textarea>
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
    font-family: "Space Grotesk", "Helvetica Neue", sans-serif;
    font-size: 0.85rem;
    font-weight: 500;
    color: rgba(16, 22, 22, 0.85);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 60%;
    pointer-events: none;
  }

  .note-title {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: 60%;
    font-family: "Space Grotesk", "Helvetica Neue", sans-serif;
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
