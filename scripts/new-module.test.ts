import { describe, it, expect } from 'vitest';
import { renderTemplate, scaffoldModule } from './new-module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('renderTemplate', () => {
  it('substitutes placeholders', () => {
    const out = renderTemplate(
      'id={{ID}} name={{NAME}} pascal={{NAME_PASCAL}} schema={{SCHEMA}} camel={{SCHEMA_CAMEL}} icon={{ICON}} desc={{DESCRIPTION}}',
      {
        id: 'job-tracker',
        name: 'Job Tracker',
        icon: 'Briefcase',
        description: 'Tracks jobs',
      },
    );
    expect(out).toBe(
      'id=job-tracker name=Job Tracker pascal=JobTracker schema=job_tracker camel=jobTracker icon=Briefcase desc=Tracks jobs',
    );
  });
});

describe('scaffoldModule', () => {
  it('creates a working module folder from the template', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-'));
    fs.mkdirSync(path.join(tmp, 'modules', '_template'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'modules', '_template', 'README.md.template'), '# {{NAME}}');
    fs.mkdirSync(path.join(tmp, 'modules', '_template', 'routes'), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, 'modules', '_template', 'routes', 'index.tsx.template'),
      'export default function {{NAME_PASCAL}}(){return null}',
    );

    await scaffoldModule(tmp, {
      id: 'demo',
      name: 'Demo',
      icon: 'Box',
      description: 'A demo',
    });

    const generated = fs.readFileSync(path.join(tmp, 'modules', 'demo', 'README.md'), 'utf-8');
    expect(generated).toBe('# Demo');

    const route = fs.readFileSync(
      path.join(tmp, 'modules', 'demo', 'routes', 'index.tsx'),
      'utf-8',
    );
    expect(route).toContain('function Demo(');
    fs.rmSync(tmp, { recursive: true });
  });
});
