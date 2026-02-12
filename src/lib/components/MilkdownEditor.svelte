<script>
  import { onMount, tick } from 'svelte';
  import { getSlashContextFromDocument, getSlashContextFromParagraph } from '$lib/slashCommand.js';
  import { createTranscriptHtmlView } from '$lib/milkdown/transcriptHtmlView.js';

  let {
    value = '',
    placeholder = 'Write your note...',
    onChange,
    onBlur,
    onKeydown,
    onSlashCommand,
    onSlashCommandError,
  } = $props();

  let editorRoot = $state(null);
  let fallbackEl = $state(null);
  let editorReady = $state(false);
  let editorFailed = $state(false);
  let focused = $state(false);
  let markdown = $state('');
  let slashPending = $state(false);

  let editor = null;
  let replaceAllCommand = null;
  let editorViewCtxKey = null;
  let removeEditorKeyListener = null;

  const isModEnter = (event) => {
    if (!(event.metaKey || event.ctrlKey)) return false;
    return event.key === 'Enter' || event.key === 'NumpadEnter';
  };

  const reportSlashCommandError = (error) => {
    const message = error?.message ?? 'Failed to run slash command.';
    onSlashCommandError?.(message);
  };

  const requestSlashReplacement = async (context) => {
    if (!onSlashCommand) return '';
    const replacement = await onSlashCommand({
      paragraphWithoutCommand: context.paragraphWithoutCommand,
      commandText: context.commandText,
    });
    const normalized = (replacement ?? '').trim();
    if (!normalized) {
      throw new Error('Slash command returned no content.');
    }
    return normalized;
  };

  const runSlashCommandInEditor = async () => {
    if (!editorReady || !editor || !editorViewCtxKey || !onSlashCommand || slashPending) return;

    slashPending = true;
    try {
      let snapshot = null;
      await editor.action((ctx) => {
        const view = ctx.get(editorViewCtxKey);
        const { state } = view;
        if (!state.selection.empty) return;

        const selectionAnchor = state.selection.$from;
        if (!selectionAnchor.parent?.isTextblock) return;

        const paragraphText = selectionAnchor.parent.textContent ?? '';
        const paragraphStart = selectionAnchor.start();
        const cursorInParagraph = state.selection.from - paragraphStart;
        const context = getSlashContextFromParagraph(paragraphText, cursorInParagraph);
        if (!context) return;

        snapshot = {
          paragraphStart,
          command: context.command,
          commandText: context.commandText,
          paragraphWithoutCommand: context.paragraphWithoutCommand,
        };
      });

      if (!snapshot) {
        throw new Error('No slash command found before the cursor in this paragraph.');
      }
      const replacement = await requestSlashReplacement(snapshot);

      await editor.action((ctx) => {
        const view = ctx.get(editorViewCtxKey);
        const from = snapshot.paragraphStart + snapshot.command.start;
        const to = snapshot.paragraphStart + snapshot.command.end;
        const currentCommand = view.state.doc.textBetween(from, to, '\n', '\n').trim();
        if (currentCommand !== snapshot.commandText.trim()) {
          throw new Error('Slash command context changed. Try again.');
        }
        const tr = view.state.tr.insertText(replacement, from, to);
        view.dispatch(tr.scrollIntoView());
      });
    } catch (error) {
      reportSlashCommandError(error);
    } finally {
      slashPending = false;
    }
  };

  const runSlashCommandInFallback = async () => {
    if (!fallbackEl || !onSlashCommand || slashPending) return;

    const cursor = fallbackEl.selectionEnd ?? 0;
    const context = getSlashContextFromDocument(markdown, cursor);
    if (!context) {
      reportSlashCommandError(new Error('No slash command found before the cursor in this paragraph.'));
      return;
    }

    slashPending = true;
    try {
      const replacement = await requestSlashReplacement(context);
      const from = context.paragraphStart + context.command.start;
      const to = context.paragraphStart + context.command.end;
      const nextContent = markdown.slice(0, from) + replacement + markdown.slice(to);
      const nextCaret = from + replacement.length;

      markdown = nextContent;
      onChange?.(nextContent);
      await tick();
      fallbackEl.setSelectionRange(nextCaret, nextCaret);
      fallbackEl.focus();
    } catch (error) {
      reportSlashCommandError(error);
    } finally {
      slashPending = false;
    }
  };

  const handleKeydown = (event) => {
    onKeydown?.(event);
    if (!isModEnter(event)) return;

    event.preventDefault();
    if (editorFailed) {
      void runSlashCommandInFallback();
    } else {
      void runSlashCommandInEditor();
    }
  };

  const syncEditorFromValue = async (nextValue) => {
    if (!editorReady || !editor || !replaceAllCommand) return;
    if (nextValue === markdown) return;
    markdown = nextValue;
    await editor.action(replaceAllCommand(nextValue));
  };

  $effect(() => {
    const nextValue = (value ?? '').toString();
    if (!editorReady) {
      markdown = nextValue;
      return;
    }
    void syncEditorFromValue(nextValue);
  });

  onMount(() => {
    let cancelled = false;

    const initEditor = async () => {
      try {
        const [
          { Editor, rootCtx, defaultValueCtx, editorViewCtx },
          { commonmark, htmlSchema },
          { history },
          { listener, listenerCtx },
          { nord },
          milkdownUtils,
        ] = await Promise.all([
          import('@milkdown/core'),
          import('@milkdown/preset-commonmark'),
          import('@milkdown/plugin-history'),
          import('@milkdown/plugin-listener'),
          import('@milkdown/theme-nord'),
          import('@milkdown/utils'),
        ]);

        if (cancelled || !editorRoot) return;

        replaceAllCommand = milkdownUtils.replaceAll;
        editorViewCtxKey = editorViewCtx;
        editor = Editor.make()
          .config(nord)
          .config((ctx) => {
            ctx.set(rootCtx, editorRoot);
            ctx.set(defaultValueCtx, markdown);

            const listeners = ctx.get(listenerCtx);
            listeners.markdownUpdated((_, nextMarkdown) => {
              markdown = nextMarkdown;
              onChange?.(nextMarkdown);
            });
            listeners.focus(() => {
              focused = true;
            });
            listeners.blur(() => {
              focused = false;
              onBlur?.();
            });
          })
          .use(commonmark)
          .use(
            createTranscriptHtmlView({
              htmlSchema,
              viewFactory: milkdownUtils.$view,
            })
          )
          .use(history)
          .use(listener);

        await editor.create();

        await editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const keyCaptureHandler = (event) => {
            onKeydown?.(event);
            if (!isModEnter(event)) return;
            event.preventDefault();
            event.stopPropagation();
            void runSlashCommandInEditor();
          };
          view.dom.addEventListener('keydown', keyCaptureHandler, true);
          removeEditorKeyListener = () => {
            view.dom.removeEventListener('keydown', keyCaptureHandler, true);
          };
        });

        if (cancelled) {
          if (removeEditorKeyListener) {
            removeEditorKeyListener();
            removeEditorKeyListener = null;
          }
          await editor.destroy();
          editor = null;
          return;
        }

        editorReady = true;
      } catch (error) {
        console.error('Failed to initialize Milkdown editor.', error);
        editorFailed = true;
      }
    };

    void initEditor();

    return () => {
      cancelled = true;
      editorReady = false;
      editorViewCtxKey = null;
      if (removeEditorKeyListener) {
        removeEditorKeyListener();
        removeEditorKeyListener = null;
      }
      if (editor) {
        void editor.destroy();
        editor = null;
      }
    };
  });
