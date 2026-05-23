import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as readline from 'node:readline/promises';

export type ScaffoldInput = {
  id: string;
  name: string;
  icon: string;
  description: string;
};

export function renderTemplate(template: string, input: ScaffoldInput): string {
  const schema = input.id.replace(/-/g, '_');
  const namePascal = input.name
    .replace(/[^A-Za-z0-9]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join('');
  const schemaCamel = schema
    .split('_')
    .map((w, i) => (i === 0 ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join('');

  return template
    .replace(/\{\{ID\}\}/g, input.id)
    .replace(/\{\{NAME\}\}/g, input.name)
    .replace(/\{\{NAME_PASCAL\}\}/g, namePascal)
    .replace(/\{\{SCHEMA\}\}/g, schema)
    .replace(/\{\{SCHEMA_CAMEL\}\}/g, schemaCamel)
    .replace(/\{\{ICON\}\}/g, input.icon)
    .replace(/\{\{DESCRIPTION\}\}/g, input.description);
}

export async function scaffoldModule(rootDir: string, input: ScaffoldInput): Promise<void> {
  if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(input.id)) {
    throw new Error(`Invalid id "${input.id}" — must be kebab-case`);
  }
  const templateDir = path.join(rootDir, 'modules', '_template');
  const targetDir = path.join(rootDir, 'modules', input.id);

  try {
    await fs.access(targetDir);
    throw new Error(`Target directory already exists: ${targetDir}`);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Target')) throw err;
    if (!(err instanceof Error) || (err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  async function copy(srcDir: string, dstDir: string) {
    const entries = await fs.readdir(srcDir, { withFileTypes: true });
    await fs.mkdir(dstDir, { recursive: true });
    for (const e of entries) {
      const src = path.join(srcDir, e.name);
      if (e.isDirectory()) {
        await copy(src, path.join(dstDir, e.name));
      } else {
        const targetName = e.name.replace(/\.template$/, '');
        const content = await fs.readFile(src, 'utf-8');
        const rendered = e.name.endsWith('.template') ? renderTemplate(content, input) : content;
        await fs.writeFile(path.join(dstDir, targetName), rendered);
      }
    }
  }

  await copy(templateDir, targetDir);
}

async function readAllLines(): Promise<string[]> {
  const rlSync = await import('node:readline');
  return await new Promise<string[]>((resolve) => {
    const iface = rlSync.createInterface({ input: process.stdin, terminal: false });
    const lines: string[] = [];
    iface.on('line', (line) => lines.push(line));
    iface.on('close', () => resolve(lines));
  });
}

async function main() {
  const idArg = process.argv[2];

  // When stdin is piped (e.g. heredoc), readline/promises has issues
  // resolving subsequent questions on Node 20. Read all lines upfront.
  if (!process.stdin.isTTY) {
    const lines = await readAllLines();
    let i = 0;
    const id = idArg ?? lines[i++] ?? '';
    const name = (lines[i++] ?? '').trim() || id;
    const icon = (lines[i++] ?? '').trim() || 'Package';
    const description = lines[i++] ?? '';
    await scaffoldModule(process.cwd(), { id, name, icon, description });
    console.log(`Created modules/${id}`);
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const id = idArg ?? (await rl.question('Module id (kebab-case): '));
  const name = await rl.question(`Display name (default: ${id}): `).then((s) => s.trim() || id);
  const icon = await rl
    .question('Lucide icon name (default: Package): ')
    .then((s) => s.trim() || 'Package');
  const description = await rl.question('Description: ');
  rl.close();
  await scaffoldModule(process.cwd(), { id, name, icon, description });
  console.log(`Created modules/${id}`);
}

if (require.main === module) {
  void main();
}
