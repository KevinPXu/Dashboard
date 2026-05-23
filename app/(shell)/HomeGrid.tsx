'use client';

import { useState } from 'react';
import GridLayout from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import { WidgetErrorBoundary } from '@/components/shell/boundaries/WidgetErrorBoundary';
import type { WidgetLayoutEntry } from '@/platform/db/schema';
import { saveLayoutAction } from './save-layout-action';

type Props = {
  initialLayout: WidgetLayoutEntry[];
  widgets: Record<string, React.ReactNode>; // keyed by `${moduleId}:${widgetId}`
};

export function HomeGrid({ initialLayout, widgets }: Props) {
  const [layout, setLayout] = useState(initialLayout);
  const gridLayout = layout
    .filter((l) => l.enabled)
    .map((l) => ({
      i: `${l.moduleId}:${l.widgetId}`,
      x: l.x,
      y: l.y,
      w: l.w,
      h: l.h,
    }));

  return (
    <GridLayout
      className="layout"
      cols={12}
      rowHeight={80}
      width={1100}
      layout={gridLayout}
      onLayoutChange={(next) => {
        const merged: WidgetLayoutEntry[] = layout.map((entry) => {
          const found = next.find((n) => n.i === `${entry.moduleId}:${entry.widgetId}`);
          if (!found) return entry;
          return { ...entry, x: found.x, y: found.y, w: found.w, h: found.h };
        });
        setLayout(merged);
        void saveLayoutAction(merged);
      }}
    >
      {gridLayout.map((g) => {
        const node = widgets[g.i];
        return (
          <div key={g.i} className="overflow-hidden rounded border bg-white">
            <WidgetErrorBoundary widgetName={g.i}>{node ?? null}</WidgetErrorBoundary>
          </div>
        );
      })}
    </GridLayout>
  );
}
