import { redirect } from '@sveltejs/kit';
import {
  clearAuthSessionCookie,
  clearOAuthPendingCookie,
  clearOAuthStateCookie,
} from '$lib/server/auth/session';
import { enforceSameOrigin } from '$lib/server/auth/http';

const clearSessionCookies = (cookies: Parameters<typeof clearAuthSessionCookie>[0]) => {
  clearAuthSessionCookie(cookies);
  clearOAuthPendingCookie(cookies);
  clearOAuthStateCookie(cookies);
};

export const POST = async (event) => {
  const forbidden = enforceSameOrigin(event);
  if (forbidden) return forbidden;

  clearSessionCookies(event.cookies);
  throw redirect(303, '/');
};

export const GET = async ({ cookies }) => {
  clearSessionCookies(cookies);
  throw redirect(302, '/');
};
