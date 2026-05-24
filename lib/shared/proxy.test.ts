import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

function req(method: string, opts: { ownerCookie?: boolean; shareCookie?: boolean } = {}) {
  const headers = new Headers();
  const cookieParts: string[] = [];
  if (opts.ownerCookie) cookieParts.push('dashboard_session=signed.value');
  if (opts.shareCookie) cookieParts.push('dashboard_share=tok');
  if (cookieParts.length) headers.set('cookie', cookieParts.join('; '));
  return new NextRequest(new Request('http://x/api/foo', { method, headers }));
}

vi.mock('./session-token-edge', () => ({
  verifySessionTokenEdge: vi.fn(async (v: string) => (v === 'signed.value' ? { sid: 's' } : null)),
}));

describe('proxy', () => {
  it('passes through GET from anonymous user', async () => {
    process.env.SESSION_COOKIE_SECRET = 'x';
    const res = await proxy(req('GET'));
    expect(res?.status ?? 200).toBe(200);
  });
  it('passes through POST from owner', async () => {
    process.env.SESSION_COOKIE_SECRET = 'x';
    const res = await proxy(req('POST', { ownerCookie: true }));
    expect(res?.status ?? 200).toBe(200);
  });
  it('blocks POST from guest (share cookie, no owner)', async () => {
    process.env.SESSION_COOKIE_SECRET = 'x';
    const res = await proxy(req('POST', { shareCookie: true }));
    expect(res?.status).toBe(403);
  });
  it('allows GET from guest', async () => {
    process.env.SESSION_COOKIE_SECRET = 'x';
    const res = await proxy(req('GET', { shareCookie: true }));
    expect(res?.status ?? 200).toBe(200);
  });
});
