import 'server-only';
import { importModuleFile } from './module-import-impl';

export type ModuleExportValidator<T> = (mod: unknown) => mod is T;

/**
 * Dynamically imports a file from a module's source tree at runtime, then
 * runtime-validates its shape with the supplied type guard. A validator is
 * REQUIRED — there is no unchecked cast — so callers cannot silently trust an
 * arbitrary dynamically-loaded shape.
 */
export async function loadModuleExport<T>(
  moduleId: string,
  relativePath: string,
  validator: ModuleExportValidator<T>,
): Promise<T> {
  const raw = await importModuleFile(moduleId, relativePath);
  if (!validator(raw)) {
    throw new Error(
      `Loaded module export at @/modules/${moduleId}/${relativePath} did not match expected shape`,
    );
  }
  return raw;
}
