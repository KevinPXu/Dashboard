import { describe, it, expect } from 'vitest';
import { buildVercelConfig } from './build-vercel-config';
import type { LoadedModule } from '@/lib/shared/module-loader';

function mod(id: string, cron: { schedule: string; handler: string }[]): LoadedModule {
  return {
    dir: `/x/${id}`,
    config: {
      id,
      name: id,
      version: '0.0.1',
      description: '',
      enabled: true,
      icon: 'Box',
      nav: { label: id, order: 0 },
      routes: [],
      api: [],
      widgets: [],
      db: { schema: id.replace(/-/g, '_') },
      cron,
      env: { required: [], optional: [] },
    },
  } as LoadedModule;
}

describe('buildVercelConfig', () => {
  it('aggregates cron entries from all modules', () => {
    const result = buildVercelConfig([
      mod('jobs', [{ schedule: '0 9 * * 1', handler: '/api/jobs/cron/digest' }]),
      mod('reading', [{ schedule: '0 0 * * *', handler: '/api/reading/cron/daily' }]),
    ]);
    expect(result.crons).toEqual([
      { path: '/api/jobs/cron/digest', schedule: '0 9 * * 1' },
      { path: '/api/reading/cron/daily', schedule: '0 0 * * *' },
    ]);
  });

  it('omits crons key when no module has crons', () => {
    const result = buildVercelConfig([mod('jobs', [])]);
    expect(result).toEqual({});
  });
});
