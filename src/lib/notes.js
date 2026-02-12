/** @typedef {import('./types').Note} Note */
/** @typedef {import('./types').NoteType} NoteType */
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
const USER_BUBBLE_GLOBAL_REGEX = /<div\s+class=["']bubble user["']\s*>([\s\S]*?)<\/div>/gi;
const TOOL_CODE_BLOCK_LEADING_REGEX =
  /^```tool(?::([^\n`]+))?\n([\s\S]*?)\n```\s*/i;

const escapeHtml = (value = '') =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const escapeCodeFence = (value = '') =>
  value.replace(/```/g, '``\\`');

const unescapeHtml = (value = '') =>
  value
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');

const stripHtmlTags = (value = '') =>
  value.replace(/<[^>]*>/g, '');

const sanitizeBubbleText = (rawContent = '') =>
  unescapeHtml(stripHtmlTags(rawContent));

export const formatToolResult = (value) => {
  const trimmed = (value ?? '').toString().trim();
  if (!trimmed) return '';
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return trimmed;
  }
};

const buildToolBlocks = (toolResults = []) =>
  (toolResults ?? [])
    .filter((entry) => entry && entry.content)
    .map(({ tool = 'tool', content = '' }) => {
      const safeTool = String(tool).trim() || 'tool';
      const formatted = formatToolResult(content);
      const safeContent = escapeCodeFence(formatted);
      return `\`\`\`tool:${safeTool}\n${safeContent}\n\`\`\``;
    });

export const buildTranscriptTurn = ({ userPrompt, assistantContent, toolResults = [] }) => {
  const safePrompt = escapeHtml((userPrompt ?? '').trim());
  const assistant = (assistantContent ?? '').trim();
  const toolBlocks = buildToolBlocks(toolResults);

  return [
    `<div class="bubble user">${safePrompt}</div>`,
    ...toolBlocks,
    assistant,
  ]
    .filter(Boolean)
    .join('\n\n')
    .trimEnd();
};

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
 * Split markdown into raw frontmatter block and body.
 * @param {string} [content]
 * @returns {{ frontmatter: string; body: string }}
 */
export const splitFrontmatterContent = (content = '') => {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) {
    return { frontmatter: '', body: content };
  }

  return {
    frontmatter: match[0],
    body: content.slice(match[0].length),
  };
};

/**
 * Get editor-visible markdown body without frontmatter.
 * @param {string} [content]
 * @returns {string}
 */
export const getEditableBodyContent = (content = '') =>
  splitFrontmatterContent(content).body;

/**
 * Reattach original frontmatter to edited markdown body.
 * @param {string} [originalContent]
 * @param {string} [editedBody]
 * @returns {string}
 */
export const applyEditedBodyContent = (originalContent = '', editedBody = '') => {
  const { frontmatter } = splitFrontmatterContent(originalContent);
  const body = (editedBody ?? '').toString();
  if (!frontmatter) return body;
  return `${frontmatter}${body}`;
};

const serializeFrontmatter = (data = {}) => {
  const { type, thread_id, ...rest } = data;
  const orderedEntries = [
    ['type', type],
    ['thread_id', thread_id],
    ...Object.entries(rest).sort(([a], [b]) => a.localeCompare(b)),
  ].filter(([, value]) => value != null && String(value).trim() !== '');

  if (!orderedEntries.length) return '';

  return [
    '---',
    ...orderedEntries.map(([key, value]) => `${key}: ${String(value).trim()}`),
    '---',
  ].join('\n');
};

const buildTranscriptDocument = (data = {}, body = '') => {
  const frontmatter = serializeFrontmatter({ ...data, type: 'transcript' });
  const trimmedBody = (body ?? '').trim();
  if (!frontmatter) return trimmedBody;
  if (!trimmedBody) return frontmatter;
  return `${frontmatter}\n\n${trimmedBody}`;
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

const parseToolResults = (value = '') => {
  let remainder = value.trimStart();
  const toolResults = [];

  while (true) {
    const codeMatch = remainder.match(TOOL_CODE_BLOCK_LEADING_REGEX);
    if (!codeMatch) break;
    toolResults.push({
      tool: (codeMatch[1] ?? 'tool').trim(),
      content: (codeMatch[2] ?? '').trim(),
    });
    remainder = remainder.slice(codeMatch[0].length).trimStart();
  }

  return { toolResults, remainder };
};

/**
 * Parse transcript markdown using user bubble HTML and optional tool result blocks.
 * @param {string} [content]
 * @returns {{ threadId: string; turns: Array<{ userText: string; toolResults?: Array<{ tool: string; content: string }>; assistantText: string }>; assistantText?: string }}
 */
export const parseTranscriptContent = (content = '') => {
  const { data, body } = parseFrontmatter(content);
  const matches = [...body.matchAll(USER_BUBBLE_GLOBAL_REGEX)];
  if (matches.length === 0) {
    return {
      threadId: data.thread_id || '',
      assistantText: body.trim(),
      turns: [],
    };
  }

  const turns = matches.map((match, index) => {
    const segmentStart = (match.index ?? 0) + match[0].length;
    const segmentEnd = matches[index + 1]?.index ?? body.length;
    const segment = body.slice(segmentStart, segmentEnd);
    const { toolResults, remainder } = parseToolResults(segment);
    return {
      userText: sanitizeBubbleText(match[1] ?? ''),
      toolResults,
      assistantText: remainder.trimStart(),
    };
  });

  return {
    threadId: data.thread_id || '',
    turns,
  };
};

// Legacy compatibility exports: transcript content is now edited as raw markdown.
export const getTranscriptEditorContent = (content = '') => (content ?? '').toString();

export const setTranscriptEditorContent = (_originalContent = '', editorBody = '') =>
  (editorBody ?? '').toString();

export const normalizeTranscriptContent = (content = '') => (content ?? '').toString();

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

export const buildTranscriptContent = ({ threadId, userPrompt, assistantContent, toolResults = [] }) => {
  const turn = buildTranscriptTurn({ userPrompt, assistantContent, toolResults });
  return buildTranscriptDocument({ type: 'transcript', thread_id: threadId }, turn);
};

export const appendTranscriptContent = (content = '', { userPrompt, assistantContent, toolResults = [] }) => {
  const { data, body } = parseFrontmatter(content);
  const base = (body ?? '').trim();
  const turn = buildTranscriptTurn({ userPrompt, assistantContent, toolResults });
  const nextBody = base ? `${base}\n\n${turn}` : turn;
  const nextData = {
    ...data,
    type: 'transcript',
  };
  return buildTranscriptDocument(nextData, nextBody);
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
export const normalizeNote = (note) => {
  const type = note.type ?? getNoteTypeFromContent(note.content ?? '');
  const content = note.content ?? '';

  return {
    ...note,
    type,
    content,
    savedContent: content,
    dirty: false,
    saving: false,
    sha: note.sha ?? null,
  };
};

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

/**
 * Check if a note is a transcript (by type or path)
 * @param {Partial<Note>} note
 * @returns {boolean}
 */
export const isTranscript = (note) =>
  note?.type === 'transcript' || (note?.path ?? '').startsWith('transcripts/');

/**
 * Filter notes to only regular notes (not transcripts)
 * @param {Note[]} notes
 * @returns {Note[]}
 */
export const filterNotes = (notes) => notes.filter((n) => !isTranscript(n));

/**
 * Filter notes to only transcripts
 * @param {Note[]} notes
 * @returns {Note[]}
 */
export const filterTranscripts = (notes) => notes.filter((n) => isTranscript(n));
