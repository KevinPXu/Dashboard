import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ModuleConfigSchema, type ModuleConfig } from './types';

export type LoadedModule = {
  dir: string;
  config: ModuleConfig;
};

export async function discoverModules(rootDir: string): Promise<LoadedModule[]> {
  const modulesDir = path.join(rootDir, 'modules');
  let entries: string[];
  try {
    entries = await fs.readdir(modulesDir);
  } catch {
    return [];
  }
  entries.sort();

  const loaded: LoadedModule[] = [];
  for (const entry of entries) {
    if (entry.startsWith('_') || entry.startsWith('.')) continue;
    const dir = path.join(modulesDir, entry);
    const stat = await fs.stat(dir);
    if (!stat.isDirectory()) continue;

    const config = await loadModuleConfig(dir);
    if (entry !== config.id) {
      throw new Error(
        `Module folder "${entry}" does not match config id "${config.id}" — folder name must equal id`,
      );
    }
    await validateModuleStructure(dir, config);
    loaded.push({ dir, config });
  }

  return loaded;
}

export async function loadModuleConfig(dir: string): Promise<ModuleConfig> {
  // Prefer module.config.json (used in tests and supported in production); fall
  // back to module.config.ts via dynamic import (Node/Next.js loader handles it).
  const jsonPath = path.join(dir, 'module.config.json');
  try {
    const raw = await fs.readFile(jsonPath, 'utf8');
    return ModuleConfigSchema.parse(JSON.parse(raw));
  } catch (err) {
    if (!isNotFound(err)) throw err;
  }

  const tsPath = path.join(dir, 'module.config.ts');
  await fs.access(tsPath);
  const url = pathToFileURL(tsPath).href;
  const mod = (await import(/* @vite-ignore */ url)) as { default: unknown };
  return ModuleConfigSchema.parse(mod.default);
}

export async function validateModuleStructure(
  dir: string,
  config: Pick<ModuleConfig, 'id' | 'routes' | 'api' | 'widgets' | 'cron' | 'env'>,
): Promise<void> {
  for (const route of config.routes) {
    await assertFileExists(dir, route.component, ['.tsx', '.ts']);
  }
  for (const widget of config.widgets) {
    await assertFileExists(dir, widget.component, ['.tsx', '.ts']);
  }
  for (const api of config.api) {
    const handlerName =
      api.path === '/' ? 'index' : api.path.replace(/^\//, '').replace(/\//g, '.');
    await assertFileExists(dir, path.join('api', handlerName), ['.ts']);
    const filePath = path.join(dir, 'api', handlerName + '.ts');
    const mod = (await import(/* @vite-ignore */ pathToFileURL(filePath).href)) as Record<
      string,
      unknown
    >;
    for (const method of api.methods) {
      if (typeof mod[method] !== 'function') {
        throw new Error(
          `Module "${config.id}" api ${api.path} declares ${method} but file does not export a ${method} function`,
        );
      }
    }
  }
  for (const cron of config.cron) {
    const expectedPrefix = `/api/${config.id}/`;
    if (!cron.handler.startsWith(expectedPrefix)) {
      throw new Error(`Cron handler "${cron.handler}" must start with "${expectedPrefix}"`);
    }
    // Derive the same path → filename mapping used for api entries, then assert the file exists.
    const subpath = cron.handler.slice(expectedPrefix.length); // e.g. "cron/digest"
    const handlerName = subpath.replace(/\//g, '.'); // e.g. "cron.digest"
    await assertFileExists(dir, path.join('api', handlerName), ['.ts']);
  }
  for (const key of config.env.required) {
    if (!process.env[key]) {
      throw new Error(`Module "${config.id}" requires env var "${key}" but it is not set`);
    }
  }
}

async function assertFileExists(
  dir: string,
  relative: string,
  extensions: string[],
): Promise<void> {
  const moduleRoot = path.resolve(dir) + path.sep;
  for (const ext of extensions) {
    const resolved = path.resolve(dir, relative + ext);
    if (!resolved.startsWith(moduleRoot)) {
      throw new Error(`Manifest path "${relative}" resolves outside module directory ${dir}`);
    }
    try {
      await fs.access(resolved);
      return;
    } catch {
      // try next extension
    }
  }
  throw new Error(`File not found at ${relative} (extensions: ${extensions.join(', ')}) in ${dir}`);
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'ENOENT'
  );
}
