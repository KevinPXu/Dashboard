import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '@/lib/shared/db';
import { shareLinks } from '@/platform/db/schema';
import {
  createShareLink,
  revokeShareLink,
  isShareTokenActive,
  verifyShareToken,
} from '@/lib/shared/share-links';

beforeAll(() => {
  if (!process.env.SHARE_LINK_SIGNING_KEY) process.env.SHARE_LINK_SIGNING_KEY = 'a'.repeat(64);
});

beforeEach(async () => {
  await db.delete(shareLinks);
});

describe('share link DB ops', () => {
  it('creates and verifies an active token', async () => {
    const { token, tokenId } = await createShareLink({
      moduleId: 'jobs',
      route: '/pipeline',
    });
    const payload = verifyShareToken(token, process.env.SHARE_LINK_SIGNING_KEY!);
    expect(payload?.tokenId).toBe(tokenId);
    expect(await isShareTokenActive(tokenId)).toBe(true);
  });

  it('marks revoked links inactive', async () => {
    const { tokenId } = await createShareLink({ moduleId: 'jobs', route: '/pipeline' });
    await revokeShareLink(tokenId);
    expect(await isShareTokenActive(tokenId)).toBe(false);
  });

  it('marks expired links inactive', async () => {
    const { tokenId } = await createShareLink({
      moduleId: 'jobs',
      route: '/pipeline',
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await isShareTokenActive(tokenId)).toBe(false);
  });
});
