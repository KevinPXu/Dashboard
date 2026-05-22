import 'server-only';
import { cookies } from 'next/headers';
import { ForbiddenError } from './errors';
import { verifySessionToken } from './session-token';

export { ForbiddenError } from './errors';

// Also defined in /middleware.ts — keep in sync. Duplicated because the Edge
// bundle must not transitively import this file (it pulls node:crypto).
export const SESSION_COOKIE = 'dashboard_session';

export type ShareScope = { moduleId: string; route: string; tokenId: string };
export type Session = { role: 'owner' } | { role: 'guest'; shareScope: ShareScope };

export type SessionInput = {
  sessionCookie: string | null;
  shareScope: ShareScope | null;
  secret: string;
};

export function resolveSession(input: SessionInput): Session | null {
  if (input.sessionCookie) {
    const payload = verifySessionToken(input.sessionCookie, input.secret);
    if (payload) return { role: 'owner' };
  }
  if (input.shareScope) {
    return { role: 'guest', shareScope: input.shareScope };
  }
  return null;
}

export async function getSession(shareScope: ShareScope | null = null): Promise<Session | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value ?? null;
  const secret = process.env.SESSION_COOKIE_SECRET;
  if (!secret) throw new Error('SESSION_COOKIE_SECRET is not set');
  return resolveSession({ sessionCookie, shareScope, secret });
}

export async function requireOwner(): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    throw new ForbiddenError('Owner required');
  }
}
