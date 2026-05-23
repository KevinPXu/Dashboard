import { redirect } from 'next/navigation';
import { getModules } from '@/lib/shared/registry';
import { getSession } from '@/lib/shared/auth';
import { Sidebar } from '@/components/shell/Sidebar';

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    redirect('/login');
  }
  const modules = await getModules();
  return (
    <div className="flex min-h-screen">
      <Sidebar modules={modules.map((m) => m.config)} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
