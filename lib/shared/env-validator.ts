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
