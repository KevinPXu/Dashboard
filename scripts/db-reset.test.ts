import { describe, it, expect } from 'vitest';
import { parseDbName, parseDbHost, assertResetAllowed } from './db-reset';

describe('parseDbName', () => {
  it('extracts the database name from a postgres URL', () => {
    expect(parseDbName('postgres://u:p@host.neon.tech/dashboard_dev?sslmode=require')).toBe(
      'dashboard_dev',
    );
  });
  it('handles a URL with no query string', () => {
    expect(parseDbName('postgres://u:p@host/mydb')).toBe('mydb');
  });
  it('returns a sentinel for an unparseable URL', () => {
    expect(parseDbName('not a url')).toBe('(unparseable)');
  });
});

describe('parseDbHost', () => {
  it('extracts host:port', () => {
    expect(parseDbHost('postgres://u:p@db.example.com:5432/x')).toBe('db.example.com:5432');
  });
});

describe('assertResetAllowed', () => {
  it('throws when NODE_ENV is production', () => {
    expect(() => assertResetAllowed({ nodeEnv: 'production' })).toThrow(/production/);
  });
  it('allows non-production environments', () => {
    expect(() => assertResetAllowed({ nodeEnv: 'development' })).not.toThrow();
    expect(() => assertResetAllowed({})).not.toThrow();
  });
});
