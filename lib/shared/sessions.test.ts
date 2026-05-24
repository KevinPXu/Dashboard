import { describe, it, expect, vi } from 'vitest';

vi.mock('./db', () => {
  const returning = vi.fn().mockResolvedValue([{ id: 'abc' }]);
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values }));
  return { db: { insert } };
});

import { createOwnerSession } from './sessions';
import { db } from './db';

describe('createOwnerSession', () => {
  it('inserts a row and returns its id', async () => {
    const expiresAt = new Date('2099-01-01');
    const out = await createOwnerSession(expiresAt);
    expect(out).toEqual({ id: 'abc' });
    expect(db.insert).toHaveBeenCalledOnce();
  });
});
