/** @typedef {import('./types').Note} Note */
/** @typedef {import('./types').NoteType} NoteType */
/** @typedef {import('./types').TranscriptContent} TranscriptContent */
/** @typedef {import('./types').FrontmatterResult} FrontmatterResult */

/**
 * Format a date as YYYY-MM-DD
 * @param {Date} [value]
 * @returns {string}
 */
export const formatDateStamp = (value = new Date()) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
const USER_BUBBLE_REGEX = /<div\s+class=["']bubble user["']\s*>([\s\S]*?)<\/div>/i;

const escapeHtml = (value = '') =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const unescapeHtml = (value = '') =>
  value
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');

const stripHtmlTags = (value = '') =>
  value.replace(/<[^>]*>/g, '');

/**
 * Parse YAML-like frontmatter from content
 * @param {string} [content]
 * @returns {FrontmatterResult}
 */
export const parseFrontmatter = (content = '') => {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) {
    return { data: {}, body: content };
  }
  const data = {};
  match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const idx = line.indexOf(':');
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key) data[key] = value;
    });
  return {
    data,
    body: content.slice(match[0].length),
  };
};

/**
 * Get note type from content frontmatter
 * @param {string} [content]
 * @returns {NoteType}
 */
export const getNoteTypeFromContent = (content = '') => {
  const { data } = parseFrontmatter(content);
  return data.type || 'note';
};

export const stripFrontmatter = (content = '') => parseFrontmatter(content).body;

/**
 * Parse transcript content, extracting user and assistant messages
 * @param {string} [content]
 * @returns {TranscriptContent}
 */
export const parseTranscriptContent = (content = '') => {
  const { data, body } = parseFrontmatter(content);
  const match = body.match(USER_BUBBLE_REGEX);
  if (!match) {
    return {
      threadId: data.thread_id || '',
      userText: '',
      assistantText: body.trim(),
    };
  }
  const assistantStart = (match.index ?? 0) + match[0].length;
  // Sanitize: strip any injected HTML tags, then unescape legitimate entities
  const rawContent = match[1] ?? '';
  const sanitized = unescapeHtml(stripHtmlTags(rawContent));
  return {
    threadId: data.thread_id || '',
    userText: sanitized,
    assistantText: body.slice(assistantStart).trimStart(),
  };
};

export const formatTranscriptTimestamp = (value = new Date()) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  const seconds = String(value.getSeconds()).padStart(2, '0');
  const offsetMinutes = -value.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const offsetMins = String(absOffset % 60).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}${offsetMins}`;
};

export const getUniquePath = (path, existingPaths) => {
  if (!existingPaths?.has?.(path)) return path;
  const slashIndex = path.lastIndexOf('/');
  const dotIndex = path.lastIndexOf('.');
  const hasExt = dotIndex > slashIndex;
  const base = hasExt ? path.slice(0, dotIndex) : path;
  const ext = hasExt ? path.slice(dotIndex) : '';
  let attempt = 2;
  while (attempt < 500) {
    const candidate = `${base}-${attempt}${ext}`;
    if (!existingPaths.has(candidate)) return candidate;
    attempt += 1;
  }
  return `${base}-${Date.now()}${ext}`;
};

export const buildTranscriptContent = ({ threadId, userPrompt, assistantContent }) => {
  const safePrompt = escapeHtml((userPrompt ?? '').trim());
  const assistant = (assistantContent ?? '').trim();
  return [
    '---',
    'type: transcript',
    `thread_id: ${threadId}`,
    '---',
    '',
    `<div class="bubble user">${safePrompt}</div>`,
    '',
    assistant,
  ].join('\n');
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

/**
 * Normalize a partial note object into a full Note with default values
 * @param {Partial<Note>} note
 * @returns {Note}
 */
export const normalizeNote = (note) => ({
  ...note,
  type: note.type ?? getNoteTypeFromContent(note.content ?? ''),
  savedContent: note.content ?? '',
  dirty: false,
  saving: false,
  sha: note.sha ?? null,
});

/**
 * Create a new note object (not yet saved)
 * @param {string} [filename]
 * @param {string} [content]
 * @param {NoteType} [type]
 * @returns {Partial<Note>}
 */
export const createNote = (filename = '', content = '', type = 'note') => {
  const safeName = filename.trim() || `untitled-${Date.now()}.md`;
  const baseName = safeName.split('/').pop() || safeName;
  return {
    id: safeName,
    path: safeName,
    filename: baseName,
    content,
    type,
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
