export const formatDateStamp = (value = new Date()) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getNextDateFilename = (base, existingPaths) => {
  let attempt = 1;
  while (attempt < 500) {
    const suffix = attempt === 1 ? '' : ` (${attempt})`;
    const filename = `${base}${suffix}.md`;
    if (!existingPaths.has(filename)) {
      return filename;
    }
    attempt += 1;
  }
  return `${base}-${Date.now()}.md`;
};

export const normalizeNote = (note) => ({
  ...note,
  savedContent: note.content ?? '',
  dirty: false,
  saving: false,
  sha: note.sha ?? null,
});

export const createNote = (filename = '', content = '') => {
  const safeName = filename.trim() || `untitled-${Date.now()}.md`;
  return {
    id: safeName,
    path: safeName,
    filename: safeName,
    content,
  };
};

export const sortNotesByPath = (list) =>
  [...list].sort((a, b) => (a.path || '').localeCompare(b.path || ''));

export const getFilenameParts = (filename = '') => {
  const safe = filename.trim() || 'untitled.md';
  if (safe.toLowerCase().endsWith('.md')) {
    return { base: safe.slice(0, -3), ext: '.md' };
  }
  return { base: safe, ext: '' };
};

export const getDisplayName = (note) =>
  getFilenameParts(note?.filename || note?.path || '');
