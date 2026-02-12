import { json } from '@sveltejs/kit';
import { searchNotes } from '$lib/server/github/repo';
import { errorResponse, requireAuthSession } from '$lib/server/auth/http';

export const GET = async (event) => {
  const session = requireAuthSession(event);
  if (session instanceof Response) return session;

  const query = event.url.searchParams.get('query')?.trim();

  if (!query) {
    return json({ error: 'Missing required parameter: query' }, { status: 400 });
  }

  try {
    const results = await searchNotes(session.repo, query);
    return json({
      query,
      results,
      count: results.length,
    });
  } catch (error) {
    return errorResponse(error, 'Failed to search notes.');
  }
};
