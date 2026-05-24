import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./registry', () => ({
  getModuleById: vi.fn(),
}));

vi.mock('./module-import', () => ({
  loadModuleExport: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import { renderSharedModuleRoute } from './share-render';
import { getModuleById } from './registry';
import { loadModuleExport } from './module-import';

const mocked = vi.mocked(getModuleById);
const mockedLoad = vi.mocked(loadModuleExport);

beforeEach(() => {
  mocked.mockReset();
  mockedLoad.mockReset();
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

describe('renderSharedModuleRoute success path', () => {
  it('passes shareScope to the module default export', async () => {
    mocked.mockResolvedValueOnce({
      dir: '/tmp/fake',
      config: {
        id: 'm',
        routes: [{ path: '/r', component: 'routes/r', shareable: { mode: 'read-only' } }],
      },
    } as never);
    mockedLoad.mockReturnValueOnce({
      default: vi.fn().mockImplementation((p: { shareScope: unknown }) => ({
        type: 'div',
        props: { 'data-scope': JSON.stringify(p.shareScope) },
        key: null,
      })),
    } as never);

    const el = await renderSharedModuleRoute('m', '/r', 'tok123');
    expect(loadModuleExport).toHaveBeenCalledWith('m', 'routes/r', expect.any(Function));
    const calls = (
      loadModuleExport as unknown as {
        mock: { results: { value: { default: ReturnType<typeof vi.fn> } }[] };
      }
    ).mock.results;
    const defaultFn = calls[0]!.value.default;
    expect(defaultFn).toHaveBeenCalledWith({
      shareScope: { moduleId: 'm', route: '/r', tokenId: 'tok123' },
    });
    expect(el).toBeTruthy();
  });
});
