import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env });
  if (r.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

function modulesWithMigrations(): string[] {
  const root = path.resolve(process.cwd(), 'modules');
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .filter((name) => !name.startsWith('_') && !name.startsWith('.'))
    .filter((name) => fs.existsSync(path.join(root, name, 'db', 'migrations')))
    .sort();
}

function main() {
  console.log('→ Migrating platform');
  run('pnpm', ['dotenv', '-e', '.env.local', '--', 'drizzle-kit', 'migrate']);

  for (const id of modulesWithMigrations()) {
    console.log(`→ Migrating module ${id}`);
    run(
      'pnpm',
      [
        'dotenv',
        '-e',
        '.env.local',
        '--',
        'drizzle-kit',
        'migrate',
        '--config',
        'drizzle.modules.config.ts',
      ],
      { ...process.env, DRIZZLE_MODULE_ID: id },
    );
  }
}

main();
