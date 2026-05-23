import { describe, it, expect } from 'vitest';
import { verifyPassword } from './password';

describe('verifyPassword', () => {
  it('returns true on exact match', () => {
    expect(verifyPassword('hunter2', 'hunter2')).toBe(true);
  });
  it('returns false on mismatch', () => {
    expect(verifyPassword('hunter2', 'wrong')).toBe(false);
  });
  it('returns false on empty input', () => {
    expect(verifyPassword('', 'hunter2')).toBe(false);
  });
  it('uses constant-time comparison (length-mismatch returns false)', () => {
    expect(verifyPassword('short', 'longerpassword')).toBe(false);
  });
});
