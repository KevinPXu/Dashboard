import { describe, it, expect, vi } from 'vitest';

const selectChain = (rows: unknown[]) => ({
  from: () => ({ where: vi.fn().mockResolvedValue(rows) }),
});
const insertChain = () => ({
  values: () => ({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) }),
});

vi.mock('./db', () => ({
  db: { select: vi.fn(() => selectChain([])), insert: vi.fn(() => insertChain()) },
}));

import { db } from './db';
import { loadLayout, saveLayout, WidgetLayoutSchema } from './widget-layout-store';

describe('widget-layout-store', () => {
  it('returns null when no row exists', async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectChain([]) as never);
    expect(await loadLayout()).toBeNull();
  });
  it('returns parsed entries for a valid row', async () => {
    const layout = [
      { moduleId: 'a', widgetId: 'b', enabled: true, x: 0, y: 0, w: 2, h: 2 },
    ];
    vi.mocked(db.select).mockReturnValueOnce(selectChain([{ layout }]) as never);
    expect(await loadLayout()).toEqual(layout);
  });
  it('throws when the stored layout is malformed', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      selectChain([{ layout: [{ moduleId: 'a' }] }]) as never,
    );
    await expect(loadLayout()).rejects.toThrow();
  });
  it('rejects writes that fail schema validation', async () => {
    await expect(saveLayout([{ moduleId: 1, widgetId: 'b' }])).rejects.toThrow();
  });
  it('exports a usable schema', () => {
    expect(
      WidgetLayoutSchema.safeParse([
        { moduleId: 'a', widgetId: 'b', enabled: true, x: 0, y: 0, w: 2, h: 2 },
      ]).success,
    ).toBe(true);
  });
});
