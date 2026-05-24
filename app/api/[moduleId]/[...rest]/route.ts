import { notFound } from 'next/navigation';
import { getModuleById, getCronHandlerPaths, isApiPathDeclared } from '@/lib/shared/registry';
import { loadModuleExport } from '@/lib/shared/module-import';
import { getSession } from '@/lib/shared/auth';

async function handle(method: string, moduleId: string, rest: string[], req: Request) {
  const mod = await getModuleById(moduleId);
  if (!mod) notFound();

  const apiPath = '/' + rest.join('/');
  const fullPath = `/api/${moduleId}${apiPath}`;

  const cronPaths = await getCronHandlerPaths();
  if (cronPaths.includes(fullPath)) {
    const expected = process.env.CRON_SECRET;
    const provided = req.headers.get('authorization');
    if (!expected || provided !== `Bearer ${expected}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  } else {
    if (!(await isApiPathDeclared(moduleId, apiPath, method))) {
      return new Response('Not found', { status: 404 });
    }
    const session = await getSession();
    if (!session || session.role !== 'owner') {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const handlerName = rest.length === 0 ? 'index' : rest.join('.');
  let imported: Record<string, unknown>;
  try {
    imported = await loadModuleExport(
      moduleId,
      `api/${handlerName}`,
      (m): m is Record<string, unknown> => typeof m === 'object' && m !== null,
    );
  } catch {
    return new Response('Not found', { status: 404 });
  }
  const fn = imported[method];
  if (typeof fn !== 'function') {
    return new Response('Method not allowed', { status: 405 });
  }
  return (fn as (req: Request) => Promise<Response>)(req);
}

type RouteCtx = { params: Promise<{ moduleId: string; rest: string[] }> };
const wrap = (method: string) => async (req: Request, ctx: RouteCtx) => {
  const { moduleId, rest } = await ctx.params;
  return handle(method, moduleId, rest, req);
};

export const GET = wrap('GET');
export const POST = wrap('POST');
export const PATCH = wrap('PATCH');
export const PUT = wrap('PUT');
export const DELETE = wrap('DELETE');
