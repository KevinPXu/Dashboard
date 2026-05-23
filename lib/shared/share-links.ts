import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq, isNull } from 'drizzle-orm';
import { db } from './db';
import { shareLinks } from '@/platform/db/schema';

export type ShareTokenPayload = {
  tokenId: string;
  moduleId: string;
  route: string;
  exp?: number;
};

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s, 'base64url');
}

export function signShareToken(payload: ShareTokenPayload, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyShareToken(token: string, secret: string): ShareTokenPayload | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expectedSig = createHmac('sha256', secret).update(body).digest();
  const providedSig = b64urlDecode(sig);
  if (providedSig.length !== expectedSig.length) return null;
  if (!timingSafeEqual(providedSig, expectedSig)) return null;

  let payload: ShareTokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString('utf-8'));
  } catch {
    return null;
  }
  if (
    typeof payload.tokenId !== 'string' ||
    typeof payload.moduleId !== 'string' ||
    typeof payload.route !== 'string'
  ) {
    return null;
  }
  if (payload.exp !== undefined) {
    if (typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  }
  return payload;
}

export async function createShareLink(input: {
  moduleId: string;
  route: string;
  label?: string;
  expiresAt?: Date;
}): Promise<{ token: string; tokenId: string }> {
  const secret = process.env.SHARE_LINK_SIGNING_KEY;
  if (!secret) throw new Error('SHARE_LINK_SIGNING_KEY is not set');

  const [row] = await db
    .insert(shareLinks)
    .values({
      moduleId: input.moduleId,
      route: input.route,
      label: input.label ?? null,
      expiresAt: input.expiresAt ?? null,
    })
    .returning({ id: shareLinks.id });

  if (!row) throw new Error('Failed to create share link');

  const payload: ShareTokenPayload = {
    tokenId: row.id,
    moduleId: input.moduleId,
    route: input.route,
  };
  if (input.expiresAt) payload.exp = Math.floor(input.expiresAt.getTime() / 1000);

  return { token: signShareToken(payload, secret), tokenId: row.id };
}

export async function revokeShareLink(tokenId: string): Promise<void> {
  await db.update(shareLinks).set({ revokedAt: new Date() }).where(eq(shareLinks.id, tokenId));
}

export async function listShareLinks() {
  return db.select().from(shareLinks).where(isNull(shareLinks.revokedAt));
}

export async function isShareTokenActive(tokenId: string): Promise<boolean> {
  const rows = await db.select().from(shareLinks).where(eq(shareLinks.id, tokenId));
  const row = rows[0];
  if (!row) return false;
  if (row.revokedAt) return false;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return false;
  return true;
}

export async function resolveShareToken(token: string): Promise<ShareTokenPayload | null> {
  const secret = process.env.SHARE_LINK_SIGNING_KEY;
  if (!secret) throw new Error('SHARE_LINK_SIGNING_KEY is not set');
  const payload = verifyShareToken(token, secret);
  if (!payload) return null;
  if (!(await isShareTokenActive(payload.tokenId))) return null;
  return payload;
}
