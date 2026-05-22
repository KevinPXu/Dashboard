import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/shared/db';
import { widgetLayouts } from '@/platform/db/schema';
import { loadLayout, saveLayout } from '@/lib/shared/widget-layout-store';

beforeEach(async () => {
  await db.delete(widgetLayouts);
});

describe('widget layout store', () => {
  it('returns null when nothing saved', async () => {
    expect(await loadLayout()).toBeNull();
  });

  it('round-trips a layout', async () => {
    const layout = [{ moduleId: 'jobs', widgetId: 'a', enabled: true, x: 0, y: 0, w: 4, h: 2 }];
    await saveLayout(layout);
    expect(await loadLayout()).toEqual(layout);
  });

  it('overwrites on subsequent saves', async () => {
    await saveLayout([{ moduleId: 'jobs', widgetId: 'a', enabled: true, x: 0, y: 0, w: 4, h: 2 }]);
    await saveLayout([{ moduleId: 'jobs', widgetId: 'b', enabled: true, x: 0, y: 0, w: 6, h: 2 }]);
    const result = await loadLayout();
    expect(result).toHaveLength(1);
    expect(result![0]!.widgetId).toBe('b');
  });
});
