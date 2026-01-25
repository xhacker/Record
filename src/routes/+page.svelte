<script>
  import { onMount } from 'svelte';

  const STORAGE_KEY = 'the-record-note';

  let title = '';
  let content = '';
  let autosaveTimer = null;
  let mounted = false;

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
      on:input={scheduleSave}
    ></textarea>
  </section>
</main>
