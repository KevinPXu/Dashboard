'use server';

import { revalidatePath } from 'next/cache';
import { createShareLink, revokeShareLink, listShareLinks } from '@/lib/shared/share-links';
import { getModules } from '@/lib/shared/registry';

export async function createLinkAction(formData: FormData) {
  const moduleId = String(formData.get('moduleId') ?? '');
  const route = String(formData.get('route') ?? '');
  const label = String(formData.get('label') ?? '') || undefined;
  const expiresInDaysRaw = String(formData.get('expiresInDays') ?? '');
  const expiresInDays = expiresInDaysRaw ? Number(expiresInDaysRaw) : NaN;

  const modules = await getModules();
  const mod = modules.find((m) => m.config.id === moduleId);
  if (!mod) throw new Error(`Unknown module ${moduleId}`);
  const routeDef = mod.config.routes.find((r) => r.path === route);
  if (!routeDef || !routeDef.shareable) {
    throw new Error(`Route ${route} on module ${moduleId} is not shareable`);
  }

  const expiresAt =
    Number.isFinite(expiresInDays) && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

  const args: Parameters<typeof createShareLink>[0] = { moduleId, route };
  if (label !== undefined) args.label = label;
  if (expiresAt !== undefined) args.expiresAt = expiresAt;
  await createShareLink(args);
  revalidatePath('/admin/share-links');
}

export async function revokeLinkAction(formData: FormData) {
  const tokenId = String(formData.get('tokenId') ?? '');
  if (!tokenId) return;
  await revokeShareLink(tokenId);
  revalidatePath('/admin/share-links');
}

export async function getShareableRoutes() {
  const modules = await getModules();
  const out: { moduleId: string; route: string; label: string }[] = [];
  for (const m of modules) {
    for (const r of m.config.routes) {
      if (r.shareable) {
        out.push({ moduleId: m.config.id, route: r.path, label: `${m.config.name} ${r.path}` });
      }
    }
  }
  return out;
}

export { listShareLinks };
