import { describe, it, expect } from 'vitest';
import { buildDefaultLayout } from './widgets';
import type { LoadedModule } from './module-loader';

function mod(
  id: string,
  widgets: { id: string; defaultSize: { w: number; h: number } }[],
): LoadedModule {
  return {
    dir: `/x/${id}`,
    config: {
      id,
      name: id,
      version: '0.0.1',
      description: '',
      enabled: true,
      icon: 'Box',
      nav: { label: id, order: 0 },
      routes: [],
      api: [],
      widgets: widgets.map((w) => ({
        ...w,
        name: w.id,
        minSize: { w: 1, h: 1 },
        component: `widgets/${w.id}`,
      })),
      db: { schema: id.replace(/-/g, '_') },
      cron: [],
      env: { required: [], optional: [] },
    },
  } as LoadedModule;
}

describe('buildDefaultLayout', () => {
  it('places widgets in declaration order with default sizes', () => {
    const modules = [
      mod('jobs', [
        { id: 'a', defaultSize: { w: 4, h: 2 } },
        { id: 'b', defaultSize: { w: 4, h: 2 } },
      ]),
    ];
    const layout = buildDefaultLayout(modules, 12);
    expect(layout).toEqual([
      { moduleId: 'jobs', widgetId: 'a', enabled: true, x: 0, y: 0, w: 4, h: 2 },
      { moduleId: 'jobs', widgetId: 'b', enabled: true, x: 4, y: 0, w: 4, h: 2 },
    ]);
  });

  it('wraps to the next row when the next widget would overflow', () => {
    const modules = [
      mod('jobs', [
        { id: 'a', defaultSize: { w: 8, h: 2 } },
        { id: 'b', defaultSize: { w: 6, h: 2 } },
      ]),
    ];
    const layout = buildDefaultLayout(modules, 12);
    expect(layout[1]).toEqual({
      moduleId: 'jobs',
      widgetId: 'b',
      enabled: true,
      x: 0,
      y: 2,
      w: 6,
      h: 2,
    });
  });
});
