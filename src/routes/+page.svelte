<script>
  import { onMount, tick } from 'svelte';

  const STORAGE_KEY = 'the-record-note';
  const COMMAND_MODEL = 'kimi';

  let title = '';
  let content = '';
  let autosaveTimer = null;
  let mounted = false;
  let commandPending = false;
  let contentEl;

  const loadNote = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      title = parsed.title ?? '';
      content = parsed.content ?? '';
    } catch (error) {
      console.warn('Failed to parse saved note', error);
    }
  };

  const saveNote = () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        title,
        content,
        updatedAt: Date.now()
      })
    );
  };

  const scheduleSave = () => {
    if (!mounted) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(saveNote, 400);
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

  onMount(() => {
    mounted = true;
    loadNote();
    return () => {
      if (autosaveTimer) clearTimeout(autosaveTimer);
    };
  });
</script>

<svelte:head>
  <title>the record</title>
</svelte:head>

<main class="page">
  <div class="glow"></div>
  <div class="note-shell">
    <header class="note-header">
      <p class="app-title">THE RECORD.</p>
    </header>
    <section class="note" aria-label="Note">
      <input
        class="note-title"
        type="text"
        placeholder="Title"
        bind:value={title}
        on:input={scheduleSave}
      />
      <textarea
        class="note-content"
        placeholder="Write your note..."
        bind:value={content}
        bind:this={contentEl}
        on:input={scheduleSave}
        on:keydown={handleContentKeydown}
        aria-busy={commandPending}
      ></textarea>
    </section>
    <aside class="note-instructions" aria-label="Slash command instructions">
      <p class="note-instructions-title">Slash commands</p>
      <p class="note-instructions-body">
        Type <span class="inline-chip">/</span> with a prompt and press
        <span class="inline-chip">⌘</span> + <span class="inline-chip">↵</span> (or
        <span class="inline-chip">Ctrl</span> + <span class="inline-chip">↵</span>) to
        replace it inline.
      </p>
    </aside>
  </div>
</main>
