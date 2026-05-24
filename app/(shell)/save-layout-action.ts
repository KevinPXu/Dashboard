'use server';

import {
  saveLayout,
  WidgetLayoutSchema,
  type WidgetLayout,
} from '@/lib/shared/widget-layout-store';
import { requireOwner } from '@/lib/shared/auth';

export async function saveLayoutAction(layout: WidgetLayout): Promise<void> {
  await requireOwner();
  const parsed = WidgetLayoutSchema.parse(layout);
  await saveLayout(parsed);
}
