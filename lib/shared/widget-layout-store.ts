import 'server-only';
import { db } from './db';
import { widgetLayouts, type WidgetLayoutEntry } from '@/platform/db/schema';
import { eq } from 'drizzle-orm';

const SINGLETON_ID = 'singleton';

export async function loadLayout(): Promise<WidgetLayoutEntry[] | null> {
  const rows = await db.select().from(widgetLayouts).where(eq(widgetLayouts.id, SINGLETON_ID));
  return rows[0]?.layout ?? null;
}

export async function saveLayout(layout: WidgetLayoutEntry[]): Promise<void> {
  await db
    .insert(widgetLayouts)
    .values({ id: SINGLETON_ID, layout })
    .onConflictDoUpdate({
      target: widgetLayouts.id,
      set: { layout, updatedAt: new Date() },
    });
}
