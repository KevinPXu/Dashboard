import { defineConfig } from 'drizzle-kit';

const moduleId = process.env.DRIZZLE_MODULE_ID;
if (!moduleId) {
  throw new Error('DRIZZLE_MODULE_ID must be set when running drizzle for a module');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: [`./modules/${moduleId}/db/schema.ts`],
  out: `./modules/${moduleId}/db/migrations`,
  dbCredentials: { url: process.env.DATABASE_URL! },
  verbose: true,
  strict: true,
});
