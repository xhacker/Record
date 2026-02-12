const USER_BUBBLE_HTML_REGEX = /^<div\s+class=["']bubble user["']\s*>([\s\S]*?)<\/div>$/i;

const BLOCK_LEVEL_TAGS = new Set([
  'blockquote',
  'details',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'li',
  'ol',
  'p',
  'pre',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
]);

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const DROP_NODE_TAGS = new Set([
  'button',
  'embed',
  'form',
  'iframe',
  'input',
  'link',
  'meta',
  'noscript',
  'object',
  'script',
  'select',
  'style',
  'textarea',
]);

const ALLOWED_TAGS = new Set([
  'a',
  'blockquote',
  'br',
  'code',
  'details',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  's',
  'small',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'time',
  'tr',
  'u',
  'ul',
]);

const GLOBAL_ATTRIBUTES = new Set(['class', 'dir', 'id', 'lang', 'role', 'title']);
const URL_ATTRIBUTES = new Set(['href', 'src']);
const NUMERIC_ATTRIBUTES = new Set(['colspan', 'height', 'rowspan', 'start', 'width']);
const REL_TOKENS = new Set(['nofollow', 'noopener', 'noreferrer', 'ugc']);
const TAG_ATTRIBUTES = {
  a: new Set(['href', 'rel', 'target']),
  details: new Set(['open']),
  img: new Set(['alt', 'decoding', 'height', 'loading', 'src', 'title', 'width']),
  ol: new Set(['start']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
  time: new Set(['datetime']),
};

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

const isRelativeUrl = (value = '') =>
  value.startsWith('#') ||
  value.startsWith('/') ||
  value.startsWith('?') ||
  value.startsWith('./') ||
  value.startsWith('../');

const sanitizeUrl = (value = '') => {
  const candidate = value.trim();
  if (!candidate) return null;
  if (isRelativeUrl(candidate)) return candidate;

  try {
    const baseUrl = globalThis.location?.origin ?? 'https://record.local';
    const parsed = new URL(candidate, baseUrl);
    return SAFE_PROTOCOLS.has(parsed.protocol) ? candidate : null;
  } catch {
    return null;
  }
};

const sanitizeAttribute = (tagName, name, value) => {
  const attributeName = name.toLowerCase();
  if (attributeName.startsWith('on') || attributeName === 'style') return null;

  const globalAllowed =
    GLOBAL_ATTRIBUTES.has(attributeName) ||
    attributeName.startsWith('aria-') ||
    attributeName.startsWith('data-');
  const tagAllowed = TAG_ATTRIBUTES[tagName]?.has(attributeName) ?? false;
  if (!globalAllowed && !tagAllowed) return null;

  const trimmed = value.trim();

  if (attributeName === 'dir') {
    return ['ltr', 'rtl', 'auto'].includes(trimmed) ? trimmed : null;
  }

  if (attributeName === 'target') {
    return ['_blank', '_self', '_parent', '_top'].includes(trimmed) ? trimmed : null;
  }

  if (attributeName === 'rel') {
    const normalized = trimmed
      .split(/\s+/)
      .map((token) => token.toLowerCase())
      .filter((token) => REL_TOKENS.has(token));
    return normalized.length ? normalized.join(' ') : null;
  }

  if (attributeName === 'loading') {
    return ['eager', 'lazy'].includes(trimmed) ? trimmed : null;
  }

  if (attributeName === 'decoding') {
    return ['async', 'auto', 'sync'].includes(trimmed) ? trimmed : null;
  }

  if (attributeName === 'scope') {
    return ['col', 'colgroup', 'row', 'rowgroup'].includes(trimmed) ? trimmed : null;
  }

  if (attributeName === 'open') {
    return '';
  }

  if (URL_ATTRIBUTES.has(attributeName)) {
    return sanitizeUrl(trimmed);
  }

  if (NUMERIC_ATTRIBUTES.has(attributeName)) {
    const matcher = attributeName === 'start' ? /^-?\d+$/ : /^\d+$/;
    return matcher.test(trimmed) ? trimmed : null;
  }

  return value;
};

const sanitizeNode = (node) => {
  if (node.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(node.textContent ?? '');
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const tagName = node.tagName.toLowerCase();
  if (DROP_NODE_TAGS.has(tagName)) return null;

  if (!ALLOWED_TAGS.has(tagName)) {
    const fragment = document.createDocumentFragment();
    for (const child of node.childNodes) {
      const sanitized = sanitizeNode(child);
      if (sanitized) fragment.append(sanitized);
    }
    return fragment;
  }

  const safeElement = document.createElement(tagName);
  for (const attribute of node.attributes) {
    const safeValue = sanitizeAttribute(tagName, attribute.name, attribute.value);
    if (safeValue == null) continue;
    safeElement.setAttribute(attribute.name.toLowerCase(), safeValue);
  }

  for (const child of node.childNodes) {
    const sanitized = sanitizeNode(child);
    if (sanitized) safeElement.append(sanitized);
  }

  if (tagName === 'a' && safeElement.getAttribute('target') === '_blank') {
    const relTokens = new Set(
      (safeElement.getAttribute('rel') ?? '')
        .split(/\s+/)
        .map((token) => token.toLowerCase())
        .filter(Boolean)
    );
    relTokens.add('noopener');
    relTokens.add('noreferrer');
    safeElement.setAttribute('rel', [...relTokens].join(' '));
  }

  return safeElement;
};

const sanitizeHtmlFragment = (value = '') => {
  const template = document.createElement('template');
  template.innerHTML = value;

  const fragment = document.createDocumentFragment();
  for (const child of template.content.childNodes) {
    const sanitized = sanitizeNode(child);
    if (sanitized) fragment.append(sanitized);
  }
  return fragment;
};

const createHtmlNodeContainer = (rawValue = '') => {
  const container = document.createElement('span');
  container.dataset.type = 'html';
  container.dataset.value = rawValue;
  return container;
};

const isBlockHtml = (value = '') => {
  const match = value.trim().match(/^<\s*([a-z0-9-]+)/i);
  return match ? BLOCK_LEVEL_TAGS.has((match[1] ?? '').toLowerCase()) : false;
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
