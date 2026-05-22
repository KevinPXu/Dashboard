type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type Context = { moduleId?: string; route?: string };

export function createLogger(ctx: Context = {}) {
  function emit(level: LogLevel, message: string, fields?: Record<string, unknown>) {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      ...ctx,
      message,
      ...(fields ?? {}),
    };
    const serialized = JSON.stringify(payload);
    if (level === 'error') {
      console.error(serialized);
    } else if (level === 'warn') {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }
  }

  return {
    debug: (m: string, f?: Record<string, unknown>) => emit('debug', m, f),
    info: (m: string, f?: Record<string, unknown>) => emit('info', m, f),
    warn: (m: string, f?: Record<string, unknown>) => emit('warn', m, f),
    error: (m: string, f?: Record<string, unknown>) => emit('error', m, f),
  };
}

export const logger = createLogger();
