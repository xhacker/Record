<script>
  let { authError = '' } = $props();

  const ERROR_COPY = {
    oauth_state_invalid: 'Sign-in expired. Please try connecting GitHub again.',
    oauth_code_missing: 'GitHub did not return an authorization code.',
    oauth_no_repositories: 'No accessible repositories were found for this GitHub account.',
    oauth_session_missing: 'Sign-in session expired. Start the GitHub login flow again.',
    oauth_callback_failed: 'GitHub sign-in failed. Please try again.',
    oauth_origin_mismatch: 'OAuth callback origin mismatch. Use the same app URL as your configured callback host.',
    oauth_server_config_invalid: 'Server OAuth/session configuration is missing or invalid.',
  };

  const authErrorMessage = $derived(ERROR_COPY[authError] ?? '');
</script>

<section class="onboarding" aria-label="GitHub onboarding">
  <div class="onboarding-card">
    <p class="app-title">THE RECORD.</p>
    <h1 class="onboarding-title">Connect your GitHub</h1>
    <p class="onboarding-lead">
      Sign in with GitHub, then choose one installed repository to use for this session.
    </p>

    <form method="POST" action="/auth/github/start" class="oauth-form">
      <button class="onboarding-submit" type="submit">
        Continue with GitHub
      </button>
    </form>

    {#if authErrorMessage}
      <p class="field-error" role="alert">{authErrorMessage}</p>
    {/if}

    <div class="onboarding-foot">
      <span class="onboarding-badge">OAuth sign-in</span>
      <span class="onboarding-note">No personal access token needed.</span>
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

  .onboarding-submit {
    border: none;
    border-radius: 999px;
    height: 48px;
    padding: 0 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    justify-self: start;
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

  .oauth-form {
    margin: 0;
  }

  .field-error {
    color: #a33c1c;
    font-size: 0.88rem;
    font-weight: 600;
    margin: 0;
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
</style>
