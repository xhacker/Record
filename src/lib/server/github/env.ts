import { env as privateEnv } from '$env/dynamic/private';
import { z } from 'zod';

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());

const sessionEnvSchema = z.object({
  SESSION_SECRET: z.string().min(32),
  SESSION_TTL_DAYS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(365).optional().default(30)
  ),
});

const githubAppEnvSchema = z.object({
  GITHUB_APP_ID: z.string().min(1),
  GITHUB_APP_CLIENT_ID: z.string().min(1),
  GITHUB_APP_CLIENT_SECRET: z.string().min(1),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1),
  GITHUB_APP_REDIRECT_URI: optionalUrl,
});

let cachedSessionEnv:
  | {
      sessionSecret: string;
      sessionTtlDays: number;
    }
  | null = null;

export const getSessionEnv = () => {
  if (cachedSessionEnv) {
    return cachedSessionEnv;
  }

  const parsed = sessionEnvSchema.safeParse(privateEnv);

  if (!parsed.success) {
    throw new Error('Invalid session environment configuration');
  }

  cachedSessionEnv = {
    sessionSecret: parsed.data.SESSION_SECRET,
    sessionTtlDays: parsed.data.SESSION_TTL_DAYS,
  };

  return cachedSessionEnv;
};

let cachedGitHubAppEnv:
  | {
      appId: string;
      clientId: string;
      clientSecret: string;
      privateKey: string;
      redirectUri?: string;
    }
  | null = null;

export const getGitHubAppEnv = () => {
  if (cachedGitHubAppEnv) {
    return cachedGitHubAppEnv;
  }

  const parsed = githubAppEnvSchema.safeParse(privateEnv);

  if (!parsed.success) {
    throw new Error('Invalid GitHub App environment configuration');
  }

  const data = parsed.data;

  cachedGitHubAppEnv = {
    appId: data.GITHUB_APP_ID,
    clientId: data.GITHUB_APP_CLIENT_ID,
    clientSecret: data.GITHUB_APP_CLIENT_SECRET,
    privateKey: data.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n'),
    redirectUri: data.GITHUB_APP_REDIRECT_URI,
  };

  return cachedGitHubAppEnv;
};
