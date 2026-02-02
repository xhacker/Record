<script>
  let { onSubmit, onSkip } = $props();

  let tokenInput = $state('');
  let tokenVisible = $state(false);
  let authError = $state('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const token = tokenInput.trim();
    if (!token) {
      authError = 'Enter a personal access token to continue.';
      return;
    }
    onSubmit(token);
  };
</script>

<section class="onboarding" aria-label="GitHub onboarding">
  <div class="onboarding-card">
    <p class="app-title">THE RECORD.</p>
    <h1 class="onboarding-title">Connect your GitHub</h1>
    <p class="onboarding-lead">
      OAuth is coming next. For the MVP, paste a Personal Access Token so the record can read your notes.
    </p>
    <form class="onboarding-form" onsubmit={handleSubmit}>
      <label class="field">
        <span class="field-label">Personal Access Token</span>
        <div class="field-control">
          <input
            class="field-input"
            type={tokenVisible ? 'text' : 'password'}
            placeholder="ghp_********"
            value={tokenInput}
            oninput={(e) => { tokenInput = e.target.value; authError = ''; }}
            autocomplete="off"
            spellcheck="false"
          />
          <button
            class="field-action"
            type="button"
            onclick={() => (tokenVisible = !tokenVisible)}
          >
            {tokenVisible ? 'Hide' : 'Show'}
          </button>
        </div>
        <span class="field-help">
          Stored locally in your browser. Use a token with repo access (classic) or Contents read (fine-grained).
        </span>
        {#if authError}
          <span class="field-error">{authError}</span>
        {/if}
      </label>
      <button class="onboarding-submit" type="submit" disabled={!tokenInput.trim()}>
        Enter the record
      </button>
    </form>
    <div class="onboarding-foot">
      <span class="onboarding-badge">MVP sign-in</span>
      <span class="onboarding-note">You can revoke the token anytime in GitHub settings.</span>
      <!-- TODO: Remove skip button before release -->
      <button class="skip-button" type="button" onclick={onSkip}>Skip for now</button>
    </div>
  </div>
</section>

<style>
  .onboarding {
    width: min(720px, 92vw);
    position: relative;
    z-index: var(--layer-canvas);
    display: grid;
    gap: 24px;
    animation: riseIn 0.35s ease both;
  }

  .onboarding-card {
    padding: clamp(28px, 4vw, 48px);
    border-radius: 28px;
    border: 1px solid rgba(16, 22, 22, 0.12);
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.92), rgba(255, 246, 238, 0.86));
    box-shadow: 0 30px 60px rgba(210, 160, 120, 0.25), 0 8px 16px rgba(16, 22, 22, 0.08);
    backdrop-filter: blur(12px);
    display: grid;
    gap: 18px;
  }

  .onboarding-title {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: clamp(2rem, 3vw, 2.6rem);
    letter-spacing: -0.01em;
  }

  .onboarding-lead {
    color: var(--muted);
    font-size: 1rem;
    line-height: 1.6;
  }

  .onboarding-form {
    display: grid;
    gap: 18px;
  }

  .field {
    display: grid;
    gap: 10px;
  }

  .field-label {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(16, 22, 22, 0.7);
    font-weight: 600;
  }

  .field-control {
    display: flex;
    align-items: center;
    gap: 12px;
    border-radius: 16px;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(16, 22, 22, 0.12);
    box-shadow: inset 0 1px 2px rgba(16, 22, 22, 0.06);
  }

  .field-input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 0.95rem;
    background: transparent;
    color: var(--ink);
  }

  .field-action {
    border: none;
    background: rgba(16, 22, 22, 0.08);
    color: var(--muted);
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
  }

  .field-help {
    color: var(--muted);
    font-size: 0.82rem;
    line-height: 1.5;
  }

  .field-error {
    color: #a33c1c;
    font-size: 0.82rem;
    font-weight: 600;
  }

  .onboarding-submit {
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

  .onboarding-submit:hover {
    transform: translateY(-1px);
    box-shadow: 0 20px 36px rgba(222, 97, 34, 0.4);
  }

  .onboarding-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }

  .onboarding-foot {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 16px;
    align-items: center;
    color: var(--muted);
    font-size: 0.82rem;
  }

  .onboarding-badge {
    border-radius: 999px;
    padding: 4px 10px;
    border: 1px solid rgba(222, 97, 34, 0.2);
    background: rgba(222, 97, 34, 0.08);
    color: var(--accent-ink);
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .skip-button {
    border: none;
    background: transparent;
    color: var(--muted);
    font-size: 0.82rem;
    cursor: pointer;
    text-decoration: underline;
    margin-left: auto;
  }
</style>
