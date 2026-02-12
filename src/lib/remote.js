import { sortNotesByPath, normalizeNote } from './notes.js';

/**
 * Wraps an async repo operation with standard saving/error handling.
 * Returns { success, error?, result? }
 */
const withSaving = async (noteId, updateNote, operation) => {
  updateNote(noteId, (n) => ({ ...n, saving: true }));
  try {
    const result = await operation();
    return { success: true, result };
  } catch (error) {
    updateNote(noteId, (n) => ({ ...n, saving: false }));
    return { success: false, error: error?.message ?? 'Operation failed.' };
  }
};

const requestJson = async (path, options = {}) => {
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload?.error ?? `${response.status} ${response.statusText}`);
    error.status = response.status;
    throw error;
  }

  return payload;
};

export const saveNote = async (note, repoMeta, updateNote) => {
  if (!note || note.saving || !note.dirty) return { success: true };

  const path = note.sha ? (note.id || note.path) : (note.path || note.id);
  if (!path) return { success: false, error: 'Missing note path.' };

  const content = note.content ?? '';

  return withSaving(note.id, updateNote, async () => {
    const payload = await requestJson('/api/repo/file', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        path,
        content,
        sha: note.sha,
        message: `Update ${path}`,
      }),
    });

    updateNote(note.id, (n) => ({
      ...n,
      saving: false,
      savedContent: content,
      dirty: n.content !== content,
      sha: payload?.sha ?? n.sha,
    }));

    return { repo: payload?.repo ?? repoMeta };
  });
};

export const createNote = async (note, repoMeta, updateNote) =>
  withSaving(note.id, updateNote, async () => {
    const content = note.content ?? '';

    const payload = await requestJson('/api/repo/file', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        path: note.path,
        content,
        message: `Create ${note.path}`,
      }),
    });

    updateNote(note.id, (n) => ({
      ...n,
      saving: false,
      savedContent: content,
      dirty: n.content !== content,
      sha: payload?.sha ?? n.sha,
    }));

    return { repo: payload?.repo ?? repoMeta };
  });

export const deleteNote = async (note, repoMeta, updateNote) => {
  const path = note.path ?? note.id;
  if (!path || !note.sha) return { success: false, error: 'Missing file info.' };

  return withSaving(note.id, updateNote, async () => {
    const payload = await requestJson('/api/repo/file', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        path,
        sha: note.sha,
        message: `Delete ${path}`,
      }),
    });

    return {
      repo: payload?.repo ?? repoMeta,
    };
  });
};

export const renameNote = async (note, nextPath, filename, repoMeta, updateNote, updateNotes) => {
  const currentPath = note.path ?? note.id;

  return withSaving(note.id, updateNote, async () => {
    const createPayload = await requestJson('/api/repo/file', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        path: nextPath,
        content: note.content ?? '',
        message: `Rename ${currentPath} to ${nextPath}`,
      }),
    });

    const previousSha = note.sha;

    updateNotes((list) =>
      sortNotesByPath(
        list.map((entry) =>
          entry.id === note.id
            ? {
                ...entry,
                id: nextPath,
                path: nextPath,
                filename,
                sha: createPayload?.sha ?? entry.sha,
                saving: false,
                savedContent: entry.content ?? '',
                dirty: false,
              }
            : entry
        )
      )
    );

    let deleteError = null;

    if (previousSha) {
      try {
        await requestJson('/api/repo/file', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            path: currentPath,
            sha: previousSha,
            message: `Rename ${currentPath} to ${nextPath}`,
          }),
        });
      } catch (error) {
        deleteError = error?.message ?? 'Renamed, but failed to remove the old file.';
      }
    } else {
      deleteError = 'Renamed, but missing the old file hash to remove it.';
    }

    return {
      repo: createPayload?.repo ?? repoMeta,
      newId: nextPath,
      deleteError,
    };
  });
};

export const loadNotes = async (callbacks) => {
  const { onStart, onSuccess, onAuthError, onError, onFinally } = callbacks;

  onStart?.();

  try {
    const payload = await requestJson('/api/repo/notes');
    const normalized = sortNotesByPath(payload.notes ?? []).map(normalizeNote);

    onSuccess?.({
      repo: payload.repo,
      notes: normalized,
      truncated: !!payload.truncated,
    });
  } catch (error) {
    if (error?.status === 401) {
      onAuthError?.();
    } else {
      onError?.(error?.message ?? 'Failed to load notes.');
    }
  } finally {
    onFinally?.();
  }
};
