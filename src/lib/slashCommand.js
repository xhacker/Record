/**
 * Utilities for slash command parsing and prompt construction.
 */

/**
 * Find paragraph bounds separated by blank lines.
 * @param {string} text
 * @param {number} index
 * @returns {{ start: number; end: number }}
 */
export const getParagraphBounds = (text, index) => {
  const source = (text ?? '').toString();
  const clampedIndex = Math.min(Math.max(index, 0), source.length);
  const separator = /\n\s*\n/g;

  let start = 0;
  let match;
  while ((match = separator.exec(source)) !== null && match.index < clampedIndex) {
    start = match.index + match[0].length;
  }

  separator.lastIndex = clampedIndex;
  match = separator.exec(source);
  const end = match ? match.index : source.length;

  return { start, end };
};

/**
 * Find slash command in a single paragraph, relative to paragraph offsets.
 * @param {string} paragraphText
 * @param {number} cursorInParagraph
 * @returns {{ start: number; end: number; commandText: string } | null}
 */
export const findSlashCommandInParagraph = (paragraphText, cursorInParagraph) => {
  const paragraph = (paragraphText ?? '').toString();
  const clampedCursor = Math.min(Math.max(cursorInParagraph, 0), paragraph.length);
  const prefix = paragraph.slice(0, clampedCursor);

  let slashIndex = prefix.lastIndexOf('/');
  while (slashIndex !== -1) {
    const prevChar = slashIndex === 0 ? '' : prefix[slashIndex - 1];
    if (slashIndex === 0 || /\s/.test(prevChar)) {
      const commandText = prefix.slice(slashIndex).trim();
      if (commandText.length > 1 && !commandText.includes('\n')) {
        return {
          start: slashIndex,
          end: clampedCursor,
          commandText,
        };
      }
    }
    slashIndex = prefix.lastIndexOf('/', slashIndex - 1);
  }

  return null;
};

/**
 * Build slash command context from a paragraph and cursor offset.
 * @param {string} paragraphText
 * @param {number} cursorInParagraph
 * @returns {{ command: { start: number; end: number; commandText: string }; commandText: string; paragraphWithoutCommand: string } | null}
 */
export const getSlashContextFromParagraph = (paragraphText, cursorInParagraph) => {
  const paragraph = (paragraphText ?? '').toString();
  const command = findSlashCommandInParagraph(paragraph, cursorInParagraph);
  if (!command) return null;

  return {
    command,
    commandText: command.commandText,
    paragraphWithoutCommand: paragraph.slice(0, command.start) + paragraph.slice(command.end),
  };
};

/**
 * Build slash command context from full markdown text and a cursor offset.
 * @param {string} text
 * @param {number} cursor
 * @returns {{ paragraphStart: number; paragraphEnd: number; command: { start: number; end: number; commandText: string }; commandText: string; paragraphWithoutCommand: string } | null}
 */
export const getSlashContextFromDocument = (text, cursor) => {
  const source = (text ?? '').toString();
  const { start, end } = getParagraphBounds(source, cursor);
  const paragraphText = source.slice(start, end);
  const context = getSlashContextFromParagraph(paragraphText, Math.max(0, cursor - start));
  if (!context) return null;

  return {
    paragraphStart: start,
    paragraphEnd: end,
    ...context,
  };
};

/**
 * Build the prompt used for slash command generation.
 * @param {{ paragraphWithoutCommand: string; commandText: string }} input
 * @returns {string}
 */
export const buildCommandPrompt = ({ paragraphWithoutCommand, commandText }) => {
  return [
    'You are assisting with a focused note.',
    'Use the current paragraph as context for the request.',
    '',
    'Paragraph (command removed):',
    (paragraphWithoutCommand ?? '').trim(),
    '',
    'Slash command:',
    (commandText ?? '').trim(),
    '',
    'Return only the text that should replace the slash command. No quotes, no markdown, no extra commentary.',
  ]
    .filter(Boolean)
    .join('\n');
};
