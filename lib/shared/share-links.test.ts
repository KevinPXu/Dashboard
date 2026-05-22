import { describe, it, expect } from 'vitest';
import { signShareToken, verifyShareToken } from './share-links';

const SECRET = 'a'.repeat(64);

describe('share-link tokens', () => {
  it('round-trips a payload', () => {
    const token = signShareToken(
      { tokenId: 't1', moduleId: 'jobs', route: '/pipeline', exp: 9999999999 },
      SECRET,
    );
    const payload = verifyShareToken(token, SECRET);
    expect(payload).toEqual({
      tokenId: 't1',
      moduleId: 'jobs',
      route: '/pipeline',
      exp: 9999999999,
    });
  });

  it('round-trips a payload with no expiry', () => {
    const token = signShareToken({ tokenId: 't1', moduleId: 'jobs', route: '/pipeline' }, SECRET);
    const payload = verifyShareToken(token, SECRET);
    expect(payload).toEqual({ tokenId: 't1', moduleId: 'jobs', route: '/pipeline' });
  });

  it('rejects expired tokens', () => {
    const token = signShareToken(
      { tokenId: 't1', moduleId: 'jobs', route: '/pipeline', exp: 1 },
      SECRET,
    );
    expect(verifyShareToken(token, SECRET)).toBeNull();
  });

  it('rejects tampered tokens', () => {
    const token = signShareToken({ tokenId: 't1', moduleId: 'jobs', route: '/pipeline' }, SECRET);
    expect(verifyShareToken(token.slice(0, -2) + 'aa', SECRET)).toBeNull();
  });
});
