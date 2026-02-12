import { json } from '@sveltejs/kit';
import { loadNotesFromRepo } from '$lib/server/github/repo';
import { errorResponse, requireAuthSession } from '$lib/server/auth/http';

export const GET = async (event) => {
  const session = requireAuthSession(event);
  if (session instanceof Response) return session;

  try {
    const payload = await loadNotesFromRepo(session.repo);
    return json(payload);
  } catch (error) {
    return errorResponse(error, 'Failed to load notes.');
  }
};
