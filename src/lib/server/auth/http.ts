import { json, type RequestEvent } from '@sveltejs/kit';
import type { AuthSessionPayload } from './session';

export const requireAuthSession = (
  event: RequestEvent
): AuthSessionPayload | Response => {
  const session = event.locals.authSession;
  if (!session) {
    return json({ error: 'Unauthorized.' }, { status: 401 });
  }
  return session;
};

export const enforceSameOrigin = (event: RequestEvent): Response | null => {
  const origin = event.request.headers.get('origin');
  if (!origin) {
    return json({ error: 'Forbidden origin.' }, { status: 403 });
  }

  try {
    const requestOrigin = new URL(origin).origin;
    if (requestOrigin !== event.url.origin) {
      return json({ error: 'Forbidden origin.' }, { status: 403 });
    }
  } catch {
    return json({ error: 'Forbidden origin.' }, { status: 403 });
  }

  return null;
};

export const errorResponse = (
  error: unknown,
  fallback = 'Request failed.'
) => {
  const status =
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
      ? ((error as { status: number }).status)
      : 500;

  const message =
    error instanceof Error && error.message
      ? error.message
      : fallback;

  return json({ error: message }, { status });
};
