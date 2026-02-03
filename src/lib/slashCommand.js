import { AI_CONFIG } from '$lib/config.js';

export const getParagraphBounds = (text, index) => {
  const clampedIndex = Math.min(Math.max(index, 0), text.length);
  const separator = /\n\s*\n/g;
  let start = 0;
  let match;
  while ((match = separator.exec(text)) !== null && match.index < clampedIndex) {
    start = match.index + match[0].length;
  }
  separator.lastIndex = clampedIndex;
  match = separator.exec(text);
  const end = match ? match.index : text.length;
  return { start, end };
};

export const findSlashCommand = (text, cursor, paragraphStart) => {
  const prefix = text.slice(paragraphStart, cursor);
  let slashIndex = prefix.lastIndexOf('/');
  while (slashIndex !== -1) {
    const prevChar = slashIndex === 0 ? '' : prefix[slashIndex - 1];
    if (slashIndex === 0 || /\s/.test(prevChar)) {
      const commandText = prefix.slice(slashIndex).trim();
      if (commandText.length > 1 && !commandText.includes('\n')) {
        return {
          start: paragraphStart + slashIndex,
          end: cursor,
          commandText,
        };
      }
    }
    slashIndex = prefix.lastIndexOf('/', slashIndex - 1);
  }
  return null;
};

export const buildCommandPrompt = ({ paragraphWithoutCommand, commandText }) => {
  return [
    'You are assisting with a focused note.',
    'Use the current paragraph as context for the request.',
    '',
    'Paragraph (command removed):',
    paragraphWithoutCommand.trim(),
    '',
    'Slash command:',
    commandText.trim(),
    '',
    'Return only the text that should replace the slash command. No quotes, no markdown, no extra commentary.',
  ]
    .filter(Boolean)
    .join('\n');
};

export const executeSlashCommand = async (content, cursor) => {
  const { start: paragraphStart, end: paragraphEnd } = getParagraphBounds(content, cursor);
  const command = findSlashCommand(content, cursor, paragraphStart);
  if (!command) return null;

  const paragraph = content.slice(paragraphStart, paragraphEnd);
  const paragraphWithoutCommand =
    paragraph.slice(0, command.start - paragraphStart) +
    paragraph.slice(command.end - paragraphStart);

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: buildCommandPrompt({ paragraphWithoutCommand, commandText: command.commandText }),
      model: AI_CONFIG.commandModel,
      temperature: AI_CONFIG.commandTemperature,
      max_completion_tokens: AI_CONFIG.commandMaxTokens,
      top_p: 1,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error ?? 'Failed to run slash command.');
  }

  const replacement = (payload?.content ?? '').trim();
  if (!replacement) {
    throw new Error('Slash command returned no content.');
  }

  return {
    newContent: content.slice(0, command.start) + replacement + content.slice(command.end),
    newCaret: command.start + replacement.length,
  };
};
