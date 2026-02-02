const API_BASE = 'https://api.github.com';
const API_VERSION = '2022-11-28';
const DEFAULT_OWNER = 'xhacker';
const DEFAULT_REPO = 'the-record-test-repo';

const defaultHeaders = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': API_VERSION,
};

const request = async (token, path, options = {}) => {
  if (!token) {
    const error = new Error('Missing GitHub token.');
    error.status = 401;
    throw error;
  }

  const {
    method = 'GET',
    headers = {},
    body = undefined,
  } = options;

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...defaultHeaders,
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // Ignore JSON parse errors
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return response.json();
};

const decodeBase64 = (value) => {
  const cleaned = value.replace(/\n/g, '');
  const bytes = Uint8Array.from(atob(cleaned), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const mapWithConcurrency = async (items, limit, mapper) => {
  if (!items.length) return [];
  const results = new Array(items.length);
  let index = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await mapper(items[current], current);
    }
  });

  await Promise.all(workers);
  return results;
};

export const getDefaultRepo = async (token) => {
  const repo = await request(token, `/repos/${DEFAULT_OWNER}/${DEFAULT_REPO}`);
  if (!repo?.owner?.login || !repo?.name || !repo?.default_branch) {
    throw new Error('Repository metadata is incomplete.');
  }
  return {
    owner: repo.owner?.login,
    name: repo.name,
    defaultBranch: repo.default_branch,
    fullName: repo.full_name,
  };
};

export const getRepoTree = async (token, owner, repo, branch) => {
  const encodedBranch = encodeURIComponent(branch);
  return request(token, `/repos/${owner}/${repo}/git/trees/${encodedBranch}?recursive=1`);
};

export const getBlobText = async (token, owner, repo, sha) => {
  const blob = await request(token, `/repos/${owner}/${repo}/git/blobs/${sha}`);
  if (!blob?.content) return '';
  return decodeBase64(blob.content);
};

export const loadNotesFromGitHub = async (token) => {
  const repo = await getDefaultRepo(token);
  const tree = await getRepoTree(token, repo.owner, repo.name, repo.defaultBranch);
  const entries = Array.isArray(tree?.tree) ? tree.tree : [];
  const markdownFiles = entries.filter(
    (entry) => entry.type === 'blob' && entry.path?.toLowerCase().endsWith('.md')
  );

  const notes = await mapWithConcurrency(markdownFiles, 6, async (entry) => {
    const content = await getBlobText(token, repo.owner, repo.name, entry.sha);
    const filename = entry.path.split('/').pop() || entry.path;
    return {
      id: entry.path,
      path: entry.path,
      filename,
      content,
    };
  });

  notes.sort((a, b) => a.path.localeCompare(b.path));

  return {
    repo,
    notes,
    truncated: !!tree?.truncated,
  };
};
