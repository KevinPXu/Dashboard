import { describe, it, expect } from 'vitest';
import { ModuleConfigSchema } from './types';

const validConfig = {
  id: 'job-tracker',
  name: 'Job Tracker',
  version: '0.1.0',
  description: 'Track jobs.',
  enabled: true,
  icon: 'Briefcase',
  nav: { label: 'Jobs', order: 10 },
  routes: [
    { path: '/', component: 'routes/index', shareable: false },
    { path: '/pipeline', component: 'routes/pipeline', shareable: { mode: 'read-only' as const } },
  ],
  api: [{ path: '/applications', methods: ['GET', 'POST'] as const }],
  widgets: [
    {
      id: 'upcoming',
      name: 'Upcoming',
      defaultSize: { w: 4, h: 2 },
      minSize: { w: 3, h: 2 },
      component: 'widgets/Upcoming',
    },
  ],
  db: { schema: 'job_tracker' },
  cron: [{ schedule: '0 9 * * 1', handler: '/api/job-tracker/cron/digest' }],
  env: { required: [], optional: ['JOB_TRACKER_OPENAI_KEY'] },
};

describe('ModuleConfigSchema', () => {
  it('accepts a valid full config', () => {
    expect(ModuleConfigSchema.parse(validConfig)).toEqual(validConfig);
  });

  it('rejects non-kebab-case id', () => {
    expect(() => ModuleConfigSchema.parse({ ...validConfig, id: 'JobTracker' })).toThrow(
      /kebab-case/,
    );
  });

  it('rejects db.schema that does not match id', () => {
    expect(() => ModuleConfigSchema.parse({ ...validConfig, db: { schema: 'wrong' } })).toThrow(
      /db\.schema/,
    );
  });

  it('rejects invalid cron expression', () => {
    expect(() =>
      ModuleConfigSchema.parse({
        ...validConfig,
        cron: [{ schedule: 'not-a-cron', handler: '/api/x' }],
      }),
    ).toThrow(/cron/);
  });

  it('allows empty arrays for routes/api/widgets/cron', () => {
    const minimal = {
      ...validConfig,
      routes: [],
      api: [],
      widgets: [],
      cron: [],
    };
    expect(() => ModuleConfigSchema.parse(minimal)).not.toThrow();
  });
});
