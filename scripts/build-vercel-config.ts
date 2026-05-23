import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { discoverModules, type LoadedModule } from '../lib/shared/module-loader';

export function buildVercelConfig(modules: LoadedModule[]): Record<string, unknown> {
  const crons = modules.flatMap((m) =>
    m.config.cron.map((c) => ({ path: c.handler, schedule: c.schedule })),
  );
  return crons.length > 0 ? { crons } : {};
}

async function main() {
  const root = process.cwd();
  const modules = await discoverModules(root);
  const enabled = modules.filter((m) => m.config.enabled);
  const config = buildVercelConfig(enabled);

  const outPath = path.join(root, 'vercel.json');
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await fs.readFile(outPath, 'utf-8'));
  } catch {}
  const merged = { ...existing, ...config };
  await fs.writeFile(outPath, JSON.stringify(merged, null, 2) + '\n');
  console.log(
    `Wrote ${outPath} with ${(config.crons as unknown[] | undefined)?.length ?? 0} cron entries`,
  );
}

if (require.main === module) {
  void main();
}
