export { proxy as middleware } from './lib/shared/proxy';

export const config = {
  // Match every request except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
