import { json } from '@sveltejs/kit';
import { z } from 'zod';
import {
  deleteNoteFromRepo,
  readFileByPath,
  writeNoteToRepo,
} from '$lib/server/github/repo';
import {
  enforceSameOrigin,
  errorResponse,
  requireAuthSession,
} from '$lib/server/auth/http';

const putSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  sha: z.string().min(1).nullable().optional(),
  message: z.string().min(1).optional(),
});

const deleteSchema = z.object({
  path: z.string().min(1),
  sha: z.string().min(1),
  message: z.string().min(1).optional(),
});

export const GET = async (event) => {
  const session = requireAuthSession(event);
  if (session instanceof Response) return session;

  const path = event.url.searchParams.get('path')?.trim();

  if (!path) {
    return json({ error: 'Missing required parameter: path' }, { status: 400 });
  }

  try {
    const file = await readFileByPath(session.repo, path);
    return json(file);
  } catch (error) {
    return errorResponse(error, 'Failed to read file.');
  }
};

export const PUT = async (event) => {
  const session = requireAuthSession(event);
  if (session instanceof Response) return session;

  const forbidden = enforceSameOrigin(event);
  if (forbidden) return forbidden;

  const body = await event.request.json().catch(() => null);
  const parsed = putSchema.safeParse(body);

  if (!parsed.success) {
    return json(
      { error: 'Invalid request body', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await writeNoteToRepo(
      session.repo,
      {
        path: parsed.data.path,
        content: parsed.data.content,
        sha: parsed.data.sha,
      },
      {
        message: parsed.data.message,
      }
    );

    return json(result);
  } catch (error) {
    return errorResponse(error, 'Failed to write file.');
  }
};

export const DELETE = async (event) => {
  const session = requireAuthSession(event);
  if (session instanceof Response) return session;

  const forbidden = enforceSameOrigin(event);
  if (forbidden) return forbidden;

  const body = await event.request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);

  if (!parsed.success) {
    return json(
      { error: 'Invalid request body', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await deleteNoteFromRepo(
      session.repo,
      parsed.data.path,
      parsed.data.sha,
      {
        message: parsed.data.message,
      }
    );

    return json(result);
  } catch (error) {
    return errorResponse(error, 'Failed to delete file.');
  }
};
