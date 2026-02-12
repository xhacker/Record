import { randomBytes } from 'node:crypto';
import { redirect } from '@sveltejs/kit';
import { setOAuthStateCookie } from '$lib/server/auth/session';
import { getOAuthRedirectUri } from '$lib/server/github/app';
import { getGitHubAppEnv } from '$lib/server/github/env';

export const GET = async ({ cookies, locals, url }) => {
  if (locals.authSession) {
    throw redirect(302, '/');
  }

  const state = randomBytes(24).toString('base64url');
  setOAuthStateCookie(cookies, state);

  const redirectUri = getOAuthRedirectUri(url.origin);

  const params = new URLSearchParams({
    client_id: getGitHubAppEnv().clientId,
    redirect_uri: redirectUri,
    state,
    scope: 'read:user',
  });

  throw redirect(302, `https://github.com/login/oauth/authorize?${params.toString()}`);
};
