import { loadNotesFromGitHub, writeNoteToGitHub, deleteNoteFromGitHub } from './github.js';
import { sortNotesByPath, normalizeNote } from './notes.js';
import { clearAuth } from './auth.js';

/**
 * Wraps an async GitHub operation with standard saving/error handling.
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

export const saveNote = async (note, authToken, repoMeta, updateNote) => {
  if (!note || note.saving || !note.dirty || !authToken) return { success: true };

  const path = note.sha ? (note.id || note.path) : (note.path || note.id);
  if (!path) return { success: false, error: 'Missing note path.' };

  const content = note.content ?? '';
  return withSaving(note.id, updateNote, async () => {
    const { repo, sha } = await writeNoteToGitHub(authToken, { path, content, sha: note.sha }, repoMeta);
    updateNote(note.id, (n) => ({
      ...n,
      saving: false,
      savedContent: content,
      dirty: n.content !== content,
      sha: sha ?? n.sha,
    }));
    return { repo };
  });
};

export const createNote = async (note, authToken, repoMeta, updateNote) => {
  if (!authToken) return { success: true };

  return withSaving(note.id, updateNote, async () => {
    const { repo, sha } = await writeNoteToGitHub(authToken, { path: note.path, content: '' }, repoMeta);
    updateNote(note.id, (n) => ({
      ...n,
      saving: false,
      savedContent: '',
      dirty: n.content !== '',
      sha: sha ?? n.sha,
    }));
    return { repo };
  });
};

export const deleteNote = async (note, authToken, repoMeta, updateNote) => {
  const path = note.path ?? note.id;
  if (!path || !note.sha) return { success: false, error: 'Missing file info.' };

  return withSaving(note.id, updateNote, async () => {
    const { repo } = await deleteNoteFromGitHub(authToken, path, note.sha, repoMeta, { message: `Delete ${path}` });
    return { repo };
  });
};

export const renameNote = async (note, nextPath, filename, authToken, repoMeta, updateNote, updateNotes) => {
  const currentPath = note.path ?? note.id;

  return withSaving(note.id, updateNote, async () => {
    const { repo, sha: nextSha } = await writeNoteToGitHub(
      authToken,
      { path: nextPath, content: note.content ?? '' },
      repoMeta,
      { message: `Rename ${currentPath} to ${nextPath}` }
    );

    const previousSha = note.sha;
    updateNotes((list) => sortNotesByPath(list.map((entry) =>
      entry.id === note.id
        ? {
            ...entry,
            id: nextPath,
            path: nextPath,
            filename,
            sha: nextSha ?? entry.sha,
            saving: false,
            savedContent: entry.content ?? '',
            dirty: false,
          }
        : entry
    )));

    let deleteError = null;
    if (previousSha) {
      try {
        await deleteNoteFromGitHub(authToken, currentPath, previousSha, repo, { message: `Rename ${currentPath} to ${nextPath}` });
      } catch (err) {
        deleteError = err?.message ?? 'Renamed, but failed to remove the old file.';
      }
    } else {
      deleteError = 'Renamed, but missing the old file hash to remove it.';
    }

    return { repo, newId: nextPath, deleteError };
  });
};

export const loadNotes = async (authToken, callbacks) => {
  const { onStart, onSuccess, onAuthError, onError, onFinally } = callbacks;

  onStart?.();
  try {
    const { repo, notes: loadedNotes, truncated } = await loadNotesFromGitHub(authToken);
    const normalized = sortNotesByPath(loadedNotes).map(normalizeNote);
    onSuccess?.({ repo, notes: normalized, truncated });
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) {
      clearAuth();
      onAuthError?.();
    } else {
      onError?.(error?.message ?? 'Failed to load notes.');
    }
  } finally {
    onFinally?.();
  }
};
