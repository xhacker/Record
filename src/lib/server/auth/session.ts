import { dev } from '$app/environment';
import type { Cookies } from '@sveltejs/kit';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { getSessionEnv } from '$lib/server/github/env';

export const AUTH_SESSION_COOKIE = 'record_auth_session';
export const OAUTH_PENDING_COOKIE = 'record_oauth_pending';
export const OAUTH_STATE_COOKIE = 'record_oauth_state';

const OAUTH_PENDING_MAX_AGE = 10 * 60;
const OAUTH_STATE_MAX_AGE = 10 * 60;

const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: !dev,
  sameSite: 'lax' as const,
};

let cachedSessionKey: Buffer | null = null;

const getAuthSessionMaxAge = () => getSessionEnv().sessionTtlDays * 24 * 60 * 60;

const getSessionKey = () => {
  if (cachedSessionKey) {
    return cachedSessionKey;
  }

  cachedSessionKey = createHash('sha256')
    .update(getSessionEnv().sessionSecret, 'utf8')
    .digest();

  return cachedSessionKey;
};

export interface RepoSession {
  repositoryId: number;
  installationId: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
}

export interface AuthSessionPayload {
  version: 1;
  issuedAt: number;
  expiresAt: number;
  user: {
    id: number;
    login: string;
  };
  repo: RepoSession;
}

export interface OAuthPendingPayload {
  version: 1;
  issuedAt: number;
  expiresAt: number;
  userToken: string;
  user: {
    id: number;
    login: string;
  };
}

const encode = (value: Buffer) => value.toString('base64url');

const decode = (value: string) => {
  try {
    return Buffer.from(value, 'base64url');
  } catch {
    return null;
  }
};

const encrypt = (payload: unknown) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getSessionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${encode(iv)}.${encode(encrypted)}.${encode(tag)}`;
};

const decrypt = <T>(token: string): T | null => {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const iv = decode(parts[0]);
  const encrypted = decode(parts[1]);
  const tag = decode(parts[2]);

  if (!iv || !encrypted || !tag) return null;

  try {
    const decipher = createDecipheriv('aes-256-gcm', getSessionKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8')) as T;
  } catch {
    return null;
  }
};

const isValidTimestamp = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const isAuthSessionPayload = (value: unknown): value is AuthSessionPayload => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AuthSessionPayload>;
  return (
    candidate.version === 1 &&
    isValidTimestamp(candidate.issuedAt) &&
    isValidTimestamp(candidate.expiresAt) &&
    typeof candidate.user?.id === 'number' &&
    typeof candidate.user?.login === 'string' &&
    typeof candidate.repo?.repositoryId === 'number' &&
    typeof candidate.repo?.installationId === 'number' &&
    typeof candidate.repo?.owner === 'string' &&
    typeof candidate.repo?.name === 'string' &&
    typeof candidate.repo?.fullName === 'string' &&
    typeof candidate.repo?.defaultBranch === 'string'
  );
};

const isOAuthPendingPayload = (value: unknown): value is OAuthPendingPayload => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<OAuthPendingPayload>;
  return (
    candidate.version === 1 &&
    isValidTimestamp(candidate.issuedAt) &&
    isValidTimestamp(candidate.expiresAt) &&
    typeof candidate.userToken === 'string' &&
    typeof candidate.user?.id === 'number' &&
    typeof candidate.user?.login === 'string'
  );
};

const isExpired = (expiresAt: number) => Date.now() >= expiresAt;

const setEncryptedCookie = (
  cookies: Cookies,
  name: string,
  payload: unknown,
  maxAge: number
) => {
  cookies.set(name, encrypt(payload), {
    ...COOKIE_OPTIONS,
    maxAge,
  });
};

const readEncryptedCookie = <T>(cookies: Cookies, name: string) => {
  const raw = cookies.get(name);
  if (!raw) return null;
  return decrypt<T>(raw);
};

export const buildAuthSession = (input: {
  user: { id: number; login: string };
  repo: RepoSession;
}): AuthSessionPayload => {
  const authSessionMaxAge = getAuthSessionMaxAge();
  const issuedAt = Date.now();
  const expiresAt = issuedAt + authSessionMaxAge * 1000;

  return {
    version: 1,
    issuedAt,
    expiresAt,
    user: input.user,
    repo: input.repo,
  };
};

export const setAuthSessionCookie = (
  cookies: Cookies,
  payload: AuthSessionPayload
) => {
  setEncryptedCookie(cookies, AUTH_SESSION_COOKIE, payload, getAuthSessionMaxAge());
};

export const readAuthSessionCookie = (cookies: Cookies): AuthSessionPayload | null => {
  const payload = readEncryptedCookie<unknown>(cookies, AUTH_SESSION_COOKIE);
  if (!payload || !isAuthSessionPayload(payload)) return null;
  if (isExpired(payload.expiresAt)) return null;
  return payload;
};

export const clearAuthSessionCookie = (cookies: Cookies) => {
  cookies.delete(AUTH_SESSION_COOKIE, {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });
};

export const buildOAuthPending = (input: {
  userToken: string;
  user: { id: number; login: string };
}): OAuthPendingPayload => {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + OAUTH_PENDING_MAX_AGE * 1000;

  return {
    version: 1,
    issuedAt,
    expiresAt,
    userToken: input.userToken,
    user: input.user,
  };
};

export const setOAuthPendingCookie = (
  cookies: Cookies,
  payload: OAuthPendingPayload
) => {
  setEncryptedCookie(cookies, OAUTH_PENDING_COOKIE, payload, OAUTH_PENDING_MAX_AGE);
};

export const readOAuthPendingCookie = (
  cookies: Cookies
): OAuthPendingPayload | null => {
  const payload = readEncryptedCookie<unknown>(cookies, OAUTH_PENDING_COOKIE);
  if (!payload || !isOAuthPendingPayload(payload)) return null;
  if (isExpired(payload.expiresAt)) return null;
  return payload;
};

export const clearOAuthPendingCookie = (cookies: Cookies) => {
  cookies.delete(OAUTH_PENDING_COOKIE, {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });
};

export const setOAuthStateCookie = (cookies: Cookies, state: string) => {
  cookies.set(OAUTH_STATE_COOKIE, state, {
    ...COOKIE_OPTIONS,
    maxAge: OAUTH_STATE_MAX_AGE,
  });
};

export const consumeOAuthStateCookie = (
  cookies: Cookies,
  state: string
): boolean => {
  const expected = cookies.get(OAUTH_STATE_COOKIE);
  cookies.delete(OAUTH_STATE_COOKIE, {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });

  if (!expected || !state) return false;

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const receivedBuffer = Buffer.from(state, 'utf8');

  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, receivedBuffer);
};

export const clearOAuthStateCookie = (cookies: Cookies) => {
  cookies.delete(OAUTH_STATE_COOKIE, {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });
};
