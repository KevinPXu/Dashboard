'use server';

import { saveLayout } from '@/lib/shared/widget-layout-store';
import type { WidgetLayoutEntry } from '@/platform/db/schema';
import { requireOwner } from '@/lib/shared/auth';

export async function saveLayoutAction(layout: WidgetLayoutEntry[]) {
  await requireOwner();
  await saveLayout(layout);
}
