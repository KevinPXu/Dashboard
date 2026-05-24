import { notFound } from 'next/navigation';
import { getModuleById } from '@/lib/shared/registry';
import { loadModuleExport } from '@/lib/shared/module-import';
import { getSession } from '@/lib/shared/auth';

async function handle(method: string, moduleId: string, rest: string[], req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return new Response('Unauthorized', { status: 401 });
  }
  const mod = await getModuleById(moduleId);
  if (!mod) notFound();
  const handlerName = rest.length === 0 ? 'index' : rest.join('.');
  let imported: Record<string, (req: Request) => Promise<Response>>;
  try {
    imported = await loadModuleExport<Record<string, (req: Request) => Promise<Response>>>(
      moduleId,
      `api/${handlerName}`,
    );
  } catch {
    return new Response('Not found', { status: 404 });
  }
  const fn = imported[method];
  if (!fn) return new Response('Method not allowed', { status: 405 });
  return fn(req);
}

type RouteCtx = { params: Promise<{ moduleId: string; rest: string[] }> };

export const GET = async (req: Request, ctx: RouteCtx) => {
  const { moduleId, rest } = await ctx.params;
  return handle('GET', moduleId, rest, req);
};
export const POST = async (req: Request, ctx: RouteCtx) => {
  const { moduleId, rest } = await ctx.params;
  return handle('POST', moduleId, rest, req);
};
export const PATCH = async (req: Request, ctx: RouteCtx) => {
  const { moduleId, rest } = await ctx.params;
  return handle('PATCH', moduleId, rest, req);
};
export const PUT = async (req: Request, ctx: RouteCtx) => {
  const { moduleId, rest } = await ctx.params;
  return handle('PUT', moduleId, rest, req);
};
export const DELETE = async (req: Request, ctx: RouteCtx) => {
  const { moduleId, rest } = await ctx.params;
  return handle('DELETE', moduleId, rest, req);
};
