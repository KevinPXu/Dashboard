import { notFound } from 'next/navigation';
import * as path from 'node:path';
import type { ReactNode } from 'react';
import { getModuleById } from '@/lib/shared/registry';
import { ModuleErrorBoundary } from '@/components/shell/boundaries/ModuleErrorBoundary';

export default async function ModuleNestedPage({
  params,
}: {
  params: Promise<{ moduleId: string; rest: string[] }>;
}) {
  const { moduleId, rest } = await params;
  const mod = await getModuleById(moduleId);
  if (!mod) notFound();
  const fullPath = '/' + rest.join('/');
  const route = mod.config.routes.find((r) => r.path === fullPath);
  if (!route) notFound();
  const componentPath = path.join(mod.dir, route.component);
  const imported = (await import(/* @vite-ignore */ componentPath)) as {
    default: () => Promise<ReactNode> | ReactNode;
  };
  return (
    <ModuleErrorBoundary moduleName={mod.config.name}>
      {await imported.default()}
    </ModuleErrorBoundary>
  );
}
