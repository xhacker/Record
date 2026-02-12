import { createSign } from 'node:crypto';
import { getGitHubAppEnv } from '$lib/server/github/env';

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_OAUTH_BASE = 'https://github.com/login/oauth';
const API_VERSION = '2022-11-28';

interface ApiRequestOptions {
  method?: string;
  token?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

interface InstallationTokenCacheEntry {
  token: string;
  expiresAt: number;
}

export interface GitHubViewer {
  id: number;
  login: string;
}

export interface AccessibleRepository {
  repositoryId: number;
  installationId: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
}

const installationTokenCache = new Map<string, InstallationTokenCacheEntry>();

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

const githubApiRequest = async (
  path: string,
  options: ApiRequestOptions = {}
) => {
  const {
    method = 'GET',
    token,
    headers = {},
    body,
  } = options;

  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': API_VERSION,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

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

const buildAppJwt = () => {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 30,
    exp: now + 9 * 60,
    iss: getGitHubAppEnv().appId,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header), 'utf8').toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign('RSA-SHA256');
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(getGitHubAppEnv().privateKey).toString('base64url');

  return `${unsignedToken}.${signature}`;
};

const buildInstallationTokenCacheKey = (
  installationId: number,
  repositoryId: number
) => `${installationId}:${repositoryId}`;

export const clearInstallationTokenCache = (
  installationId?: number,
  repositoryId?: number
) => {
  if (installationId == null || repositoryId == null) {
    installationTokenCache.clear();
    return;
  }
  installationTokenCache.delete(
    buildInstallationTokenCacheKey(installationId, repositoryId)
  );
};

export const getInstallationAccessToken = async (input: {
  installationId: number;
  repositoryId: number;
}) => {
  const cacheKey = buildInstallationTokenCacheKey(
    input.installationId,
    input.repositoryId
  );

  const cached = installationTokenCache.get(cacheKey);
  if (cached && cached.expiresAt - Date.now() > 60_000) {
    return cached.token;
  }

  const appJwt = buildAppJwt();
  const response = await githubApiRequest(
    `/app/installations/${input.installationId}/access_tokens`,
    {
      method: 'POST',
      token: appJwt,
      body: {
        repository_ids: [input.repositoryId],
      },
    }
  );

  const token = response?.token;
  const expiresAt = response?.expires_at;

  if (typeof token !== 'string' || typeof expiresAt !== 'string') {
    throw new Error('GitHub installation token response is incomplete.');
  }

  installationTokenCache.set(cacheKey, {
    token,
    expiresAt: new Date(expiresAt).getTime(),
  });

  return token;
};

export const getOAuthRedirectUri = (origin: string) =>
  getGitHubAppEnv().redirectUri ?? new URL('/auth/github/callback', origin).toString();

export const exchangeOAuthCodeForUserToken = async (input: {
  code: string;
  redirectUri: string;
}) => {
  const response = await fetch(`${GITHUB_OAUTH_BASE}/access_token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: getGitHubAppEnv().clientId,
      client_secret: getGitHubAppEnv().clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
    }),
  });

  const payload = await parseJsonSafe(response);

  if (!response.ok) {
    const message =
      (payload?.error_description as string | undefined) ??
      (payload?.error as string | undefined) ??
      `GitHub OAuth exchange failed (${response.status}).`;
    throw asApiError(response.status, message);
  }

  const accessToken = payload?.access_token;

  if (typeof accessToken !== 'string') {
    throw new Error('GitHub OAuth response did not include an access token.');
  }

  return accessToken;
};

export const getViewer = async (userToken: string): Promise<GitHubViewer> => {
  const response = await githubApiRequest('/user', { token: userToken });

  if (typeof response?.id !== 'number' || typeof response?.login !== 'string') {
    throw new Error('GitHub user profile response is incomplete.');
  }

  return {
    id: response.id,
    login: response.login,
  };
};

const fetchAllItems = async <T>(input: {
  path: string;
  key: string;
  token: string;
}): Promise<T[]> => {
  const items: T[] = [];

  for (let page = 1; page <= 10; page += 1) {
    const delimiter = input.path.includes('?') ? '&' : '?';
    const response = await githubApiRequest(
      `${input.path}${delimiter}per_page=100&page=${page}`,
      { token: input.token }
    );

    const pageItems = Array.isArray(response?.[input.key])
      ? (response[input.key] as T[])
      : [];

    items.push(...pageItems);

    if (pageItems.length < 100) {
      break;
    }
  }

  return items;
};

export const listAccessibleRepositories = async (
  userToken: string
): Promise<AccessibleRepository[]> => {
  const installations = await fetchAllItems<{
    id: number;
  }>({
    path: '/user/installations',
    key: 'installations',
    token: userToken,
  });

  const repositoriesById = new Map<number, AccessibleRepository>();

  await Promise.all(
    installations.map(async (installation) => {
      if (!installation?.id) return;

      const repositories = await fetchAllItems<{
        id: number;
        name: string;
        full_name: string;
        default_branch: string;
        private: boolean;
        owner?: { login?: string };
      }>({
        path: `/user/installations/${installation.id}/repositories`,
        key: 'repositories',
        token: userToken,
      });

      for (const repo of repositories) {
        if (typeof repo?.id !== 'number') continue;
        const owner = repo.owner?.login;
        if (!owner || typeof repo.name !== 'string' || typeof repo.full_name !== 'string') {
          continue;
        }

        repositoriesById.set(repo.id, {
          repositoryId: repo.id,
          installationId: installation.id,
          owner,
          name: repo.name,
          fullName: repo.full_name,
          defaultBranch: repo.default_branch || 'main',
          private: !!repo.private,
        });
      }
    })
  );

  return [...repositoriesById.values()].sort((a, b) =>
    a.fullName.localeCompare(b.fullName)
  );
};
