import type { LoadedModule } from './module-loader';
import type { WidgetLayoutEntry } from '@/platform/db/schema';

export function buildDefaultLayout(modules: LoadedModule[], columns: number): WidgetLayoutEntry[] {
  const layout: WidgetLayoutEntry[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;

  for (const m of modules) {
    for (const w of m.config.widgets) {
      if (x + w.defaultSize.w > columns) {
        x = 0;
        y += rowH;
        rowH = 0;
      }
      layout.push({
        moduleId: m.config.id,
        widgetId: w.id,
        enabled: true,
        x,
        y,
        w: w.defaultSize.w,
        h: w.defaultSize.h,
      });
      x += w.defaultSize.w;
      rowH = Math.max(rowH, w.defaultSize.h);
    }
  }

  return layout;
}
