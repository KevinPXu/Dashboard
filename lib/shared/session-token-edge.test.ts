import { describe, it, expect } from 'vitest';
import { signSessionToken } from './session-token';
import { verifySessionTokenEdge } from './session-token-edge';

const SECRET = 'a'.repeat(64);

describe('verifySessionTokenEdge', () => {
  it('round-trips a payload signed by signSessionToken', async () => {
    const token = signSessionToken({ sid: 'abc', exp: 9999999999 }, SECRET);
    const payload = await verifySessionTokenEdge(token, SECRET);
    expect(payload).toEqual({ sid: 'abc', exp: 9999999999 });
  });

  it('rejects tampered tokens', async () => {
    const token = signSessionToken({ sid: 'abc', exp: 9999999999 }, SECRET);
    const tampered = token.slice(0, -2) + 'aa';
    expect(await verifySessionTokenEdge(tampered, SECRET)).toBeNull();
  });

  it('rejects tokens signed with a different secret', async () => {
    const token = signSessionToken({ sid: 'abc', exp: 9999999999 }, SECRET);
    expect(await verifySessionTokenEdge(token, 'b'.repeat(64))).toBeNull();
  });

  it('rejects expired tokens', async () => {
    const token = signSessionToken({ sid: 'abc', exp: 1 }, SECRET);
    expect(await verifySessionTokenEdge(token, SECRET)).toBeNull();
  });

  it('rejects malformed tokens', async () => {
    expect(await verifySessionTokenEdge('notatoken', SECRET)).toBeNull();
    expect(await verifySessionTokenEdge('', SECRET)).toBeNull();
    expect(await verifySessionTokenEdge('a.', SECRET)).toBeNull();
  });
});
