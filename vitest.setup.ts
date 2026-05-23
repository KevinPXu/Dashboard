import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { vi } from 'vitest';
vi.mock('server-only', () => ({}));

import '@testing-library/jest-dom/vitest';
