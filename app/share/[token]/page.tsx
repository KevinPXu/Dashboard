import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { resolveShareToken } from '@/lib/shared/share-links';
import { ModuleErrorBoundary } from '@/components/shell/boundaries/ModuleErrorBoundary';
import { renderSharedModuleRoute } from '@/lib/shared/share-render';
import { SHARE_COOKIE } from '@/lib/shared/cookie-names';

type Props = { params: Promise<{ token: string }> };

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  const payload = await resolveShareToken(token);
  if (!payload) notFound();

  const cookieStore = await cookies();
  cookieStore.set(SHARE_COOKIE, payload.tokenId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: payload.exp ? Math.max(0, payload.exp - Math.floor(Date.now() / 1000)) : 60 * 60 * 24,
  });

  return (
    <main className="min-h-screen bg-white p-6">
      <div className="mb-4 rounded bg-slate-100 px-3 py-2 text-xs text-slate-700">
        You are viewing a shared, read-only page.
      </div>
      <ModuleErrorBoundary moduleName={payload.moduleId}>
        {await renderSharedModuleRoute(payload.moduleId, payload.route, payload.tokenId)}
      </ModuleErrorBoundary>
    </main>
  );
}
