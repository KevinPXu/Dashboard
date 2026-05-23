import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./registry', () => ({
  getModules: vi.fn(),
}));

import { renderAllWidgets } from './widget-render';
import { getModules } from './registry';

const mocked = vi.mocked(getModules);

beforeEach(() => {
  mocked.mockReset();
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
