import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/shared/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/shared/auth')>('@/lib/shared/auth');
  return { ...actual, requireOwner: vi.fn() };
});
vi.mock('@/lib/shared/share-links', () => ({
  createShareLink: vi.fn().mockResolvedValue({ token: 't', tokenId: 'id' }),
  revokeShareLink: vi.fn().mockResolvedValue(undefined),
  listShareLinks: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/shared/registry', () => ({
  getModules: vi.fn().mockResolvedValue([
    {
      config: {
        id: 'm',
        name: 'M',
        routes: [{ path: '/r', component: 'routes/r', shareable: { mode: 'read-only' } }],
      },
    },
  ]),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { requireOwner } from '@/lib/shared/auth';
import { createLinkAction, revokeLinkAction, getShareableRoutes, listShareLinks } from './actions';

beforeEach(() => vi.clearAllMocks());

describe('share-link server actions', () => {
  it('createLinkAction requires owner', async () => {
    const fd = new FormData();
    fd.set('moduleId', 'm');
    fd.set('route', '/r');
    await createLinkAction(fd);
    expect(requireOwner).toHaveBeenCalledOnce();
  });
  it('revokeLinkAction requires owner', async () => {
    const fd = new FormData();
    fd.set('tokenId', 'id');
    await revokeLinkAction(fd);
    expect(requireOwner).toHaveBeenCalledOnce();
  });
  it('getShareableRoutes requires owner', async () => {
    await getShareableRoutes();
    expect(requireOwner).toHaveBeenCalledOnce();
  });
  it('listShareLinks requires owner', async () => {
    await listShareLinks();
    expect(requireOwner).toHaveBeenCalledOnce();
  });
});
