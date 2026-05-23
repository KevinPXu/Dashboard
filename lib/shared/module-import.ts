import 'server-only';

/**
 * Dynamically imports a file from a module's source tree at runtime.
 *
 * Why this exists: `await import(absolutePath)` fails under Turbopack with
 * "Cannot find module as expression is too dynamic" because the bundler
 * can't statically infer the candidate set. By anchoring the template
 * literal at `@/modules/...`, Turbopack treats it as a context-style import
 * — it globs the candidate set at build time and resolves the right one
 * from the runtime values.
 *
 * Both `.ts` and `.tsx` are attempted because module manifests reference
 * files without extensions.
 */
export async function loadModuleExport<T = unknown>(
  moduleId: string,
  relativePath: string,
): Promise<T> {
  // Try .tsx first (UI components), then .ts (API handlers, libs).
  // webpackInclude excludes *.test.ts(x) so vitest doesn't get bundled.
  try {
    return (await import(
      /* webpackInclude: /(?<!\.test)\.tsx$/ */
      `@/modules/${moduleId}/${relativePath}.tsx`
    )) as T;
  } catch (errTsx) {
    try {
      return (await import(
        /* webpackInclude: /(?<!\.test)\.ts$/ */
        `@/modules/${moduleId}/${relativePath}.ts`
      )) as T;
    } catch (errTs) {
      throw new Error(
        `Failed to load module export @/modules/${moduleId}/${relativePath}: ` +
          `tsx=${(errTsx as Error).message}; ts=${(errTs as Error).message}`,
      );
    }
  }
}
