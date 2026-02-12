import { json } from '@sveltejs/kit';
import { listFilePaths } from '$lib/server/github/repo';
import { errorResponse, requireAuthSession } from '$lib/server/auth/http';

export const GET = async (event) => {
  const session = requireAuthSession(event);
  if (session instanceof Response) return session;

  try {
    const files = await listFilePaths(session.repo);
    return json({ files, count: files.length });
  } catch (error) {
    return errorResponse(error, 'Failed to list files.');
  }
};
