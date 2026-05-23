import { withErrorHandler } from '@/lib/shared/with-error-handler';

export const GET = withErrorHandler('smoke', async () => {
  return Response.json({ ran: true });
});
