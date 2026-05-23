import { describe, it, expect } from 'vitest';
import { resolveSession } from './auth';
import { signSessionToken } from './session-token';

const SECRET = 'a'.repeat(64);

describe('resolveSession', () => {
  it('returns owner when valid session cookie present', () => {
    const token = signSessionToken({ sid: 'sess-1', exp: 9999999999 }, SECRET);
    const result = resolveSession({ sessionCookie: token, shareScope: null, secret: SECRET });
    expect(result).toEqual({ role: 'owner' });
  });

  it('returns guest when shareScope present and no session cookie', () => {
    const result = resolveSession({
      sessionCookie: null,
      shareScope: { moduleId: 'jobs', route: '/pipeline', tokenId: 'tok-1' },
      secret: SECRET,
    });
    expect(result).toEqual({
      role: 'guest',
      shareScope: { moduleId: 'jobs', route: '/pipeline', tokenId: 'tok-1' },
    });
  });

  it('returns null when no auth context', () => {
    const result = resolveSession({ sessionCookie: null, shareScope: null, secret: SECRET });
    expect(result).toBeNull();
  });

  it('prefers owner over guest when both present', () => {
    const token = signSessionToken({ sid: 'sess-1', exp: 9999999999 }, SECRET);
    const result = resolveSession({
      sessionCookie: token,
      shareScope: { moduleId: 'jobs', route: '/pipeline', tokenId: 'tok-1' },
      secret: SECRET,
    });
    expect(result).toEqual({ role: 'owner' });
  });

  it('falls through to guest when session cookie invalid', () => {
    const result = resolveSession({
      sessionCookie: 'invalid.token',
      shareScope: { moduleId: 'jobs', route: '/pipeline', tokenId: 'tok-1' },
      secret: SECRET,
    });
    expect(result?.role).toBe('guest');
  });
});