</script>

{#if editorFailed}
  <textarea
    class="editor-fallback"
    placeholder={placeholder}
    value={markdown}
    bind:this={fallbackEl}
    oninput={(event) => {
      const nextValue = event.target.value;
      markdown = nextValue;
      onChange?.(nextValue);
    }}
    onkeydown={handleKeydown}
    onblur={() => onBlur?.()}
  ></textarea>
{:else}
  <div
    class:show-placeholder={!markdown.trim() && !focused}
    class:pending={slashPending}
    class="editor-shell"
    data-placeholder={placeholder}
    role="textbox"
    aria-multiline="true"
    aria-busy={slashPending}
    tabindex="-1"
  >
    <div class="editor-root" bind:this={editorRoot}></div>
  </div>
{/if}

<style>
  .editor-shell {
    position: relative;
    min-height: 0;
    height: 100%;
    user-select: text;
    cursor: text;
  }

  .editor-shell.pending {
    cursor: progress;
  }

  .editor-shell.show-placeholder::before {
    content: attr(data-placeholder);
    position: absolute;
    top: clamp(20px, 4vw, 32px);
    left: clamp(20px, 4vw, 32px);
    color: var(--muted);
    pointer-events: none;
    z-index: 2;
  }

  .editor-root {
    height: 100%;
    min-height: 0;
  }

  .editor-root :global(.milkdown) {
    height: 100%;
    min-height: 0;
    background: transparent;
  }

  .editor-root :global(.milkdown .editor) {
    --prose-font-size: clamp(1.02rem, 0.16vw + 0.98rem, 1.1rem);
    --prose-line-height: 1.74;
    --prose-measure: 74ch;
    height: 100%;
    min-height: 100%;
    border: none;
    outline: none;
    background: transparent;
    resize: none;
    line-height: var(--prose-line-height);
    color: var(--ink);
    font-size: var(--prose-font-size);
    padding: clamp(20px, 4vw, 32px);
    font-family: var(--font-ui);
    overflow-y: auto;
    overscroll-behavior: contain;
    text-wrap: pretty;
    text-rendering: optimizeLegibility;
  }

  .editor-root :global(.milkdown .editor:focus) {
    outline: none;
  }

  .editor-root :global(.milkdown .editor > *) {
    max-width: var(--prose-measure);
  }

  .editor-root :global(.milkdown .editor > *:first-child) {
    margin-top: 0;
  }

  .editor-root :global(.milkdown .editor > *:last-child) {
    margin-bottom: 0;
  }

  .editor-root :global(.milkdown .editor p) {
    margin: 0.3em 0 0.95em;
    line-height: 1.78;
  }

  .editor-root :global(.milkdown .editor h1),
  .editor-root :global(.milkdown .editor h2),
  .editor-root :global(.milkdown .editor h3),
  .editor-root :global(.milkdown .editor h4) {
    line-height: 1.2;
    text-wrap: balance;
    letter-spacing: -0.01em;
    font-family: var(--font-ui);
    margin: 1.1em 0 0.45em;
  }

  .editor-root :global(.milkdown .editor h1) {
    margin-top: 0.12em;
    font-size: clamp(2rem, 1.28rem + 1.82vw, 2.9rem);
    font-weight: 700;
  }

  .editor-root :global(.milkdown .editor h2) {
    font-size: clamp(1.62rem, 1.16rem + 1.05vw, 2.15rem);
    font-weight: 680;
  }

  .editor-root :global(.milkdown .editor h3) {
    font-size: clamp(1.34rem, 1.06rem + 0.62vw, 1.68rem);
    font-weight: 650;
  }

  .editor-root :global(.milkdown .editor h4) {
    font-size: clamp(1.16rem, 1.03rem + 0.35vw, 1.32rem);
    font-weight: 620;
  }

  .editor-root :global(.milkdown .editor h1 + p),
  .editor-root :global(.milkdown .editor h2 + p),
  .editor-root :global(.milkdown .editor h3 + p),
  .editor-root :global(.milkdown .editor h4 + p) {
    margin-top: 0.26em;
  }

  .editor-root :global(.milkdown .editor ul),
  .editor-root :global(.milkdown .editor ol) {
    margin: 0.4em 0 1.04em;
    padding-left: 1.38em;
  }

  .editor-root :global(.milkdown .editor li) {
    margin: 0.32em 0;
    line-height: 1.72;
    padding-left: 0.08em;
  }

  .editor-root :global(.milkdown .editor li > p) {
    margin: 0.2em 0;
  }

  .editor-root :global(.milkdown .editor blockquote) {
    margin: 1em 0 1.18em;
    padding: 0.14em 0 0.14em 1em;
    border-left: 3px solid rgba(16, 22, 22, 0.16);
    color: rgba(16, 22, 22, 0.78);
  }

  .editor-root :global(.milkdown .editor hr) {
    margin: 1.45em 0 1.25em;
    border: none;
    border-top: 1px solid rgba(16, 22, 22, 0.16);
  }

  .editor-root :global(.milkdown a) {
    color: var(--sea);
    text-decoration-color: rgba(10, 115, 104, 0.35);
    text-underline-offset: 0.14em;
  }

  .editor-root :global(.milkdown code) {
    font-size: 0.86em;
    padding: 0.05em 0.35em;
    border-radius: 0.35em;
    background: rgba(16, 22, 22, 0.08);
  }

  .editor-root :global(.milkdown pre code) {
    display: block;
    padding: 0.95rem 1rem;
    border-radius: 10px;
    background: rgba(16, 22, 22, 0.1);
    overflow-x: auto;
    line-height: 1.55;
  }

  .editor-fallback {
    border: none;
    outline: none;
    background: transparent;
    resize: none;
    min-height: 0;
    line-height: 1.74;
    color: var(--ink);
    font-size: clamp(1.02rem, 0.16vw + 0.98rem, 1.1rem);
    padding: clamp(20px, 4vw, 32px);
    user-select: text;
    cursor: text;
    width: 100%;
    height: 100%;
    font-family: var(--font-ui);
  }

  .editor-fallback::placeholder {
    color: var(--muted);
  }
</style>
