import 'server-only';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { widgetLayouts, type WidgetLayoutEntry } from '@/platform/db/schema';

const SINGLETON_ID = 'singleton';

export const WidgetLayoutEntrySchema = z.object({
  moduleId: z.string().min(1),
  widgetId: z.string().min(1),
  enabled: z.boolean(),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});
export const WidgetLayoutSchema = z.array(WidgetLayoutEntrySchema);
export type WidgetLayout = z.infer<typeof WidgetLayoutSchema>;

export async function loadLayout(): Promise<WidgetLayoutEntry[] | null> {
  const rows = await db.select().from(widgetLayouts).where(eq(widgetLayouts.id, SINGLETON_ID));
  const raw = rows[0]?.layout ?? null;
  if (raw === null) return null;
  return WidgetLayoutSchema.parse(raw);
}

export async function saveLayout(layout: unknown): Promise<void> {
  const parsed = WidgetLayoutSchema.parse(layout);
  await db
    .insert(widgetLayouts)
    .values({ id: SINGLETON_ID, layout: parsed })
    .onConflictDoUpdate({
      target: widgetLayouts.id,
      set: { layout: parsed, updatedAt: new Date() },
    });
}
