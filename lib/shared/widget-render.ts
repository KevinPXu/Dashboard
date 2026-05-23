import 'server-only';
import { getModules } from './registry';
import { loadModuleExport } from './module-import';
import type { ReactNode } from 'react';

export async function renderAllWidgets(): Promise<Record<string, ReactNode>> {
  const modules = await getModules();
  const out: Record<string, ReactNode> = {};
  for (const m of modules) {
    for (const w of m.config.widgets) {
      try {
        const mod = await loadModuleExport<{
          default: () => Promise<ReactNode> | ReactNode;
        }>(m.config.id, w.component);
        out[`${m.config.id}:${w.id}`] = await mod.default();
      } catch (err) {
        console.error(`Widget ${m.config.id}:${w.id} failed to render`, err);
      }
    }
  }
  return out;
}
