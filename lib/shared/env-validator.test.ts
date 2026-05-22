import { describe, it, expect } from 'vitest';
import { validateRequiredEnv } from './env-validator';
import type { LoadedModule } from './module-loader';

function mod(id: string, required: string[]): LoadedModule {
  return {
    dir: `/fake/${id}`,
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
      cron: [],
      env: { required, optional: [] },
    },
  } as LoadedModule;
}

describe('validateRequiredEnv', () => {
  it('passes when all required vars are present', () => {
    const env = {
      FOO: 'x',
      BAR: 'y',
      DATABASE_URL: 'x',
      DASHBOARD_PASSWORD: 'x',
      SHARE_LINK_SIGNING_KEY: 'x',
      SESSION_COOKIE_SECRET: 'x',
    };
    expect(() => validateRequiredEnv([mod('a', ['FOO', 'BAR'])], env)).not.toThrow();
  });

  it('throws listing all missing vars across modules', () => {
    const env = {
      FOO: 'x',
      DATABASE_URL: 'x',
      DASHBOARD_PASSWORD: 'x',
      SHARE_LINK_SIGNING_KEY: 'x',
      SESSION_COOKIE_SECRET: 'x',
    };
    let thrown: Error | undefined;
    try {
      validateRequiredEnv([mod('a', ['FOO', 'BAR']), mod('b', ['BAZ'])], env);
    } catch (e) {
      thrown = e as Error;
    }
    expect(thrown).toBeDefined();
    expect(thrown!.message).toMatch(/BAR/);
    expect(thrown!.message).toMatch(/BAZ/);
  });

  it('also checks platform-required vars', () => {
    const env = { DATABASE_URL: 'x' };
    expect(() => validateRequiredEnv([], env)).toThrow(
      /DASHBOARD_PASSWORD|SHARE_LINK_SIGNING_KEY|SESSION_COOKIE_SECRET/,
    );
  });
});
