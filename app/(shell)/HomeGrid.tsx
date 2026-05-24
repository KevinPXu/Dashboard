'use client';

import { useEffect, useRef, useState } from 'react';
import GridLayout from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import { WidgetErrorBoundary } from '@/components/shell/boundaries/WidgetErrorBoundary';
import type { WidgetLayout } from '@/lib/shared/widget-layout-store';
import { saveLayoutAction } from './save-layout-action';

type Props = {
  initialLayout: WidgetLayout;
  widgets: Record<string, React.ReactNode>; // keyed by `${moduleId}:${widgetId}`
};

const DEBOUNCE_MS = 400;

export function HomeGrid({ initialLayout, widgets }: Props) {
  const [layout, setLayout] = useState(initialLayout);
  const pendingRef = useRef<WidgetLayout | null>(null);
  const inflightRef = useRef<Promise<void> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  function flush() {
    timerRef.current = null;
    const next = pendingRef.current;
    pendingRef.current = null;
    if (!next) return;
    inflightRef.current = (async () => {
      try {
        await saveLayoutAction(next);
      } finally {
        inflightRef.current = null;
      }
      if (pendingRef.current) flush();
    })();
  }

  function scheduleSave(next: WidgetLayout) {
    pendingRef.current = next;
    if (timerRef.current) return;
    timerRef.current = setTimeout(flush, DEBOUNCE_MS);
  }

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
        const merged: WidgetLayout = layout.map((entry) => {
          const found = next.find((n) => n.i === `${entry.moduleId}:${entry.widgetId}`);
          if (!found) return entry;
          return { ...entry, x: found.x, y: found.y, w: found.w, h: found.h };
        });
        setLayout(merged);
        scheduleSave(merged);
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
