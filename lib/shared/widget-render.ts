import 'server-only';
import * as path from 'node:path';
import { getModules } from './registry';
import type { ReactNode } from 'react';

export async function renderAllWidgets(): Promise<Record<string, ReactNode>> {
  const modules = await getModules();
  const out: Record<string, ReactNode> = {};
  for (const m of modules) {
    for (const w of m.config.widgets) {
      const componentPath = path.join(m.dir, w.component);
      try {
        const mod = (await import(/* @vite-ignore */ componentPath)) as {
          default: () => Promise<ReactNode> | ReactNode;
        };
        out[`${m.config.id}:${w.id}`] = await mod.default();
      } catch (err) {
        console.error(`Widget ${m.config.id}:${w.id} failed to render`, err);
      }
    }
  }
  return out;
}
