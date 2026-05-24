// Runs in the Edge runtime. Do NOT import node:crypto or any 'server-only' code.
// (./cookie-names is dependency-free, so it is safe to import here.)
import { NextResponse, type NextRequest } from 'next/server';
import { verifySessionTokenEdge } from './session-token-edge';
import { SESSION_COOKIE, SHARE_COOKIE } from './cookie-names';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function proxy(req: NextRequest): Promise<NextResponse | undefined> {
  if (SAFE_METHODS.has(req.method)) return; // reads are never blocked here

  const sessionCookie = req.cookies.get(SESSION_COOKIE)?.value ?? null;
  const shareCookie = req.cookies.get(SHARE_COOKIE)?.value ?? null;
  if (!shareCookie) return; // not a guest context — let downstream auth decide

  const secret = process.env.SESSION_COOKIE_SECRET;
  if (sessionCookie && secret) {
    const owner = await verifySessionTokenEdge(sessionCookie, secret);
    if (owner) return; // owner with a stale share cookie is still owner
  }

  return new NextResponse('Guest sessions are read-only', { status: 403 });
}
