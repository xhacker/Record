import { redirect } from '@sveltejs/kit';
import {
  buildOAuthPending,
  clearAuthSessionCookie,
  clearOAuthPendingCookie,
  consumeOAuthStateCookie,
  setOAuthPendingCookie,
} from '$lib/server/auth/session';
import {
  exchangeOAuthCodeForUserToken,
  getOAuthRedirectUri,
  getViewer,
  listAccessibleRepositories,
} from '$lib/server/github/app';

const redirectWithError = (code: string) => {
  throw redirect(302, `/?auth_error=${encodeURIComponent(code)}`);
};

export const GET = async ({ cookies, url }) => {
  const state = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code') ?? '';

  const validState = consumeOAuthStateCookie(cookies, state);
  if (!validState) {
    redirectWithError('oauth_state_invalid');
  }

  if (!code) {
    redirectWithError('oauth_code_missing');
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
    clearOAuthPendingCookie(cookies);
    redirectWithError('oauth_callback_failed');
  }

  if (!repositories.length || !viewer) {
    clearOAuthPendingCookie(cookies);
    redirectWithError('oauth_no_repositories');
  }

  clearAuthSessionCookie(cookies);
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

  throw redirect(302, '/auth/select-repo');
};
