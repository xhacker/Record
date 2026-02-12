<script lang="ts">
  let { data, form } = $props();

  const repositories = $derived(data.repositories ?? []);
  let selectedRepositoryId = $state('');

  $effect(() => {
    if (!selectedRepositoryId && repositories.length) {
      selectedRepositoryId = String(repositories[0].repositoryId);
    }
  });
</script>

<svelte:head>
  <title>Select Repository - the record</title>
</svelte:head>

<main class="selection-page">
  <section class="selection-card" aria-label="Repository selection">
    <p class="app-title">THE RECORD.</p>
    <h1>Choose your note repository</h1>
    <p class="lead">Signed in as <strong>@{data.userLogin}</strong>. Pick one repository for this session.</p>

    <form method="POST" class="selection-form">
      <div class="repo-list" role="radiogroup" aria-label="Available repositories">
        {#each repositories as repository (repository.repositoryId)}
          <label class="repo-option">
            <input
              type="radio"
              name="repository_id"
              value={repository.repositoryId}
              bind:group={selectedRepositoryId}
            />
            <span class="repo-name">{repository.fullName}</span>
            <span class="repo-meta">default branch: {repository.defaultBranch}</span>
          </label>
        {/each}
      </div>

      {#if form?.error}
        <p class="field-error" role="alert">{form.error}</p>
      {/if}

      <button class="submit" type="submit" disabled={!selectedRepositoryId}>
        Enter the record
      </button>
    </form>
  </section>
</main>

<style>
  .selection-page {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 40px 20px;
    position: relative;
  }

  .selection-card {
    width: min(760px, 94vw);
    padding: clamp(28px, 4vw, 48px);
    border-radius: 28px;
    border: 1px solid rgba(16, 22, 22, 0.12);
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.94), rgba(255, 246, 238, 0.88));
    box-shadow: 0 30px 60px rgba(210, 160, 120, 0.25), 0 8px 16px rgba(16, 22, 22, 0.08);
    backdrop-filter: blur(12px);
    display: grid;
    gap: 18px;
  }

  h1 {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: clamp(1.9rem, 3vw, 2.4rem);
    letter-spacing: -0.01em;
  }

  .lead {
    color: var(--muted);
    line-height: 1.55;
  }

  .selection-form {
    display: grid;
    gap: 16px;
  }

  .repo-list {
    display: grid;
    gap: 10px;
    max-height: min(56vh, 520px);
    overflow: auto;
    padding-right: 4px;
  }

  .repo-option {
    display: grid;
    gap: 4px;
    grid-template-columns: auto 1fr;
    align-items: center;
    column-gap: 12px;
    border-radius: 14px;
    border: 1px solid rgba(16, 22, 22, 0.12);
    background: rgba(255, 255, 255, 0.75);
    padding: 12px 14px;
  }

  .repo-option input {
    margin: 0;
  }

  .repo-name {
    font-weight: 600;
    color: var(--ink);
  }

  .repo-meta {
    grid-column: 2;
    color: var(--muted);
    font-size: 0.85rem;
  }

  .field-error {
    color: #a33c1c;
    font-size: 0.88rem;
    font-weight: 600;
  }

  .submit {
    border: none;
    border-radius: 999px;
    height: 48px;
    background: linear-gradient(135deg, #e46b2b, #c6581f);
    color: #fff7ef;
    font-weight: 600;
    font-size: 0.95rem;
    letter-spacing: 0.02em;
    cursor: pointer;
    box-shadow: 0 16px 30px rgba(222, 97, 34, 0.35);
    transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
  }

  .submit:hover {
    transform: translateY(-1px);
    box-shadow: 0 20px 36px rgba(222, 97, 34, 0.4);
  }

  .submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }
</style>
