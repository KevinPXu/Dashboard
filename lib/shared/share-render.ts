import 'server-only';
import * as path from 'node:path';
import type { ReactElement } from 'react';
import { notFound } from 'next/navigation';
import { getModuleById } from './registry';

export async function renderSharedModuleRoute(
  moduleId: string,
  route: string,
  tokenId: string,
): Promise<ReactElement> {
  const mod = await getModuleById(moduleId);
  if (!mod) notFound();

  const routeDef = mod.config.routes.find((r) => r.path === route);
  if (!routeDef || !routeDef.shareable) notFound();

  const componentPath = path.join(mod.dir, routeDef.component);
  const imported = (await import(/* @vite-ignore */ componentPath)) as {
    default: (props: {
      shareScope: { moduleId: string; route: string; tokenId: string };
    }) => Promise<ReactElement> | ReactElement;
  };

  const shareScope = { moduleId, route, tokenId };
  return imported.default({ shareScope });
}
