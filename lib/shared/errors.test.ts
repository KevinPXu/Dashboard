import { describe, it, expect } from 'vitest';
import { ForbiddenError, NotFoundError, UnauthorizedError } from './errors';

describe('shared error classes', () => {
  it('ForbiddenError carries message + name + default message', () => {
    expect(new ForbiddenError('nope').message).toBe('nope');
    expect(new ForbiddenError('nope').name).toBe('ForbiddenError');
    expect(new ForbiddenError()).toBeInstanceOf(Error);
    expect(new ForbiddenError().message).toBe('Forbidden');
  });
  it('NotFoundError has its own name and default message', () => {
    expect(new NotFoundError().name).toBe('NotFoundError');
    expect(new NotFoundError().message).toBe('Not found');
    expect(new NotFoundError('row 42').message).toBe('row 42');
  });
  it('UnauthorizedError has its own name and default message', () => {
    expect(new UnauthorizedError().name).toBe('UnauthorizedError');
    expect(new UnauthorizedError().message).toBe('Unauthorized');
  });
});
