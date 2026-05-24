import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  getModules,
  getModuleById,
  getCronHandlerPaths,
  isApiPathDeclared,
  __resetModuleRegistry,
} from './registry';

let tmpRoot: string;
const originalEnv = { ...process.env };

function writeFile(p: string, content: string) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function makeModule(root: string, id: string, enabled = true) {
  const dir = path.join(root, 'modules', id);
  const config = {
    id,
    name: id,
    version: '0.0.1',
    description: 'test',
    enabled,
    icon: 'Box',
    nav: { label: id, order: 0 },
    routes: [{ path: '/', component: 'routes/index', shareable: false }],
    api: [],
    widgets: [],
    db: { schema: id.replace(/-/g, '_') },
    cron: [],
    env: { required: [], optional: [] },
  };
  writeFile(path.join(dir, 'module.config.json'), JSON.stringify(config));
  writeFile(path.join(dir, 'routes/index.tsx'), 'export default function P(){return null}\n');
}

// Use a project-local tmp dir so Vite/Vitest can transform `.ts` fixtures we
// dynamically `import()` from validateModuleStructure.
const projectTmpBase = path.resolve(__dirname, '../../.test-tmp');

beforeEach(() => {
  __resetModuleRegistry();
  fs.mkdirSync(projectTmpBase, { recursive: true });
  tmpRoot = fs.mkdtempSync(path.join(projectTmpBase, 'dash-reg-'));
  fs.mkdirSync(path.join(tmpRoot, 'modules'), { recursive: true });
  process.env.DATABASE_URL = 'x';
  process.env.DASHBOARD_PASSWORD = 'x';
  process.env.SHARE_LINK_SIGNING_KEY = 'x';
  process.env.SESSION_COOKIE_SECRET = 'x';
});

afterEach(() => {
  __resetModuleRegistry();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  process.env = { ...originalEnv };
});

describe('registry', () => {
  it('returns enabled modules, filtering out disabled', async () => {
    makeModule(tmpRoot, 'one', true);
    makeModule(tmpRoot, 'two', false);
    const mods = await getModules(tmpRoot);
    expect(mods.map((m) => m.config.id)).toEqual(['one']);
  });

  it('caches the result so repeated calls return the same promise', async () => {
    makeModule(tmpRoot, 'cached');
    const first = getModules(tmpRoot);
    const second = getModules(tmpRoot);
    expect(first).toBe(second);
    await first;
  });

  it('looks up a module by id via getModuleById', async () => {
    makeModule(tmpRoot, 'lookup');
    // Prime the cache with the tmp root.
    await getModules(tmpRoot);
    const found = await getModuleById('lookup');
    expect(found?.config.id).toBe('lookup');
    const missing = await getModuleById('nope');
    expect(missing).toBeUndefined();
  });
});

function makeModuleWithApiAndCron(root: string, id: string) {
  const dir = path.join(root, 'modules', id);
  const config = {
    id,
    name: id,
    version: '0.0.1',
    description: 'test',
    enabled: true,
    icon: 'Box',
    nav: { label: id, order: 0 },
    routes: [{ path: '/', component: 'routes/index', shareable: false }],
    api: [{ path: '/health', methods: ['GET'] }],
    widgets: [],
    db: { schema: id.replace(/-/g, '_') },
    cron: [{ schedule: '0 0 * * *', handler: `/api/${id}/cron/daily` }],
    env: { required: [], optional: [] },
  };
  writeFile(path.join(dir, 'module.config.json'), JSON.stringify(config));
  writeFile(path.join(dir, 'routes/index.tsx'), 'export default function P(){return null}\n');
  writeFile(
    path.join(dir, 'api/health.ts'),
    'export const GET = async () => new Response("ok");\n',
  );
  writeFile(
    path.join(dir, 'api/cron.daily.ts'),
    'export const GET = async () => new Response("ok");\n',
  );
}

describe('registry — cron + api helpers', () => {
  beforeEach(async () => {
    makeModuleWithApiAndCron(tmpRoot, 'mod-a');
    // Prime the cache with the tmp root so subsequent helper calls hit it.
    await getModules(tmpRoot);
  });

  it('getCronHandlerPaths() includes declared cron handlers', async () => {
    const paths = await getCronHandlerPaths();
    expect(paths).toContain('/api/mod-a/cron/daily');
  });

  it('isApiPathDeclared returns true for a declared path + method', async () => {
    expect(await isApiPathDeclared('mod-a', '/health', 'GET')).toBe(true);
  });

  it('isApiPathDeclared returns false for an undeclared path', async () => {
    expect(await isApiPathDeclared('mod-a', '/secret', 'GET')).toBe(false);
  });

  it('isApiPathDeclared returns false for an undeclared method on a known path', async () => {
    expect(await isApiPathDeclared('mod-a', '/health', 'POST')).toBe(false);
  });
});
