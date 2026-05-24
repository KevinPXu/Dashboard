import * as fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { discoverModules, type LoadedModule } from '../lib/shared/module-loader';
import { validatePlatformEnv } from '../lib/shared/env-validator';

export function buildVercelConfig(modules: LoadedModule[]): Record<string, unknown> {
  const crons = modules.flatMap((m) =>
    m.config.cron.map((c) => ({ path: c.handler, schedule: c.schedule })),
  );
  return crons.length > 0 ? { crons } : {};
}

async function main() {
  const root = process.cwd();
  // Local builds: hydrate process.env from .env.local so the CRON_SECRET check
  // below sees the same vars Next does. On Vercel there is no .env.local (env
  // is injected), so this is a no-op there.
  const envLocal = path.join(root, '.env.local');
  if (existsSync(envLocal)) loadDotenv({ path: envLocal });

  const modules = await discoverModules(root);
  const enabled = modules.filter((m) => m.config.enabled);
  const config = buildVercelConfig(enabled);

  validatePlatformEnv(process.env, {
    cronCount: (config.crons as unknown[] | undefined)?.length ?? 0,
  });

  const outPath = path.join(root, 'vercel.json');
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await fs.readFile(outPath, 'utf-8'));
  } catch {}
  // Explicitly clear `crons` first so a module removing its cron actually
  // shrinks vercel.json; merging would silently keep stale entries.
  const { crons: _stale, ...rest } = existing;
  const merged = { ...rest, ...config };
  await fs.writeFile(outPath, JSON.stringify(merged, null, 2) + '\n');
  console.log(
    `Wrote ${outPath} with ${(config.crons as unknown[] | undefined)?.length ?? 0} cron entries`,
  );
}

if (require.main === module) {
  void main();
}
