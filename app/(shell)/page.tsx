import { getModules } from '@/lib/shared/registry';
import { loadLayout } from '@/lib/shared/widget-layout-store';
import { buildDefaultLayout } from '@/lib/shared/widgets';
import { renderAllWidgets } from '@/lib/shared/widget-render';
import { HomeGrid } from './HomeGrid';

export default async function HomePage() {
  const modules = await getModules();
  const persisted = await loadLayout();
  const layout = persisted ?? buildDefaultLayout(modules, 12);
  const widgets = await renderAllWidgets();
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Home</h1>
      <HomeGrid initialLayout={layout} widgets={widgets} />
    </div>
  );
}
