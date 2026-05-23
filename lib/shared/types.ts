import { z } from 'zod';

const KebabCase = z
  .string()
  .regex(/^[a-z][a-z0-9-]*[a-z0-9]$/, 'must be kebab-case (lowercase letters, digits, hyphens)');

const CronExpression = z.string().refine(
  (val) => {
    const fields = val.trim().split(/\s+/);
    if (fields.length !== 5) return false;
    const fieldPattern = /^(\*|(\*\/\d+)|(\d+(-\d+)?(\/\d+)?)(,(\d+(-\d+)?(\/\d+)?))*)$/;
    return fields.every((f) => fieldPattern.test(f));
  },
  { message: 'cron schedule must be a valid 5-field expression' },
);

const RouteSchema = z.object({
  path: z.string().startsWith('/'),
  component: z.string().min(1),
  shareable: z.union([z.literal(false), z.object({ mode: z.literal('read-only') })]),
});

const ApiSchema = z.object({
  path: z.string().startsWith('/'),
  methods: z.array(z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])).nonempty(),
});

const WidgetSchema = z.object({
  id: KebabCase,
  name: z.string().min(1),
  defaultSize: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }),
  minSize: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }),
  component: z.string().min(1),
});

const CronEntrySchema = z.object({
  schedule: CronExpression,
  handler: z.string().startsWith('/'),
});

export const ModuleConfigSchema = z
  .object({
    id: KebabCase,
    name: z.string().min(1),
    version: z.string().regex(/^\d+\.\d+\.\d+/),
    description: z.string().min(1),
    enabled: z.boolean(),
    icon: z.string().min(1),
    nav: z.object({ label: z.string().min(1), order: z.number().int() }),
    routes: z.array(RouteSchema),
    api: z.array(ApiSchema),
    widgets: z.array(WidgetSchema),
    db: z.object({ schema: z.string().regex(/^[a-z][a-z0-9_]*$/, 'snake_case') }),
    cron: z.array(CronEntrySchema),
    env: z.object({
      required: z.array(z.string()),
      optional: z.array(z.string()),
    }),
  })
  .superRefine((val, ctx) => {
    const expectedSchema = val.id.replace(/-/g, '_');
    if (val.db.schema !== expectedSchema) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['db', 'schema'],
        message: `db.schema must equal id with hyphens replaced by underscores (expected "${expectedSchema}")`,
      });
    }
  });

export type ModuleConfig = z.infer<typeof ModuleConfigSchema>;
