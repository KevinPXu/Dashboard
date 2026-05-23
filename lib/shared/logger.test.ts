import { describe, it, expect, vi, afterEach } from 'vitest';
import { createLogger } from './logger';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createLogger', () => {
  it('emits a JSON line with auto-injected context', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const log = createLogger({ moduleId: 'jobs', route: '/x' });
    log.info('hello', { extra: 1 });
    expect(spy).toHaveBeenCalledOnce();
    const payload = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(payload.level).toBe('info');
    expect(payload.moduleId).toBe('jobs');
    expect(payload.route).toBe('/x');
    expect(payload.message).toBe('hello');
    expect(payload.extra).toBe(1);
    expect(typeof payload.timestamp).toBe('string');
  });

  it('emits error level to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = createLogger({ moduleId: 'jobs' });
    log.error('boom', { err: 'x' });
    expect(spy).toHaveBeenCalledOnce();
    const payload = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(payload.level).toBe('error');
  });
});
