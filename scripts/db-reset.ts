import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import postgres from 'postgres';
import * as fs from 'node:fs';
import * as path from 'node:path';
import 'dotenv/config';

/** Extract the database name from a postgres connection URL. */
export function parseDbName(databaseUrl: string): string {
  try {
    const u = new URL(databaseUrl);
    const name = u.pathname.replace(/^\//, '').split('?')[0];
    return name || '(unknown)';
  } catch {
    return '(unparseable)';
  }
}

/** Extract host:port from a postgres connection URL (for the confirmation prompt). */
export function parseDbHost(databaseUrl: string): string {
  try {
    return new URL(databaseUrl).host || '(unknown host)';
  } catch {
    return '(unknown host)';
  }
}

/**
 * Throws unless db:reset is allowed to run. The hard guard is environment:
 * we never drop schemas while NODE_ENV is production, regardless of any other
 * confirmation. Target-confirmation (typing the DB name) is handled separately
 * so the user always sees which database is about to be wiped.
 */
export function assertResetAllowed(opts: { nodeEnv?: string }): void {
  if (opts.nodeEnv === 'production') {
    throw new Error('Refusing to run db:reset while NODE_ENV=production');
  }
}

/**
 * Require the operator to confirm the exact target database before dropping it.
 * Interactive (TTY): prompt to type the database name. Non-interactive (CI):
 * require DB_RESET_CONFIRM to equal the database name. Returns true on match.
 */
async function confirmTarget(databaseUrl: string): Promise<boolean> {
  const dbName = parseDbName(databaseUrl);
  const host = parseDbHost(databaseUrl);

  if (!process.stdin.isTTY) {
    return process.env.DB_RESET_CONFIRM === dbName;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await new Promise<string>((resolve) =>
      rl.question(
        `\n⚠  db:reset will DROP ALL SCHEMAS on:\n` +
          `     host: ${host}\n` +
          `     db:   ${dbName}\n` +
          `   Type the database name to confirm: `,
        resolve,
      ),
    );
    return answer.trim() === dbName;
  } finally {
    rl.close();
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');

  assertResetAllowed({ nodeEnv: process.env.NODE_ENV });

  if (!(await confirmTarget(url))) {
    console.error('db:reset aborted — confirmation did not match the database name.');
    process.exit(1);
  }

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
    // The `drizzle` schema holds __drizzle_migrations (drizzle-kit's applied-
    // migration ledger). It MUST be dropped too — otherwise the surviving
    // ledger makes `drizzle-kit migrate` skip the platform migrations after a
    // reset, leaving the platform schema un-created.
    schemas.push('drizzle');
    for (const schema of schemas) {
      console.log(`→ DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
    // Belt-and-suspenders for older drizzle-kit versions that stored the ledger
    // in the public schema instead of the dedicated `drizzle` schema.
    await sql.unsafe('DROP TABLE IF EXISTS public.__drizzle_migrations');
  } finally {
    await sql.end();
  }
  const r = spawnSync('pnpm', ['db:migrate'], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (require.main === module) {
  void main();
}
