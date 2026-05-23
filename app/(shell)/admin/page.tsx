import { getModules } from '@/lib/shared/registry';
import { logoutAction } from './actions';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const modules = await getModules();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Admin</h1>

      <section>
        <h2 className="mb-2 text-lg font-medium">Modules</h2>
        <ul className="space-y-1 text-sm">
          {modules.length === 0 && <li className="text-slate-500">No modules installed.</li>}
          {modules.map((m) => (
            <li key={m.config.id}>
              <span className="font-mono">{m.config.id}</span> — {m.config.name} (v
              {m.config.version})
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Session</h2>
        <form action={logoutAction}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </section>
    </div>
  );
}
