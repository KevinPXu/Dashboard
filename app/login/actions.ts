'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/shared/db';
import { sessions } from '@/platform/db/schema';
import { signSessionToken } from '@/lib/shared/session-token';
import { verifyPassword } from '@/lib/shared/password';
import { SESSION_COOKIE } from '@/lib/shared/auth';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function loginAction(formData: FormData): Promise<void> {
  const password = String(formData.get('password') ?? '');
  const expected = process.env.DASHBOARD_PASSWORD;
  const secret = process.env.SESSION_COOKIE_SECRET;

  if (!expected || !secret) {
    redirect('/login?error=server');
  }

  if (!verifyPassword(password, expected)) {
    redirect('/login?error=invalid');
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const [session] = await db.insert(sessions).values({ expiresAt }).returning({ id: sessions.id });

  if (!session) {
    redirect('/login?error=session');
  }

  const token = signSessionToken(
    { sid: session.id, exp: Math.floor(expiresAt.getTime() / 1000) },
    secret,
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });

  redirect('/');
}
