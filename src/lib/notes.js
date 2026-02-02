import { STORAGE_KEY, loadJSON, saveJSON } from './storage.js';

export const createNote = () => ({
  id: crypto?.randomUUID?.() ?? `note-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  title: '',
  content: '',
  updatedAt: Date.now(),
});

export const sortNotes = (list) =>
  [...list].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

export const loadNotes = () => {
  const parsed = loadJSON(STORAGE_KEY, []);
  if (Array.isArray(parsed) && parsed.length) {
    return sortNotes(parsed);
  }
  return [createNote()];
};

export const persistNotes = (notes) => {
  saveJSON(STORAGE_KEY, notes);
};

export const formatUpdated = (timestamp) => {
  if (!timestamp) return 'Just now';
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};
