import type { LoadedModule } from './module-loader';

const PLATFORM_REQUIRED = [
  'DATABASE_URL',
  'DASHBOARD_PASSWORD',
  'SHARE_LINK_SIGNING_KEY',
  'SESSION_COOKIE_SECRET',
] as const;

export function validateRequiredEnv(
  modules: LoadedModule[],
  env: Record<string, string | undefined> = process.env,
): void {
  const missing: string[] = [];

  for (const key of PLATFORM_REQUIRED) {
    if (!env[key]) missing.push(`${key} (platform)`);
  }

  for (const m of modules) {
    for (const key of m.config.env.required) {
      if (!env[key]) missing.push(`${key} (module: ${m.config.id})`);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables:\n  - ${missing.join('\n  - ')}`);
  }
}

export function validatePlatformEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  opts: { cronCount?: number } = {},
): void {
  // Required in every deployment: without it the Edge proxy cannot verify
  // owner sessions and silently degrades to blocking all guest-cookie writes.
  if (!env.SESSION_COOKIE_SECRET) {
    throw new Error('SESSION_COOKIE_SECRET must be set');
  }
  if ((opts.cronCount ?? 0) > 0 && !env.CRON_SECRET) {
    throw new Error('CRON_SECRET must be set when any module declares a cron entry');
  }
}
