import type { SessionPayload } from './session-token';

function b64urlToUint8(s: string): Uint8Array {
  // Convert base64url -> base64
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function uint8ToString(u: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i] as number);
  return s;
}

function timingSafeEqualUint8(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] as number) ^ (b[i] as number);
  return diff === 0;
}

/**
 * Edge-runtime compatible verifier using Web Crypto.
 * Returns the payload if valid, otherwise null.
 */
export async function verifySessionTokenEdge(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  const enc = new TextEncoder();
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
  } catch {
    return null;
  }

  let expectedSig: Uint8Array;
  try {
    const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(body));
    expectedSig = new Uint8Array(sigBuf);
  } catch {
    return null;
  }

  let providedSig: Uint8Array;
  try {
    providedSig = b64urlToUint8(sig);
  } catch {
    return null;
  }
  if (!timingSafeEqualUint8(providedSig, expectedSig)) return null;

  let payload: SessionPayload;
  try {
    const bodyBytes = b64urlToUint8(body);
    payload = JSON.parse(uint8ToString(bodyBytes));
  } catch {
    return null;
  }
  if (typeof payload.sid !== 'string' || typeof payload.exp !== 'number') return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}
