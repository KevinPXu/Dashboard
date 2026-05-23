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

  const imported = await loadModuleExport<{
    default: (props: {
      shareScope: { moduleId: string; route: string; tokenId: string };
    }) => Promise<ReactElement> | ReactElement;
  }>(moduleId, routeDef.component);

  const shareScope = { moduleId, route, tokenId };
  return imported.default({ shareScope });
}
