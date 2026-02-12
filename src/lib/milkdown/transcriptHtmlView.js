import { isBlockHtml, sanitizeHtmlFragment } from '$lib/milkdown/htmlSanitizer.js';

const USER_BUBBLE_HTML_REGEX = /^<div\s+class=["']bubble user["']\s*>([\s\S]*?)<\/div>$/i;

const decodeHtml = (value = '') => {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
};

const extractUserBubbleText = (value = '') => {
  const match = value.trim().match(USER_BUBBLE_HTML_REGEX);
  if (!match) return null;
  return decodeHtml(match[1] ?? '');
};

const createHtmlNodeContainer = (rawValue = '') => {
  const container = document.createElement('span');
  container.dataset.type = 'html';
  container.dataset.value = rawValue;
  return container;
};

const createUserBubbleDom = (rawValue, text) => {
  const bubble = createHtmlNodeContainer(rawValue);
  bubble.className = 'bubble user';
  bubble.textContent = text;
  return bubble;
};

const createSanitizedHtmlDom = (rawValue) => {
  const container = createHtmlNodeContainer(rawValue);
  container.className = 'transcript-html';
  if (isBlockHtml(rawValue)) {
    container.classList.add('transcript-html-block');
  }
  container.append(sanitizeHtmlFragment(rawValue));
  return container;
};

export const createTranscriptHtmlView = ({ htmlSchema, viewFactory }) =>
  viewFactory(htmlSchema?.node ?? htmlSchema, () => (node) => {
    const rawValue = (node?.attrs?.value ?? '').toString();
    const userBubbleText = extractUserBubbleText(rawValue);

    return {
      dom:
        userBubbleText == null
          ? createSanitizedHtmlDom(rawValue)
          : createUserBubbleDom(rawValue, userBubbleText),
      ignoreMutation: () => true,
    };
  });
