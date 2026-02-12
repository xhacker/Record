import type { AuthSessionPayload } from '$lib/server/auth/session';

declare global {
  namespace App {
    interface Locals {
      authSession: AuthSessionPayload | null;
    }

    interface PageData {
      authenticated?: boolean;
      authError?: string | null;
      repo?: AuthSessionPayload['repo'] | null;
      userLogin?: string | null;
    }
  }
}

export {};
