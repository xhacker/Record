import { clearInstallationTokenCache, getInstallationAccessToken } from './app';
import type { RepoSession } from '$lib/server/auth/session';

const GITHUB_API_BASE = 'https://api.github.com';
const API_VERSION = '2022-11-28';

interface RepoRequestOptions {
  method?: string;
  body?: unknown;
}

interface NoteWriteInput {
  path: string;
  content: string;
  sha?: string | null;
}

const encodePath = (path: string) =>
  path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

const asApiError = (status: number, message: string) => {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
};

const parseJsonSafe = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { message: text };
  }
};

const requestWithInstallationToken = async (
  repo: RepoSession,
  path: string,
  options: RepoRequestOptions = {},
  attempt = 0
) => {
  const token = await getInstallationAccessToken({
    installationId: repo.installationId,
    repositoryId: repo.repositoryId,
  });

  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': API_VERSION,
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401 && attempt === 0) {
    clearInstallationTokenCache(repo.installationId, repo.repositoryId);
    return requestWithInstallationToken(repo, path, options, attempt + 1);
  }

  if (response.status === 204) {
    return null;
  }

  const parsed = await parseJsonSafe(response);

  if (!response.ok) {
    const message =
      (parsed?.message as string | undefined) ??
      `${response.status} ${response.statusText}`;
    throw asApiError(response.status, message);
  }

  return parsed;
};

const decodeBase64 = (value: string) =>
  Buffer.from(value.replace(/\n/g, ''), 'base64').toString('utf8');

const encodeBase64 = (value: string) => Buffer.from(value, 'utf8').toString('base64');

const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
) => {
  if (!items.length) return [] as R[];

  const results = new Array<R>(items.length);
  let index = 0;

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (index < items.length) {
        const current = index;
        index += 1;
        results[current] = await mapper(items[current], current);
      }
    }
  );

  await Promise.all(workers);
  return results;
};

export const getRepoMeta = (repo: RepoSession) => ({
  owner: repo.owner,
  name: repo.name,
  defaultBranch: repo.defaultBranch,
  fullName: repo.fullName,
});

const getRepoTree = async (repo: RepoSession) => {
  const encodedBranch = encodeURIComponent(repo.defaultBranch);
  return requestWithInstallationToken(
    repo,
    `/repos/${repo.owner}/${repo.name}/git/trees/${encodedBranch}?recursive=1`
  );
};

const getBlobText = async (repo: RepoSession, sha: string) => {
  const blob = await requestWithInstallationToken(
    repo,
    `/repos/${repo.owner}/${repo.name}/git/blobs/${sha}`
  );

  if (!blob?.content || typeof blob.content !== 'string') return '';
  return decodeBase64(blob.content);
};

export const loadNotesFromRepo = async (repo: RepoSession) => {
  const tree = await getRepoTree(repo);
  const entries = Array.isArray(tree?.tree)
    ? tree.tree
    : [];

  const markdownFiles = entries.filter(
    (entry) => entry.type === 'blob' && entry.path?.toLowerCase().endsWith('.md')
  );

  const notes = await mapWithConcurrency(markdownFiles, 6, async (entry) => {
    const content = await getBlobText(repo, entry.sha as string);
    const path = entry.path as string;
    const filename = path.split('/').pop() || path;

    return {
      id: path,
      path,
      filename,
      content,
      sha: entry.sha as string,
    };
  });

  notes.sort((a, b) => a.path.localeCompare(b.path));

  return {
    repo: getRepoMeta(repo),
    notes,
    truncated: !!tree?.truncated,
  };
};

