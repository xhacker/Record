<script>
  import { onMount } from 'svelte';

  let {
    value = '',
    placeholder = 'Write your note...',
    onChange,
    onBlur,
    onKeydown,
  } = $props();

  let editorRoot = $state(null);
  let editorReady = $state(false);
  let editorFailed = $state(false);
  let focused = $state(false);
  let markdown = $state('');

  let editor = null;
  let replaceAllCommand = null;

  const handleKeydown = (event) => {
    onKeydown?.(event);
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
          { Editor, rootCtx, defaultValueCtx },
          { commonmark },
          { history },
          { listener, listenerCtx },
          { nord },
          { replaceAll },
        ] = await Promise.all([
          import('@milkdown/core'),
          import('@milkdown/preset-commonmark'),
          import('@milkdown/plugin-history'),
          import('@milkdown/plugin-listener'),
          import('@milkdown/theme-nord'),
          import('@milkdown/utils'),
        ]);

        if (cancelled || !editorRoot) return;

        replaceAllCommand = replaceAll;
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
          .use(history)
          .use(listener);

        await editor.create();

        if (cancelled) {
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
    class="editor-shell"
    data-placeholder={placeholder}
    role="textbox"
    aria-multiline="true"
    tabindex="-1"
    onkeydown={handleKeydown}
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
  }

  .editor-root :global(.milkdown) {
    height: 100%;
    background: transparent;
  }

  .editor-root :global(.milkdown .editor) {
    height: 100%;
    min-height: 100%;
    border: none;
    outline: none;
    background: transparent;
    resize: none;
    line-height: 1.6;
    color: var(--ink);
    font-size: 1rem;
    padding: clamp(20px, 4vw, 32px);
    font-family: var(--font-ui);
  }

  .editor-root :global(.milkdown .editor:focus) {
    outline: none;
  }

  .editor-root :global(.milkdown .editor > *:first-child) {
    margin-top: 0;
  }

  .editor-root :global(.milkdown .editor > *:last-child) {
    margin-bottom: 0;
  }

  .editor-root :global(.milkdown a) {
    color: var(--sea);
    text-decoration-color: rgba(10, 115, 104, 0.35);
  }

  .editor-root :global(.milkdown code) {
    font-size: 0.9em;
    padding: 0.05em 0.35em;
    border-radius: 0.35em;
    background: rgba(16, 22, 22, 0.08);
  }

  .editor-root :global(.milkdown pre code) {
    display: block;
    padding: 0.85rem;
    border-radius: 10px;
    background: rgba(16, 22, 22, 0.1);
    overflow-x: auto;
  }

  .editor-fallback {
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
    width: 100%;
    height: 100%;
    font-family: var(--font-ui);
  }

  .editor-fallback::placeholder {
    color: var(--muted);
  }
</style>
