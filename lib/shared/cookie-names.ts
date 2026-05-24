// Canonical cookie names, in one place so the Edge proxy, the Node auth
// helpers, and the share-entry route can never drift apart. This module must
// stay dependency-free (no node:* / 'server-only' imports) so the Edge-runtime
// proxy can import it.

/** Signed owner session token (set on login). */
export const SESSION_COOKIE = 'dashboard_session';

/** Guest share-link marker (set when a valid /share/[token] is opened). */
export const SHARE_COOKIE = 'dashboard_share';
