import 'server-only';

/**
 * Raw dynamic import of a module source file. Isolated here so the validating
 * wrapper in module-import.ts can be unit-tested by mocking this function.
 *
 * Why this exists: `await import(absolutePath)` fails under Turbopack with
 * "Cannot find module as expression is too dynamic" because the bundler can't
 * statically infer the candidate set. By anchoring the template literal at
 * `@/modules/...`, Turbopack treats it as a context-style import — it globs the
 * candidate set at build time and resolves the right one from runtime values.
 *
 * Both .tsx and .ts are attempted because manifests reference files without
 * extensions. The webpackInclude comments keep *.test.ts(x) out of the bundle.
 */
export async function importModuleFile(moduleId: string, relativePath: string): Promise<unknown> {
  try {
    return await import(
      /* webpackInclude: /(?<!\.test)\.tsx$/ */
      `@/modules/${moduleId}/${relativePath}.tsx`
    );
  } catch (errTsx) {
    try {
      return await import(
        /* webpackInclude: /(?<!\.test)\.ts$/ */
        `@/modules/${moduleId}/${relativePath}.ts`
      );
    } catch (errTs) {
      throw new Error(
        `Failed to load module export @/modules/${moduleId}/${relativePath}: ` +
          `tsx=${(errTsx as Error).message}; ts=${(errTs as Error).message}`,
      );
    }
  }
}
