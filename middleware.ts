import { NextResponse, type NextRequest } from 'next/server';
import { verifySessionTokenEdge } from '@/lib/shared/session-token-edge';

// Inlined to avoid pulling auth.ts (and node:crypto via session-token.ts) into Edge.
const SESSION_COOKIE = 'dashboard_session';

const PUBLIC_PATHS = ['/login', '/share', '/_next', '/favicon.ico', '/api/health'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value ?? null;
  const secret = process.env.SESSION_COOKIE_SECRET;
  const valid = cookie && secret ? !!(await verifySessionTokenEdge(cookie, secret)) : false;

  if (!valid) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
