import 'server-only';
import { db } from './db';
import { sessions } from '@/platform/db/schema';

export async function createOwnerSession(expiresAt: Date): Promise<{ id: string }> {
  const [row] = await db.insert(sessions).values({ expiresAt }).returning({ id: sessions.id });
  if (!row) throw new Error('Failed to create session row');
  return row;
}
