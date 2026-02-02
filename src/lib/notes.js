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
