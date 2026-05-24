import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/shared/auth', () => ({
  getSession: vi.fn(),
}));
vi.mock('@/lib/shared/registry', () => ({
  getModuleById: vi.fn().mockResolvedValue({ config: { id: 'smoke' } }),
  getCronHandlerPaths: vi.fn().mockResolvedValue(['/api/smoke/cron/yearly']),
  isApiPathDeclared: vi.fn(),
}));
vi.mock('@/lib/shared/module-import', () => ({
  loadModuleExport: vi.fn().mockResolvedValue({ GET: async () => new Response('ok') }),
}));

import { GET } from './route';
import { getSession } from '@/lib/shared/auth';
import { isApiPathDeclared } from '@/lib/shared/registry';

function ctx(rest: string[]) {
  return { params: Promise.resolve({ moduleId: 'smoke', rest }) };
}

const originalCronSecret = process.env.CRON_SECRET;

beforeEach(() => {
  vi.mocked(getSession).mockReset();
  vi.mocked(isApiPathDeclared).mockReset();
  process.env.CRON_SECRET = 'crontop';
});

afterEach(() => {
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
});

describe('api gateway', () => {
  it('owner can call declared GET /health', async () => {
    vi.mocked(getSession).mockResolvedValue({ role: 'owner' });
    vi.mocked(isApiPathDeclared).mockResolvedValue(true);
    const res = await GET(new Request('http://x/api/smoke/health'), ctx(['health']));
    expect(res.status).toBe(200);
  });
  it('rejects undeclared path even for owner', async () => {
    vi.mocked(getSession).mockResolvedValue({ role: 'owner' });
    vi.mocked(isApiPathDeclared).mockResolvedValue(false);
    const res = await GET(new Request('http://x/api/smoke/secret'), ctx(['secret']));
    expect(res.status).toBe(404);
  });
  it('allows cron call with correct CRON_SECRET, no owner', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const req = new Request('http://x/api/smoke/cron/yearly', {
      headers: { authorization: 'Bearer crontop' },
    });
    const res = await GET(req, ctx(['cron', 'yearly']));
    expect(res.status).toBe(200);
  });
  it('rejects cron call with bad secret', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const req = new Request('http://x/api/smoke/cron/yearly', {
      headers: { authorization: 'Bearer wrong' },
    });
    const res = await GET(req, ctx(['cron', 'yearly']));
    expect(res.status).toBe(401);
  });
  it('rejects unauthenticated non-cron request', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    vi.mocked(isApiPathDeclared).mockResolvedValue(true);
    const res = await GET(new Request('http://x/api/smoke/health'), ctx(['health']));
    expect(res.status).toBe(401);
  });
});
