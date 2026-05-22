'use strict';

const MODULE_PATH = /^@\/modules\/([^/]+)\/(.*)$/;

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: "Disallow imports from another module except via that module's lib/public-api",
    },
    messages: {
      crossModule:
        'Cross-module imports are forbidden. Import only from `@/modules/<other>/lib/public-api`.',
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    const fileMatch = filename.match(/modules\/([^/]+)\//);
    const currentModule = fileMatch ? fileMatch[1] : null;

    function check(node, importPath) {
      const m = importPath.match(MODULE_PATH);
      if (!m) return;
      const [, importedModule, rest] = m;
      if (!currentModule) return;
      if (importedModule === currentModule) return;
      if (rest === 'lib/public-api' || rest === 'lib/public-api.ts') return;
      context.report({ node, messageId: 'crossModule' });
    }

    return {
      ImportDeclaration(node) {
        check(node, node.source.value);
      },
      ImportExpression(node) {
        if (node.source.type === 'Literal' && typeof node.source.value === 'string') {
          check(node, node.source.value);
        }
      },
    };
  },
};
