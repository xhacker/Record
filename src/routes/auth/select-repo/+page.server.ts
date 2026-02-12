import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
  buildAuthSession,
  clearOAuthPendingCookie,
  readOAuthPendingCookie,
  setAuthSessionCookie,
} from '$lib/server/auth/session';
import { enforceSameOrigin } from '$lib/server/auth/http';
import { listAccessibleRepositories } from '$lib/server/github/app';

const loadAccessibleRepos = async (userToken: string) =>
  listAccessibleRepositories(userToken);

export const load: PageServerLoad = async ({ cookies, locals }) => {
  if (locals.authSession) {
    throw redirect(302, '/');
  }

  const pending = readOAuthPendingCookie(cookies);

  if (!pending) {
    throw redirect(302, '/?auth_error=oauth_session_missing');
  }

  const repositories = await loadAccessibleRepos(pending.userToken);

  if (!repositories.length) {
    clearOAuthPendingCookie(cookies);
    throw redirect(302, '/?auth_error=oauth_no_repositories');
  }

  return {
    userLogin: pending.user.login,
    repositories,
  };
};

export const actions: Actions = {
  default: async (event) => {
    const forbidden = enforceSameOrigin(event);
    if (forbidden) return forbidden;

    const pending = readOAuthPendingCookie(event.cookies);

    if (!pending) {
      throw redirect(302, '/?auth_error=oauth_session_missing');
    }

    const formData = await event.request.formData();
    const repositoryIdRaw = formData.get('repository_id');
    const repositoryId = Number(repositoryIdRaw);

    if (!Number.isInteger(repositoryId) || repositoryId <= 0) {
      return fail(400, {
        error: 'Select a repository to continue.',
      });
    }

    const repositories = await loadAccessibleRepos(pending.userToken);
    const selected = repositories.find(
      (repository) => repository.repositoryId === repositoryId
    );

    if (!selected) {
      return fail(400, {
        error: 'Selected repository is no longer accessible.',
      });
    }

    setAuthSessionCookie(
      event.cookies,
      buildAuthSession({
        user: pending.user,
        repo: {
          repositoryId: selected.repositoryId,
          installationId: selected.installationId,
          owner: selected.owner,
          name: selected.name,
          fullName: selected.fullName,
          defaultBranch: selected.defaultBranch,
        },
      })
    );

    clearOAuthPendingCookie(event.cookies);

    throw redirect(303, '/');
  },
};
