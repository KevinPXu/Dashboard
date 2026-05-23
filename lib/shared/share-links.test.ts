import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';

vi.mock('./db', () => {
  const insertMock = vi.fn();
  const updateMock = vi.fn();
  const selectMock = vi.fn();
  return {
    db: {
      insert: insertMock,
      update: updateMock,
      select: selectMock,
    },
    __mocks: { insertMock, updateMock, selectMock },
  };
});

import {
  signShareToken,
  verifyShareToken,
  createShareLink,
  revokeShareLink,
  listShareLinks,
  isShareTokenActive,
  resolveShareToken,
} from './share-links';
import * as dbModule from './db';

const mocks = (
  dbModule as unknown as {
    __mocks: {
      insertMock: ReturnType<typeof vi.fn>;
      updateMock: ReturnType<typeof vi.fn>;
      selectMock: ReturnType<typeof vi.fn>;
    };
  }
).__mocks;

const SECRET = 'a'.repeat(64);

beforeEach(() => {
  mocks.insertMock.mockReset();
  mocks.updateMock.mockReset();
  mocks.selectMock.mockReset();
  process.env.SHARE_LINK_SIGNING_KEY = SECRET;
});

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

  it('rejects malformed tokens (no dot)', () => {
    expect(verifyShareToken('garbage', SECRET)).toBeNull();
  });

  it('rejects tokens with non-JSON body', () => {
    // Build a token with a valid signature over an invalid JSON body.
    const body = Buffer.from('not-json').toString('base64url');
    const sig = createHmac('sha256', SECRET).update(body).digest('base64url');
    expect(verifyShareToken(`${body}.${sig}`, SECRET)).toBeNull();
  });

  it('rejects tokens with missing payload fields', () => {
    const body = Buffer.from(JSON.stringify({ tokenId: 1 })).toString('base64url');
    const sig = createHmac('sha256', SECRET).update(body).digest('base64url');
    expect(verifyShareToken(`${body}.${sig}`, SECRET)).toBeNull();
  });

  it('rejects tokens whose exp is not a number', () => {
    const body = Buffer.from(
      JSON.stringify({ tokenId: 't', moduleId: 'm', route: '/r', exp: 'bad' }),
    ).toString('base64url');
    const sig = createHmac('sha256', SECRET).update(body).digest('base64url');
    expect(verifyShareToken(`${body}.${sig}`, SECRET)).toBeNull();
  });
});

describe('createShareLink', () => {
  it('throws if SHARE_LINK_SIGNING_KEY is unset', async () => {
    delete process.env.SHARE_LINK_SIGNING_KEY;
    await expect(createShareLink({ moduleId: 'm', route: '/r' })).rejects.toThrow(
      'SHARE_LINK_SIGNING_KEY is not set',
    );
  });

  it('throws if insert returns no row', async () => {
    mocks.insertMock.mockReturnValueOnce({
      values: () => ({ returning: () => Promise.resolve([]) }),
    });
    await expect(createShareLink({ moduleId: 'm', route: '/r' })).rejects.toThrow(
      'Failed to create share link',
    );
  });

  it('signs a token containing the inserted id and optional expiry', async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    mocks.insertMock.mockReturnValueOnce({
      values: () => ({ returning: () => Promise.resolve([{ id: 'row-1' }]) }),
    });
    const { token, tokenId } = await createShareLink({
      moduleId: 'm',
      route: '/r',
      label: 'demo',
      expiresAt,
    });
    expect(tokenId).toBe('row-1');
    const payload = verifyShareToken(token, SECRET);
    expect(payload?.tokenId).toBe('row-1');
    expect(payload?.exp).toBe(Math.floor(expiresAt.getTime() / 1000));
  });
});

describe('revokeShareLink', () => {
  it('runs an update with the supplied tokenId', async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    mocks.updateMock.mockReturnValueOnce({ set });
    await revokeShareLink('tok-1');
    expect(mocks.updateMock).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith({ revokedAt: expect.any(Date) });
    expect(where).toHaveBeenCalledTimes(1);
  });
});

describe('listShareLinks', () => {
  it('returns rows from the select chain', async () => {
    const rows = [{ id: 'a' }];
    mocks.selectMock.mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve(rows) }),
    });
    await expect(listShareLinks()).resolves.toBe(rows);
  });
});

describe('isShareTokenActive', () => {
  function selectReturning(rows: unknown[]) {
    mocks.selectMock.mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve(rows) }),
    });
  }

  it('returns false when no row exists', async () => {
    selectReturning([]);
    await expect(isShareTokenActive('x')).resolves.toBe(false);
  });

  it('returns false when row is revoked', async () => {
    selectReturning([{ revokedAt: new Date(), expiresAt: null }]);
    await expect(isShareTokenActive('x')).resolves.toBe(false);
  });

  it('returns false when row is expired', async () => {
    selectReturning([{ revokedAt: null, expiresAt: new Date(Date.now() - 1000) }]);
    await expect(isShareTokenActive('x')).resolves.toBe(false);
  });

  it('returns true when row is fresh', async () => {
    selectReturning([{ revokedAt: null, expiresAt: null }]);
    await expect(isShareTokenActive('x')).resolves.toBe(true);
  });
});

describe('resolveShareToken', () => {
  it('throws when secret is unset', async () => {
    delete process.env.SHARE_LINK_SIGNING_KEY;
    await expect(resolveShareToken('bad')).rejects.toThrow('SHARE_LINK_SIGNING_KEY is not set');
  });

  it('returns null for an invalid token', async () => {
    await expect(resolveShareToken('garbage')).resolves.toBeNull();
  });

  it('returns null when the token is valid but inactive', async () => {
    const token = signShareToken({ tokenId: 'rev', moduleId: 'm', route: '/r' }, SECRET);
    mocks.selectMock.mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve([]) }),
    });
    await expect(resolveShareToken(token)).resolves.toBeNull();
  });

  it('returns the payload when valid and active', async () => {
    const token = signShareToken({ tokenId: 'live', moduleId: 'm', route: '/r' }, SECRET);
    mocks.selectMock.mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve([{ revokedAt: null, expiresAt: null }]) }),
    });
    await expect(resolveShareToken(token)).resolves.toEqual({
      tokenId: 'live',
      moduleId: 'm',
      route: '/r',
    });
  });
});
