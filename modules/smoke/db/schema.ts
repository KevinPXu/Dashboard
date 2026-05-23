import { pgSchema, uuid, timestamp } from 'drizzle-orm/pg-core';

export const smoke = pgSchema('smoke');

// Add tables here, e.g.:
// export const items = smoke.table('items', {
//   id: uuid('id').primaryKey().defaultRandom(),
//   createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
// });

// Placeholder kept so generated migrations have something. Delete and add real tables.
export const _placeholder = smoke.table('_placeholder', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
