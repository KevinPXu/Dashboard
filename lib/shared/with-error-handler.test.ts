import { describe, it, expect, vi } from 'vitest';
import { withErrorHandler } from './with-error-handler';
import { NotFoundError, ForbiddenError, UnauthorizedError } from './errors';
import { z } from 'zod';

function makeReq(): Request {
  return new Request('http://localhost/x');
}

describe('withErrorHandler', () => {
  it('passes through a successful response', async () => {
    const handler = withErrorHandler('jobs', async () => new Response('ok'));
    const res = await handler(makeReq());
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('maps NotFoundError to 404', async () => {
    const handler = withErrorHandler('jobs', async () => {
      throw new NotFoundError('missing');
    });
    const res = await handler(makeReq());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'NotFound', message: 'missing' });
  });

  it('maps ForbiddenError to 403', async () => {
    const handler = withErrorHandler('jobs', async () => {
      throw new ForbiddenError();
    });
    const res = await handler(makeReq());
    expect(res.status).toBe(403);
  });

  it('maps UnauthorizedError to 401', async () => {
    const handler = withErrorHandler('jobs', async () => {
      throw new UnauthorizedError();
    });
    const res = await handler(makeReq());
    expect(res.status).toBe(401);
  });

  it('maps ZodError to 400 with issues', async () => {
    const schema = z.object({ x: z.number() });
    const handler = withErrorHandler('jobs', async () => {
      schema.parse({});
      return new Response('unreachable');
    });
    const res = await handler(makeReq());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('ValidationError');
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it('maps unknown errors to 500 with sanitized message', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = withErrorHandler('jobs', async () => {
      throw new Error('secret internal detail');
    });
    const res = await handler(makeReq());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'InternalError' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
