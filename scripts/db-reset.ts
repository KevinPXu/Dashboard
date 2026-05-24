import { spawnSync } from 'node:child_process';
import postgres from 'postgres';
import * as fs from 'node:fs';
import * as path from 'node:path';
import 'dotenv/config';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const sql = postgres(url, { max: 1 });
  try {
    const schemas = ['platform'];
    const modulesDir = path.resolve(process.cwd(), 'modules');
    if (fs.existsSync(modulesDir)) {
      for (const id of fs
        .readdirSync(modulesDir)
        .filter((n) => !n.startsWith('_') && !n.startsWith('.'))) {
        schemas.push(id.replace(/-/g, '_'));
      }
    }
    for (const schema of schemas) {
      console.log(`→ DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
    await sql.unsafe('DROP TABLE IF EXISTS public.__drizzle_migrations');
  } finally {
    await sql.end();
  }
  const r = spawnSync('pnpm', ['db:migrate'], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

void main();
