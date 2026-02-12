import { redirect } from '@sveltejs/kit';
import {
  buildOAuthPending,
  clearAuthSessionCookie,
  clearOAuthPendingCookie,
  clearOAuthStateCookie,
  consumeOAuthStateCookie,
  setOAuthPendingCookie,
} from '$lib/server/auth/session';
import {
  exchangeOAuthCodeForUserToken,
  getOAuthRedirectUri,
  getViewer,
  listAccessibleRepositories,
} from '$lib/server/github/app';
import { getSessionEnv } from '$lib/server/github/env';

const clearSessionCookies = (cookies: Parameters<typeof clearAuthSessionCookie>[0]) => {
  clearAuthSessionCookie(cookies);
  clearOAuthPendingCookie(cookies);
  clearOAuthStateCookie(cookies);
};

const redirectWithError = (
  cookies: Parameters<typeof clearAuthSessionCookie>[0],
  code: string
) => {
  clearSessionCookies(cookies);
  throw redirect(302, `/?auth_error=${encodeURIComponent(code)}`);
};

export const GET = async ({ cookies, url }) => {
  try {
    getSessionEnv();
  } catch {
    redirectWithError(cookies, 'oauth_server_config_invalid');
  }

  const state = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code') ?? '';

  const validState = consumeOAuthStateCookie(cookies, state);
  if (!validState) {
    redirectWithError(cookies, 'oauth_state_invalid');
  }

  if (!code) {
    redirectWithError(cookies, 'oauth_code_missing');
  }

  const redirectUri = getOAuthRedirectUri(url.origin);
  let userToken = '';
  let viewer: { id: number; login: string } | null = null;
  let repositories: Array<unknown> = [];

  try {
    userToken = await exchangeOAuthCodeForUserToken({ code, redirectUri });
    viewer = await getViewer(userToken);
    repositories = await listAccessibleRepositories(userToken);
  } catch {
    redirectWithError(cookies, 'oauth_callback_failed');
  }

  if (!repositories.length || !viewer) {
    redirectWithError(cookies, 'oauth_no_repositories');
  }

  try {
    clearSessionCookies(cookies);
    setOAuthPendingCookie(
      cookies,
      buildOAuthPending({
        userToken,
        user: {
          id: viewer.id,
          login: viewer.login,
        },
      })
    );
  } catch {
    redirectWithError(cookies, 'oauth_server_config_invalid');
  }

  throw redirect(302, '/auth/select-repo');
};
