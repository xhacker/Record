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

export const createTranscriptHtmlView = ({ htmlSchema, viewFactory }) =>
  viewFactory(htmlSchema, () => (node) => {
    const rawValue = (node?.attrs?.value ?? '').toString();
    const userBubbleText = extractUserBubbleText(rawValue);

    if (userBubbleText == null) {
      const span = document.createElement('span');
      span.dataset.type = 'html';
      span.dataset.value = rawValue;
      span.textContent = rawValue;
      return { dom: span };
    }

    const bubble = document.createElement('span');
    bubble.className = 'bubble user';
    bubble.dataset.type = 'html';
    bubble.dataset.value = rawValue;
    bubble.textContent = userBubbleText;

    return {
      dom: bubble,
      ignoreMutation: () => true,
    };
  });
