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
      ...(body ? { 'Content-Type': 'application/json' } : {}),
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

const encodeBase64 = (value) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');

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
      sha: entry.sha,
    };
  });

  notes.sort((a, b) => a.path.localeCompare(b.path));

  return {
    repo,
    notes,
    truncated: !!tree?.truncated,
  };
};

export const writeNoteToGitHub = async (token, note, repoOverride = null, options = {}) => {
  const repo = repoOverride ?? await getDefaultRepo(token);
  const path = note?.path;
  if (!path) {
    throw new Error('Missing note path for GitHub write-back.');
  }

  const message = options.message || `Update ${path}`;
  const body = {
    message,
    content: encodeBase64(note?.content ?? ''),
    branch: repo.defaultBranch,
  };

  if (note?.sha) {
    body.sha = note.sha;
  }

  const encodedPath = encodePath(path);
  const response = await request(token, `/repos/${repo.owner}/${repo.name}/contents/${encodedPath}`, {
    method: 'PUT',
    body,
  });

  return {
    repo,
    sha: response?.content?.sha ?? null,
  };
};

export const deleteNoteFromGitHub = async (token, path, sha, repoOverride = null, options = {}) => {
  if (!path) {
    throw new Error('Missing note path for GitHub delete.');
  }
  if (!sha) {
    throw new Error('Missing note sha for GitHub delete.');
  }

  const repo = repoOverride ?? await getDefaultRepo(token);
  const message = options.message || `Delete ${path}`;
  const body = {
    message,
    sha,
    branch: repo.defaultBranch,
  };

  const encodedPath = encodePath(path);
  await request(token, `/repos/${repo.owner}/${repo.name}/contents/${encodedPath}`, {
    method: 'DELETE',
    body,
  });

  return { repo };
};

// ============================================
// Agent tool functions
// ============================================

/**
 * List all markdown file paths in the repository (lightweight, no content)
 * Used by the list_files agent tool
 */
export const listFilePaths = async (token) => {
  const repo = await getDefaultRepo(token);
  const tree = await getRepoTree(token, repo.owner, repo.name, repo.defaultBranch);
  const entries = Array.isArray(tree?.tree) ? tree.tree : [];

  const files = entries
    .filter((entry) => entry.type === 'blob' && entry.path?.toLowerCase().endsWith('.md'))
    .map((entry) => ({
      path: entry.path,
      type: entry.path.startsWith('transcripts/') ? 'transcript' : 'note',
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return files;
};

/**
 * Read a single file's content by path
 * Used by the read_file agent tool
 */
export const readFileByPath = async (token, path) => {
  if (!path) {
    throw new Error('Missing file path.');
  }

  const repo = await getDefaultRepo(token);
  const encodedPath = encodePath(path);

  const response = await request(token, `/repos/${repo.owner}/${repo.name}/contents/${encodedPath}`);

  if (!response?.content) {
    throw new Error(`File not found: ${path}`);
  }

  const content = decodeBase64(response.content);

  return {
    path,
    content,
  };
};

/**
 * Write/create a file by path
 * Used by the write_file agent tool
 */
export const writeFileByPath = async (token, path, content) => {
  if (!path) {
    throw new Error('Missing file path.');
  }

  const repo = await getDefaultRepo(token);
  const encodedPath = encodePath(path);

  // Try to get existing file for SHA (needed for updates)
  let sha = null;
  try {
    const existing = await request(token, `/repos/${repo.owner}/${repo.name}/contents/${encodedPath}`);
    sha = existing?.sha;
  } catch {
    // File doesn't exist, will create new
  }

  const body = {
    message: sha ? `Update ${path}` : `Create ${path}`,
    content: encodeBase64(content ?? ''),
    branch: repo.defaultBranch,
  };

  if (sha) {
    body.sha = sha;
  }

  const response = await request(token, `/repos/${repo.owner}/${repo.name}/contents/${encodedPath}`, {
    method: 'PUT',
    body,
  });

  return {
    path,
    sha: response?.content?.sha ?? null,
    created: !sha,
  };
};

/**
 * Search notes by content (case-insensitive)
 * Used by the search_notes agent tool
 */
export const searchNotes = async (token, query) => {
  if (!query || !query.trim()) {
    throw new Error('Missing search query.');
  }

  const repo = await getDefaultRepo(token);
  const tree = await getRepoTree(token, repo.owner, repo.name, repo.defaultBranch);
  const entries = Array.isArray(tree?.tree) ? tree.tree : [];

  const markdownFiles = entries.filter(
    (entry) => entry.type === 'blob' && entry.path?.toLowerCase().endsWith('.md')
  );

  const lowerQuery = query.toLowerCase();
  const matches = [];

  // Search through files (with concurrency limit)
  await mapWithConcurrency(markdownFiles, 6, async (entry) => {
    const content = await getBlobText(token, repo.owner, repo.name, entry.sha);
    if (content.toLowerCase().includes(lowerQuery)) {
      // Find matching lines for context
      const lines = content.split('\n');
      const matchingLines = lines
        .map((line, idx) => ({ line, lineNumber: idx + 1 }))
        .filter(({ line }) => line.toLowerCase().includes(lowerQuery))
        .slice(0, 3); // Max 3 matching lines per file

      matches.push({
        path: entry.path,
        type: entry.path.startsWith('transcripts/') ? 'transcript' : 'note',
        matches: matchingLines.map(({ line, lineNumber }) => ({
          lineNumber,
          text: line.slice(0, 200), // Truncate long lines
        })),
      });
    }
  });

  return matches.sort((a, b) => a.path.localeCompare(b.path));
};
