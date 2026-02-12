import type { Handle } from '@sveltejs/kit';
import {
  AUTH_SESSION_COOKIE,
  clearAuthSessionCookie,
  readAuthSessionCookie,
} from '$lib/server/auth/session';

export const handle: Handle = async ({ event, resolve }) => {
  const session = readAuthSessionCookie(event.cookies);
  event.locals.authSession = session;

  if (!session && event.cookies.get(AUTH_SESSION_COOKIE)) {
    clearAuthSessionCookie(event.cookies);
  }

  return resolve(event);
};
