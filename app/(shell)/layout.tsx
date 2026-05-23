import { getModules } from '@/lib/shared/registry';
import { Sidebar } from '@/components/shell/Sidebar';

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const modules = await getModules();
  return (
    <div className="flex min-h-screen">
      <Sidebar modules={modules.map((m) => m.config)} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
