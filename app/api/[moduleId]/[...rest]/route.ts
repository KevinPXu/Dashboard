import { notFound } from 'next/navigation';
import * as path from 'node:path';
import { getModuleById } from '@/lib/shared/registry';

async function handle(method: string, moduleId: string, rest: string[], req: Request) {
  const mod = await getModuleById(moduleId);
  if (!mod) notFound();
  const handlerName = rest.length === 0 ? 'index' : rest.join('.');
  const handlerPath = path.join(mod.dir, 'api', handlerName);
  let imported: Record<string, (req: Request) => Promise<Response>>;
  try {
    imported = (await import(/* @vite-ignore */ handlerPath)) as never;
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
