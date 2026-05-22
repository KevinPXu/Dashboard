import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { discoverModules, loadModuleConfig, validateModuleStructure } from './module-loader';

let tmpRoot: string;

function writeFile(p: string, content: string) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function makeModule(
  root: string,
  id: string,
  configOverrides: Partial<Record<string, unknown>> = {},
) {
  const dir = path.join(root, 'modules', id);
  const schema = id.replace(/-/g, '_');
  const config = {
    id,
    name: id,
    version: '0.0.1',
    description: 'test',
    enabled: true,
    icon: 'Box',
    nav: { label: id, order: 0 },
    routes: [{ path: '/', component: 'routes/index', shareable: false }],
    api: [],
    widgets: [],
    db: { schema },
    cron: [],
    env: { required: [], optional: [] },
    ...configOverrides,
  };
  writeFile(path.join(dir, 'module.config.json'), JSON.stringify(config, null, 2) + '\n');
  writeFile(path.join(dir, 'routes/index.tsx'), 'export default function P(){return null}\n');
  return dir;
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-mod-'));
  fs.mkdirSync(path.join(tmpRoot, 'modules'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('discoverModules', () => {
  it('returns empty list when no modules', async () => {
    const result = await discoverModules(tmpRoot);
    expect(result).toEqual([]);
  });

  it('discovers a single valid module', async () => {
    makeModule(tmpRoot, 'job-tracker');
    const result = await discoverModules(tmpRoot);
    expect(result).toHaveLength(1);
    expect(result[0]!.config.id).toBe('job-tracker');
  });

  it('skips directories prefixed with underscore', async () => {
    makeModule(tmpRoot, 'job-tracker');
    makeModule(tmpRoot, '_template');
    const result = await discoverModules(tmpRoot);
    expect(result.map((m) => m.config.id)).toEqual(['job-tracker']);
  });

  it('rejects two modules with the same id', async () => {
    makeModule(tmpRoot, 'jobs');
    const dir = path.join(tmpRoot, 'modules', 'duplicate-folder');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'module.config.json'),
      `${JSON.stringify({
        id: 'jobs',
        name: 'x',
        version: '0.0.1',
        description: 'x',
        enabled: true,
        icon: 'Box',
        nav: { label: 'x', order: 0 },
        routes: [],
        api: [],
        widgets: [],
        db: { schema: 'jobs' },
        cron: [],
        env: { required: [], optional: [] },
      })}\n`,
    );
    await expect(discoverModules(tmpRoot)).rejects.toThrow(/duplicate.*id/i);
  });

  it('rejects modules where folder name does not match config id', async () => {
    const dir = path.join(tmpRoot, 'modules', 'wrong-folder');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'module.config.json'),
      `${JSON.stringify({
        id: 'right-id',
        name: 'x',
        version: '0.0.1',
        description: 'x',
        enabled: true,
        icon: 'Box',
        nav: { label: 'x', order: 0 },
        routes: [],
        api: [],
        widgets: [],
        db: { schema: 'right_id' },
        cron: [],
        env: { required: [], optional: [] },
      })}\n`,
    );
    await expect(discoverModules(tmpRoot)).rejects.toThrow(/folder.*id/i);
  });
});

describe('validateModuleStructure', () => {
  it('passes when all referenced files exist', async () => {
    const dir = makeModule(tmpRoot, 'good');
    await expect(
      validateModuleStructure(dir, {
        id: 'good',
        routes: [{ path: '/', component: 'routes/index', shareable: false }],
        api: [],
        widgets: [],
        cron: [],
      }),
    ).resolves.toBeUndefined();
  });

  it('throws when a referenced component file is missing', async () => {
    const dir = makeModule(tmpRoot, 'broken');
    await expect(
      validateModuleStructure(dir, {
        id: 'broken',
        routes: [{ path: '/', component: 'routes/missing', shareable: false }],
        api: [],
        widgets: [],
        cron: [],
      }),
    ).rejects.toThrow(/routes\/missing/);
  });
});

// Skip loadModuleConfig export check — it's used internally by discoverModules
void loadModuleConfig;
