import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import * as path from 'node:path';
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

// Use a project-local tmp dir so Vite/Vitest can transform `.ts` fixtures we
// dynamically `import()` from validateModuleStructure (Node's native ESM loader
// cannot handle `.ts` files in /tmp).
const projectTmpBase = path.resolve(__dirname, '../../.test-tmp');

beforeEach(() => {
  fs.mkdirSync(projectTmpBase, { recursive: true });
  tmpRoot = fs.mkdtempSync(path.join(projectTmpBase, 'dash-mod-'));
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

  it('returns modules in alphabetical order by id regardless of filesystem order', async () => {
    makeModule(tmpRoot, 'charlie');
    makeModule(tmpRoot, 'alpha');
    makeModule(tmpRoot, 'bravo');
    const result = await discoverModules(tmpRoot);
    expect(result.map((m) => m.config.id)).toEqual(['alpha', 'bravo', 'charlie']);
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
  const emptyEnv = { required: [] as string[], optional: [] as string[] };

  it('passes when all referenced files exist', async () => {
    const dir = makeModule(tmpRoot, 'good');
    await expect(
      validateModuleStructure(dir, {
        id: 'good',
        routes: [{ path: '/', component: 'routes/index', shareable: false }],
        api: [],
        widgets: [],
        cron: [],
        env: emptyEnv,
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
        env: emptyEnv,
      }),
    ).rejects.toThrow(/routes\/missing/);
  });

  it('passes when widget files exist (.tsx)', async () => {
    const dir = makeModule(tmpRoot, 'widg');
    writeFile(path.join(dir, 'widgets/foo.tsx'), 'export default function W(){return null}\n');
    await expect(
      validateModuleStructure(dir, {
        id: 'widg',
        routes: [],
        api: [],
        widgets: [
          {
            id: 'foo',
            name: 'Foo',
            defaultSize: { w: 1, h: 1 },
            minSize: { w: 1, h: 1 },
            component: 'widgets/foo',
          },
        ],
        cron: [],
        env: emptyEnv,
      }),
    ).resolves.toBeUndefined();
  });

  it('passes when widget files exist via .ts extension', async () => {
    const dir = makeModule(tmpRoot, 'widg2');
    writeFile(path.join(dir, 'widgets/bar.ts'), 'export default function W(){return null}\n');
    await expect(
      validateModuleStructure(dir, {
        id: 'widg2',
        routes: [],
        api: [],
        widgets: [
          {
            id: 'bar',
            name: 'Bar',
            defaultSize: { w: 1, h: 1 },
            minSize: { w: 1, h: 1 },
            component: 'widgets/bar',
          },
        ],
        cron: [],
        env: emptyEnv,
      }),
    ).resolves.toBeUndefined();
  });

  it('throws when widget file is missing', async () => {
    const dir = makeModule(tmpRoot, 'wmissing');
    await expect(
      validateModuleStructure(dir, {
        id: 'wmissing',
        routes: [],
        api: [],
        widgets: [
          {
            id: 'gone',
            name: 'Gone',
            defaultSize: { w: 1, h: 1 },
            minSize: { w: 1, h: 1 },
            component: 'widgets/gone',
          },
        ],
        cron: [],
        env: emptyEnv,
      }),
    ).rejects.toThrow(/widgets\/gone/);
  });

  it('passes when api handlers exist at root and nested paths', async () => {
    const dir = makeModule(tmpRoot, 'api1');
    writeFile(path.join(dir, 'api/index.ts'), 'export const GET = () => new Response()\n');
    writeFile(path.join(dir, 'api/users.list.ts'), 'export const GET = () => new Response()\n');
    await expect(
      validateModuleStructure(dir, {
        id: 'api1',
        routes: [],
        api: [
          { path: '/', methods: ['GET'] },
          { path: '/users/list', methods: ['GET'] },
        ],
        widgets: [],
        cron: [],
        env: emptyEnv,
      }),
    ).resolves.toBeUndefined();
  });

  it('throws when api handler file is missing', async () => {
    const dir = makeModule(tmpRoot, 'api2');
    await expect(
      validateModuleStructure(dir, {
        id: 'api2',
        routes: [],
        api: [{ path: '/missing', methods: ['GET'] }],
        widgets: [],
        cron: [],
        env: emptyEnv,
      }),
    ).rejects.toThrow(/missing/);
  });

  it('throws when cron handler does not start with module api prefix', async () => {
    const dir = makeModule(tmpRoot, 'cronmod');
    await expect(
      validateModuleStructure(dir, {
        id: 'cronmod',
        routes: [],
        api: [],
        widgets: [],
        cron: [{ schedule: '0 * * * *', handler: '/api/other/job' }],
        env: emptyEnv,
      }),
    ).rejects.toThrow(/cron handler/i);
  });

  it('passes when cron handler starts with module api prefix and file exists', async () => {
    const dir = makeModule(tmpRoot, 'cronok');
    writeFile(path.join(dir, 'api/job.ts'), 'export const POST = () => new Response()\n');
    await expect(
      validateModuleStructure(dir, {
        id: 'cronok',
        routes: [],
        api: [],
        widgets: [],
        cron: [{ schedule: '0 * * * *', handler: '/api/cronok/job' }],
        env: emptyEnv,
      }),
    ).resolves.toBeUndefined();
  });

  it('throws when a cron handler file is missing', async () => {
    const dir = makeModule(tmpRoot, 'cronmod');
    await expect(
      validateModuleStructure(dir, {
        id: 'cronmod',
        routes: [],
        api: [],
        widgets: [],
        cron: [{ schedule: '0 9 * * 1', handler: '/api/cronmod/cron/missing' }],
        env: emptyEnv,
      }),
    ).rejects.toThrow(/cron\.missing/);
  });

  it('rejects manifest paths that escape the module directory', async () => {
    const dir = makeModule(tmpRoot, 'traversal');
    await expect(
      validateModuleStructure(dir, {
        id: 'traversal',
        routes: [{ path: '/', component: '../../etc/passwd', shareable: false }],
        api: [],
        widgets: [],
        cron: [],
        env: emptyEnv,
      }),
    ).rejects.toThrow(/outside module/);
  });

  it('rejects when an API handler is missing a declared method export', async () => {
    const dir = path.join(tmpRoot, 'method-export-check');
    await fsp.mkdir(path.join(dir, 'api'), { recursive: true });
    await fsp.writeFile(
      path.join(dir, 'api', 'health.ts'),
      'export async function GET(){ return new Response("ok") }',
    );
    const cfg = {
      id: 'x',
      routes: [],
      api: [{ path: '/health', methods: ['GET', 'POST'] as ('GET' | 'POST')[] }],
      widgets: [],
      cron: [],
      env: { required: [], optional: [] },
    };
    await expect(validateModuleStructure(dir, cfg)).rejects.toThrow(/POST/);
  });

  describe('env enforcement', () => {
    it('rejects when env.required is missing from process.env', async () => {
      const dir = makeModule(tmpRoot, 'envmiss');
      const prev = process.env.X_REQUIRED_KEY;
      delete process.env.X_REQUIRED_KEY;
      try {
        await expect(
          validateModuleStructure(dir, {
            id: 'envmiss',
            routes: [{ path: '/', component: 'routes/index', shareable: false }],
            api: [],
            widgets: [],
            cron: [],
            env: { required: ['X_REQUIRED_KEY'], optional: [] },
          }),
        ).rejects.toThrow(/X_REQUIRED_KEY/);
      } finally {
        if (prev !== undefined) process.env.X_REQUIRED_KEY = prev;
      }
    });

    it('accepts when env.required is present', async () => {
      const dir = makeModule(tmpRoot, 'envok');
      const prev = process.env.X_REQUIRED_KEY;
      process.env.X_REQUIRED_KEY = 'present';
      try {
        await expect(
          validateModuleStructure(dir, {
            id: 'envok',
            routes: [{ path: '/', component: 'routes/index', shareable: false }],
            api: [],
            widgets: [],
            cron: [],
            env: { required: ['X_REQUIRED_KEY'], optional: [] },
          }),
        ).resolves.toBeUndefined();
      } finally {
        if (prev === undefined) delete process.env.X_REQUIRED_KEY;
        else process.env.X_REQUIRED_KEY = prev;
      }
    });
  });
});

// Skip loadModuleConfig export check — it's used internally by discoverModules
void loadModuleConfig;