export const writeNoteToRepo = async (
  repo: RepoSession,
  note: NoteWriteInput,
  options: { message?: string } = {}
) => {
  const path = note?.path;
  if (!path) {
    throw new Error('Missing note path for GitHub write-back.');
  }

  const message = options.message || `Update ${path}`;
  let sha = note?.sha ?? null;

  if (!sha) {
    try {
      const encodedPath = encodePath(path);
      const existing = await requestWithInstallationToken(
        repo,
        `/repos/${repo.owner}/${repo.name}/contents/${encodedPath}`
      );
      sha = (existing?.sha as string | undefined) ?? null;
    } catch (error) {
      const status =
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        typeof (error as { status?: unknown }).status === 'number'
          ? (error as { status: number }).status
          : null;

      if (status && status !== 404) {
        throw error;
      }
    }
  }

  const body: Record<string, unknown> = {
    message,
    content: encodeBase64(note?.content ?? ''),
    branch: repo.defaultBranch,
  };

  if (sha) {
    body.sha = sha;
  }

  const encodedPath = encodePath(path);

  const response = await requestWithInstallationToken(
    repo,
    `/repos/${repo.owner}/${repo.name}/contents/${encodedPath}`,
    {
      method: 'PUT',
      body,
    }
  );

  return {
    repo: getRepoMeta(repo),
    sha: (response?.content?.sha as string | undefined) ?? null,
  };
};

export const deleteNoteFromRepo = async (
  repo: RepoSession,
  path: string,
  sha: string,
  options: { message?: string } = {}
) => {
  if (!path) {
    throw new Error('Missing note path for GitHub delete.');
  }
  if (!sha) {
    throw new Error('Missing note sha for GitHub delete.');
  }

  const message = options.message || `Delete ${path}`;
  const body = {
    message,
    sha,
    branch: repo.defaultBranch,
  };

  const encodedPath = encodePath(path);

  await requestWithInstallationToken(
    repo,
    `/repos/${repo.owner}/${repo.name}/contents/${encodedPath}`,
    {
      method: 'DELETE',
      body,
    }
  );

  return {
    repo: getRepoMeta(repo),
  };
};

export const listFilePaths = async (repo: RepoSession) => {
  const tree = await getRepoTree(repo);
  const entries = Array.isArray(tree?.tree)
    ? tree.tree
    : [];

  const files = entries
    .filter((entry) => entry.type === 'blob' && entry.path?.toLowerCase().endsWith('.md'))
    .map((entry) => ({
      path: entry.path,
      type: entry.path.startsWith('transcripts/') ? 'transcript' : 'note',
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return files;
};

export const readFileByPath = async (repo: RepoSession, path: string) => {
  if (!path) {
    throw new Error('Missing file path.');
  }

  const encodedPath = encodePath(path);
  const response = await requestWithInstallationToken(
    repo,
    `/repos/${repo.owner}/${repo.name}/contents/${encodedPath}`
  );

  if (!response?.content || typeof response.content !== 'string') {
    throw new Error(`File not found: ${path}`);
  }

  return {
    path,
    sha: (response.sha as string | undefined) ?? null,
    content: decodeBase64(response.content),
  };
};

export const searchNotes = async (repo: RepoSession, query: string) => {
  if (!query || !query.trim()) {
    throw new Error('Missing search query.');
  }

  const tree = await getRepoTree(repo);
  const entries = Array.isArray(tree?.tree)
    ? tree.tree
    : [];

  const markdownFiles = entries.filter(
    (entry) => entry.type === 'blob' && entry.path?.toLowerCase().endsWith('.md')
  );

  const lowerQuery = query.toLowerCase();
  const matches: Array<{
    path: string;
    type: 'note' | 'transcript';
    matches: Array<{ lineNumber: number; text: string }>;
  }> = [];

  await mapWithConcurrency(markdownFiles, 6, async (entry) => {
    const content = await getBlobText(repo, entry.sha as string);
    if (!content.toLowerCase().includes(lowerQuery)) {
      return;
    }

    const lines = content.split('\n');
    const matchingLines = lines
      .map((line, idx) => ({
        line,
        lineNumber: idx + 1,
      }))
      .filter(({ line }) => line.toLowerCase().includes(lowerQuery))
      .slice(0, 3);

    matches.push({
      path: entry.path as string,
      type: (entry.path as string).startsWith('transcripts/')
        ? 'transcript'
        : 'note',
      matches: matchingLines.map(({ line, lineNumber }) => ({
        lineNumber,
        text: line.slice(0, 200),
      })),
    });
  });

  return matches.sort((a, b) => a.path.localeCompare(b.path));
};
