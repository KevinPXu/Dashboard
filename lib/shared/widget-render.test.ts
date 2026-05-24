import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./registry', () => ({
  getModules: vi.fn(),
}));

vi.mock('./module-import', () => ({
  loadModuleExport: vi.fn(),
}));

import { renderAllWidgets } from './widget-render';
import { getModules } from './registry';
import { loadModuleExport } from './module-import';

const mocked = vi.mocked(getModules);
const mockedLoad = vi.mocked(loadModuleExport);

beforeEach(() => {
  mocked.mockReset();
  mockedLoad.mockReset();
});

describe('renderAllWidgets', () => {
  it('returns an empty record when no modules are registered', async () => {
    mocked.mockResolvedValueOnce([]);
    expect(await renderAllWidgets()).toEqual({});
  });

  it('returns an empty record when modules have no widgets', async () => {
    mocked.mockResolvedValueOnce([
      {
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
      },
    ] as never);
    expect(await renderAllWidgets()).toEqual({});
  });
});

describe('renderAllWidgets success path', () => {
  it('loads and invokes each widget, keyed by moduleId:widgetId', async () => {
    mocked.mockResolvedValueOnce([
      {
        dir: '/x',
        config: {
          id: 'm',
          widgets: [
            {
              id: 'w',
              name: 'W',
              defaultSize: { w: 1, h: 1 },
              minSize: { w: 1, h: 1 },
              component: 'widgets/W',
            },
          ],
        },
      },
    ] as never);
    mockedLoad.mockReturnValueOnce({ default: () => 'rendered' } as never);

    const out = await renderAllWidgets();
    expect(out).toEqual({ 'm:w': 'rendered' });
  });
});
