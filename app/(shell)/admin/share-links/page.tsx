import { Button } from '@/components/ui/button';
import { getShareableRoutes, listShareLinks, revokeLinkAction } from './actions';
import { CreateForm } from './CreateForm';

export default async function ShareLinksPage() {
  const [routes, links] = await Promise.all([getShareableRoutes(), listShareLinks()]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Share Links</h1>

      <section>
        <h2 className="mb-2 text-lg font-medium">Create</h2>
        <CreateForm routes={routes} />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Active links</h2>
        {links.length === 0 ? (
          <p className="text-sm text-slate-500">No active links.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {links.map((l) => (
              <li key={l.id} className="rounded border p-3">
                <div className="font-mono text-xs">{l.id}</div>
                <div>
                  {l.moduleId} {l.route}
                </div>
                {l.label && <div className="text-slate-500">{l.label}</div>}
                {l.expiresAt && (
                  <div className="text-slate-500">Expires {l.expiresAt.toISOString()}</div>
                )}
                <form action={revokeLinkAction} className="mt-2">
                  <input type="hidden" name="tokenId" value={l.id} />
                  <Button type="submit" variant="outline" size="sm">
                    Revoke
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
