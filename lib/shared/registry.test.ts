import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { getModules, getModuleById, __resetModuleRegistry } from './registry';

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

beforeEach(() => {
  __resetModuleRegistry();
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-reg-'));
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
