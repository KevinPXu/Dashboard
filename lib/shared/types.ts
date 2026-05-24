import { z } from 'zod';

const KebabCase = z
  .string()
  .regex(/^[a-z][a-z0-9-]*[a-z0-9]$/, 'must be kebab-case (lowercase letters, digits, hyphens)');

const FIELD_RANGES: Array<[number, number]> = [
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // day-of-month
  [1, 12], // month
  [0, 7], // day-of-week (0 and 7 both = Sunday)
];

function validateCronField(field: string, min: number, max: number): boolean {
  if (field === '*') return true;
  const stepMatch = field.match(/^\*\/(\d+)$/);
  if (stepMatch) {
    const step = Number(stepMatch[1]);
    return step >= 1 && step <= max;
  }
  return field.split(',').every((part) => {
    const m = part.match(/^(\d+)(?:-(\d+))?(?:\/(\d+))?$/);
    if (!m) return false;
    const start = Number(m[1]);
    const end = m[2] !== undefined ? Number(m[2]) : start;
    const step = m[3] !== undefined ? Number(m[3]) : 1;
    if (start < min || start > max) return false;
    if (end < start || end > max) return false;
    if (step < 1) return false;
    return true;
  });
}

const CronExpression = z.string().refine(
  (val) => {
    const fields = val.trim().split(/\s+/);
    if (fields.length !== 5) return false;
    return fields.every((f, i) => {
      const [min, max] = FIELD_RANGES[i]!;
      return validateCronField(f, min, max);
    });
  },
  { message: 'cron schedule must be a valid 5-field expression with in-range values' },
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
