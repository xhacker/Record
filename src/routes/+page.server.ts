import type { PageServerLoad } from './$types';
import {
  clearAuthSessionCookie,
  clearOAuthPendingCookie,
  clearOAuthStateCookie,
} from '$lib/server/auth/session';

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
  const session = locals.authSession;
  const authError = url.searchParams.get('auth_error');
  const hasAuthError = Boolean(authError);

  if (hasAuthError) {
    clearAuthSessionCookie(cookies);
    clearOAuthPendingCookie(cookies);
    clearOAuthStateCookie(cookies);
  }

  return {
    authenticated: hasAuthError ? false : !!session,
    authError,
    repo: hasAuthError ? null : (session?.repo ?? null),
    userLogin: hasAuthError ? null : (session?.user.login ?? null),
  };
};
