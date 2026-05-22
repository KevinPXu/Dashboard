import { createHmac, timingSafeEqual } from 'node:crypto';

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
