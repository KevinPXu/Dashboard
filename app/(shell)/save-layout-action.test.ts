import { describe, it, expect, vi } from 'vitest';

// The partial mock below uses importActual to keep the real WidgetLayoutSchema,
// which transitively imports lib/shared/db.ts — and that throws at import time
// when DATABASE_URL is unset (e.g. in CI). Stub db so the import is inert;
// saveLayout is mocked anyway, so the client is never used.
vi.mock('@/lib/shared/db', () => ({ db: {} }));
vi.mock('@/lib/shared/auth', () => ({ requireOwner: vi.fn() }));
const { saveLayoutMock } = vi.hoisted(() => ({ saveLayoutMock: vi.fn() }));
vi.mock('@/lib/shared/widget-layout-store', async () => {
  const real = await vi.importActual<typeof import('@/lib/shared/widget-layout-store')>(
    '@/lib/shared/widget-layout-store',
  );
  return { ...real, saveLayout: saveLayoutMock };
});

import { saveLayoutAction } from './save-layout-action';

describe('saveLayoutAction', () => {
  it('rejects malformed input', async () => {
    await expect(saveLayoutAction([{ moduleId: 1 } as never])).rejects.toThrow();
    expect(saveLayoutMock).not.toHaveBeenCalled();
  });
  it('forwards a valid layout', async () => {
    await saveLayoutAction([
      { moduleId: 'a', widgetId: 'b', enabled: true, x: 0, y: 0, w: 2, h: 2 },
    ]);
    expect(saveLayoutMock).toHaveBeenCalledOnce();
  });
});
