import 'server-only';
import type { ReactElement } from 'react';
import { notFound } from 'next/navigation';
import { getModuleById } from './registry';
import { loadModuleExport } from './module-import';

export async function renderSharedModuleRoute(
  moduleId: string,
  route: string,
  tokenId: string,
): Promise<ReactElement> {
  const mod = await getModuleById(moduleId);
  if (!mod) notFound();

  const routeDef = mod.config.routes.find((r) => r.path === route);
  if (!routeDef || !routeDef.shareable) notFound();

  const imported = await loadModuleExport(
    moduleId,
    routeDef.component,
    (
      m,
    ): m is {
      default: (props: {
        shareScope: { moduleId: string; route: string; tokenId: string };
      }) => Promise<ReactElement> | ReactElement;
    } => typeof (m as { default?: unknown }).default === 'function',
  );

  // shareScope is passed to the module's default export so the module can call
  // getSession(shareScope) to receive { role: 'guest', shareScope }. Without
  // that argument, getSession() returns null — guest detection relies on the
  // 'dashboard_share' cookie set in app/share/[token]/page.tsx for proxy.ts.
  const shareScope = { moduleId, route, tokenId };
  return imported.default({ shareScope });
}
