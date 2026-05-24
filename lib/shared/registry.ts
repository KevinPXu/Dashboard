import 'server-only';
import { discoverModules, type LoadedModule } from './module-loader';
import { validateRequiredEnv } from './env-validator';

let cached: Promise<LoadedModule[]> | null = null;

export function getModules(rootDir: string = process.cwd()): Promise<LoadedModule[]> {
  if (!cached) {
    cached = (async () => {
      const modules = await discoverModules(rootDir);
      const enabled = modules.filter((m) => m.config.enabled);
      validateRequiredEnv(enabled);
      return enabled;
    })();
  }
  return cached;
}

export function getModuleById(id: string): Promise<LoadedModule | undefined> {
  return getModules().then((mods) => mods.find((m) => m.config.id === id));
}

export async function getCronHandlerPaths(): Promise<string[]> {
  const modules = await getModules();
  return modules.flatMap((m) => m.config.cron.map((c) => c.handler));
}

export async function isApiPathDeclared(
  moduleId: string,
  apiPath: string,
  method: string,
): Promise<boolean> {
  const mod = await getModuleById(moduleId);
  if (!mod) return false;
  return mod.config.api.some(
    (a) => a.path === apiPath && (a.methods as readonly string[]).includes(method),
  );
}

// Test-only — clears the cache between test runs.
export function __resetModuleRegistry() {
  cached = null;
}
