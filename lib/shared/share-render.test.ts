import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./registry', () => ({
  getModuleById: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import { renderSharedModuleRoute } from './share-render';
import { getModuleById } from './registry';

const mocked = vi.mocked(getModuleById);

beforeEach(() => {
  mocked.mockReset();
});

describe('renderSharedModuleRoute', () => {
  it('throws notFound when the module is missing', async () => {
    mocked.mockResolvedValueOnce(undefined);
    await expect(renderSharedModuleRoute('jobs', '/pipeline', 'tok')).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });

  it('throws notFound when the route is missing', async () => {
    mocked.mockResolvedValueOnce({
      dir: '/tmp/fake',
      config: {
        id: 'jobs',
        name: 'Jobs',
        enabled: true,
        routes: [],
        api: [],
        widgets: [],
        cron: [],
        requiredEnv: [],
      },
    } as never);
    await expect(renderSharedModuleRoute('jobs', '/pipeline', 'tok')).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });

  it('throws notFound when the route is not shareable', async () => {
    mocked.mockResolvedValueOnce({
      dir: '/tmp/fake',
      config: {
        id: 'jobs',
        name: 'Jobs',
        enabled: true,
        routes: [{ path: '/pipeline', component: 'routes/Pipeline', shareable: false }],
        api: [],
        widgets: [],
        cron: [],
        requiredEnv: [],
      },
    } as never);
    await expect(renderSharedModuleRoute('jobs', '/pipeline', 'tok')).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });
});
