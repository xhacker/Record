import { randomBytes } from 'node:crypto';
import { redirect, type RequestEvent } from '@sveltejs/kit';
import { setOAuthStateCookie } from '$lib/server/auth/session';
import { getOAuthRedirectUri } from '$lib/server/github/app';
import { getGitHubAppEnv, getSessionEnv } from '$lib/server/github/env';

const beginGitHubOAuth = ({ cookies, locals, url }: RequestEvent) => {
  if (locals.authSession) {
    throw redirect(302, '/');
  }

  try {
    getSessionEnv();
    getGitHubAppEnv();
  } catch {
    throw redirect(302, '/?auth_error=oauth_server_config_invalid');
  }

  const redirectUri = getOAuthRedirectUri(url.origin);
  const redirectOrigin = new URL(redirectUri).origin;

  // State cookie validation requires callback to return to the same origin.
  if (redirectOrigin !== url.origin) {
    throw redirect(302, '/?auth_error=oauth_origin_mismatch');
  }

  const state = randomBytes(24).toString('base64url');
  setOAuthStateCookie(cookies, state);

  const params = new URLSearchParams({
    client_id: getGitHubAppEnv().clientId,
    redirect_uri: redirectUri,
    state,
    scope: 'read:user',
  });

  throw redirect(302, `https://github.com/login/oauth/authorize?${params.toString()}`);
};

// GET here can be prefetched by SvelteKit and should not mint OAuth state.
export const GET = async () => {
  throw redirect(303, '/');
};

export const POST = async (event) => beginGitHubOAuth(event);
