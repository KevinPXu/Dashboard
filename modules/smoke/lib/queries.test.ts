import { describe, it, expect } from 'vitest';
import { ping } from './queries';

describe('smoke queries', () => {
  it('returns the module-tagged ping', () => {
    expect(ping()).toBe('pong-smoke');
  });
});
