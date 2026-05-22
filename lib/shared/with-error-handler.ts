import { ZodError } from 'zod';
import { createLogger } from './logger';
import { NotFoundError, ForbiddenError, UnauthorizedError } from './errors';

type Handler<P extends Record<string, string> = Record<string, string>> = (
  req: Request,
  ctx: { params: Promise<P> },
) => Promise<Response>;

export function withErrorHandler<P extends Record<string, string> = Record<string, string>>(
  moduleId: string,
  handler: Handler<P>,
): Handler<P> {
  const log = createLogger({ moduleId });
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ZodError) {
        return Response.json({ error: 'ValidationError', issues: err.issues }, { status: 400 });
      }
      if (err instanceof NotFoundError) {
        return Response.json({ error: 'NotFound', message: err.message }, { status: 404 });
      }
      if (err instanceof ForbiddenError) {
        return Response.json({ error: 'Forbidden', message: err.message }, { status: 403 });
      }
      if (err instanceof UnauthorizedError) {
        return Response.json({ error: 'Unauthorized', message: err.message }, { status: 401 });
      }
      log.error('unhandled exception', {
        err:
          err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
        url: req.url,
      });
      return Response.json({ error: 'InternalError' }, { status: 500 });
    }
  };
}
