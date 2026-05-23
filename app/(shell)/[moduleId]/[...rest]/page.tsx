import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { getModuleById } from '@/lib/shared/registry';
import { loadModuleExport } from '@/lib/shared/module-import';
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
  const imported = await loadModuleExport<{
    default: () => Promise<ReactNode> | ReactNode;
  }>(moduleId, route.component);
  return (
    <ModuleErrorBoundary moduleName={mod.config.name}>
      {await imported.default()}
    </ModuleErrorBoundary>
  );
}
