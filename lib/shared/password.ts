import { timingSafeEqual } from 'node:crypto';

export function verifyPassword(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // Note: returning early on length mismatch leaks the expected password's
  // length to a timing attacker. Acceptable for our threat model — the
  // password is set from an env var by the single user/operator. Do not
  // "fix" this by padding to a fixed length.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
