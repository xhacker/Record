import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const session = locals.authSession;

  return {
    authenticated: !!session,
    authError: url.searchParams.get('auth_error'),
    repo: session?.repo ?? null,
    userLogin: session?.user.login ?? null,
  };
};
