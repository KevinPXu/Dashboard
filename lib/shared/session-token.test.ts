import { describe, it, expect } from 'vitest';
import { signSessionToken, verifySessionToken } from './session-token';

const SECRET = 'a'.repeat(64);

describe('session token', () => {
  it('round-trips a payload', () => {
    const token = signSessionToken({ sid: 'abc', exp: 9999999999 }, SECRET);
    const payload = verifySessionToken(token, SECRET);
    expect(payload).toEqual({ sid: 'abc', exp: 9999999999 });
  });

  it('rejects tampered tokens', () => {
    const token = signSessionToken({ sid: 'abc', exp: 9999999999 }, SECRET);
    const tampered = token.slice(0, -2) + 'aa';
    expect(verifySessionToken(tampered, SECRET)).toBeNull();
  });

  it('rejects tokens signed with a different secret', () => {
    const token = signSessionToken({ sid: 'abc', exp: 9999999999 }, SECRET);
    expect(verifySessionToken(token, 'b'.repeat(64))).toBeNull();
  });

  it('rejects expired tokens', () => {
    const token = signSessionToken({ sid: 'abc', exp: 1 }, SECRET);
    expect(verifySessionToken(token, SECRET)).toBeNull();
  });
});
