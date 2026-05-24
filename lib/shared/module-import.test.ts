import { describe, it, expect, vi } from 'vitest';

const { importMock } = vi.hoisted(() => ({ importMock: vi.fn() }));
vi.mock('./module-import-impl', () => ({ importModuleFile: importMock }));

import { loadModuleExport } from './module-import';

describe('loadModuleExport', () => {
  it('returns the module when validator passes', async () => {
    importMock.mockResolvedValueOnce({ default: () => null });
    const out = await loadModuleExport(
      'm',
      'routes/index',
      (mod): mod is { default: () => null } =>
        typeof (mod as { default?: unknown }).default === 'function',
    );
    expect(typeof out.default).toBe('function');
  });
  it('throws when validator rejects', async () => {
    importMock.mockResolvedValueOnce({ wrong: 1 });
    await expect(
      loadModuleExport('m', 'routes/index', (m): m is { default: () => null } => false),
    ).rejects.toThrow(/shape/);
  });
});
