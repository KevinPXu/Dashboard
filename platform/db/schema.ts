import { pgSchema, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const platform = pgSchema('platform');

export const shareLinks = platform.table(
  'share_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    moduleId: text('module_id').notNull(),
    route: text('route').notNull(),
    label: text('label'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => ({
    moduleRouteIdx: index('share_links_module_route_idx').on(table.moduleId, table.route),
  }),
);

export const widgetLayouts = platform.table('widget_layouts', {
  id: text('id').primaryKey().default('singleton'),
  layout: jsonb('layout').notNull().$type<WidgetLayoutEntry[]>(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const settings = platform.table('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Currently audit-only — rows are inserted on login but no request-time
// lookup uses them. Phase 7+ will add request-time validation so this
// table becomes the canonical revocation surface.
export const sessions = platform.table('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ip: text('ip'),
  userAgent: text('user_agent'),
});

export type WidgetLayoutEntry = {
  moduleId: string;
  widgetId: string;
  enabled: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
};
